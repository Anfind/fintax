import { useEffect, useRef, useState } from 'react';

type MermaidModule = typeof import('mermaid');

let initialized = false;
let renderSeq = 0;
let mermaidLoadPromise: Promise<MermaidModule> | null = null;

function loadMermaid() {
  if (!mermaidLoadPromise) {
    mermaidLoadPromise = import('mermaid');
  }
  return mermaidLoadPromise;
}

function ensureMermaidInit(mermaid: MermaidModule['default']) {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'dark',
    fontFamily: 'Inter, system-ui, sans-serif',
    suppressErrorRendering: true,
  });
  initialized = true;
}

interface MermaidDiagramProps {
  code: string;
}

export default function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const idRef = useRef(`mermaid-${Date.now()}-${renderSeq++}`);

  useEffect(() => {
    let alive = true;

    async function renderDiagram() {
      if (!code?.trim()) {
        setSvg('');
        return;
      }

      try {
        const mermaidModule = await loadMermaid();
        const mermaid = mermaidModule.default;
        ensureMermaidInit(mermaid);
        const { svg: result } = await mermaid.render(idRef.current, code);
        if (!alive) return;
        setSvg(result);
        setError('');
      } catch (e) {
        if (!alive) return;
        setSvg('');
        setError((e as Error)?.message || 'Mermaid render failed');
      }
    }

    renderDiagram();
    return () => {
      alive = false;
    };
  }, [code]);

  if (error) {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
        Không render được sơ đồ Mermaid. Chi tiết: {error}
      </div>
    );
  }

  if (!svg) return null;

  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 overflow-x-auto">
      <div className="min-w-[320px]" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
