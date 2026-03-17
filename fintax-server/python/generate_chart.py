import json
import os
import sys


def load_payload(input_path: str):
    with open(input_path, 'r', encoding='utf-8-sig') as f:
        return json.load(f)


def ensure_parent(path: str):
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def as_float(value):
    try:
        return float(value)
    except Exception:
        return 0.0


def render_chart(payload):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    chart = payload.get('chart', {})
    data = chart.get('data', [])
    chart_type = chart.get('type', 'bar')
    x_key = chart.get('xKey', 'label')
    y_key = chart.get('yKey', 'value')
    title = chart.get('label') or payload.get('title') or 'FinTax Chart'
    output_path = payload.get('outputPath')

    if not output_path:
        raise ValueError('outputPath is required')
    if not isinstance(data, list) or not data:
        raise ValueError('chart.data must be a non-empty list')

    ensure_parent(output_path)

    xs = [str(item.get(x_key, '')) for item in data]
    ys = [as_float(item.get(y_key, 0)) for item in data]

    plt.figure(figsize=(10, 5), dpi=140)

    if chart_type == 'line':
        plt.plot(xs, ys, marker='o', linewidth=2)
    elif chart_type == 'area':
        plt.plot(xs, ys, marker='o', linewidth=2)
        plt.fill_between(xs, ys, alpha=0.2)
    elif chart_type == 'pie':
        labels = xs
        values = ys
        plt.pie(values, labels=labels, autopct='%1.1f%%', startangle=120)
        plt.axis('equal')
    elif chart_type == 'composed':
        numeric_keys = []
        sample = data[0] if data else {}
        for k, v in sample.items():
            if k == x_key:
                continue
            if isinstance(v, (int, float)):
                numeric_keys.append(k)

        if not numeric_keys:
            plt.bar(xs, ys)
        else:
            first = numeric_keys[0]
            first_vals = [as_float(item.get(first, 0)) for item in data]
            plt.bar(xs, first_vals, alpha=0.35, label=first)
            for key in numeric_keys[1:]:
                values = [as_float(item.get(key, 0)) for item in data]
                plt.plot(xs, values, marker='o', linewidth=2, label=key)
            plt.legend()
    else:
        plt.bar(xs, ys)

    plt.title(title)
    if chart_type != 'pie':
        plt.xticks(rotation=20, ha='right')
        plt.tight_layout()

    plt.savefig(output_path, format='png', bbox_inches='tight')
    plt.close()

    return output_path


def main():
    if len(sys.argv) < 2:
        raise ValueError('Usage: python generate_chart.py <input-json-path>')

    payload = load_payload(sys.argv[1])
    out = render_chart(payload)
    print(json.dumps({'ok': True, 'outputPath': out}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}, ensure_ascii=False))
        sys.exit(1)
