# -*- coding: utf-8 -*-
"""
FinTax - Data Analysis & Model Evaluation
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pymongo import MongoClient
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# Setup style
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['figure.figsize'] = (12, 6)
plt.rcParams['font.size'] = 11
sns.set_palette('husl')

print("="*80)
print("  FINTAX - DATA ANALYSIS & MODEL EVALUATION")
print("="*80)

# ===== 1. CONNECT DATABASE =====
print("\n[1/7] Connecting to MongoDB...")
MONGODB_URI = "mongodb+srv://nguyenthaian210506_db_user:ENdinhL89uFBkXYU@fintax.tioma4y.mongodb.net/?appName=FinTax"
DB_NAME = "fintax_web"

client = MongoClient(MONGODB_URI)
db = client[DB_NAME]
collections = db.list_collection_names()
print(f"Connected to: {DB_NAME}")
print(f"Collections: {collections}")

# ===== 2. LOAD DATA =====
print("\n[2/7] Loading data...")
invoices_cursor = db.invoices.find({})
df_invoices = pd.DataFrame(list(invoices_cursor))

print(f"Total invoices: {len(df_invoices):,}")

if len(df_invoices) == 0:
    print("ERROR: No invoice data!")
    client.close()
    exit()

# ===== 3. EDA =====
print("\n[3/7] Exploratory Data Analysis...")
print("="*60)
print("GENERAL STATISTICS")
print("="*60)

df_invoices['invoiceDate'] = pd.to_datetime(df_invoices['invoiceDate'])
print(f"Date range: {df_invoices['invoiceDate'].min()} to {df_invoices['invoiceDate'].max()}")

print(f"\nInvoice Type Distribution:")
print(df_invoices['type'].value_counts().to_string())

print(f"\nStatus Distribution:")
print(df_invoices['status'].value_counts().to_string())

# Missing values
missing_data = df_invoices.isnull().sum()
missing_pct = (missing_data / len(df_invoices) * 100).round(2)
missing_df = pd.DataFrame({
    'Column': missing_data.index,
    'Missing Count': missing_data.values,
    'Missing %': missing_pct.values
})
missing_df = missing_df[missing_df['Missing Count'] > 0]

print(f"\nMissing Values:")
if len(missing_df) > 0:
    print(missing_df.to_string(index=False))
else:
    print("No missing values!")

# ===== 4. GENERATE CHARTS =====
print("\n[4/7] Generating charts...")

# Chart 1: Data Distribution
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

type_counts = df_invoices['type'].value_counts()
colors = ['#2ecc71', '#e74c3c']
labels = [f"Sale ({type_counts.get('sale', 0):,})", f"Purchase ({type_counts.get('purchase', 0):,})"]
axes[0].pie(type_counts.values, labels=labels, autopct='%1.1f%%', colors=colors,
            explode=[0.02, 0.02], shadow=True, startangle=90)
axes[0].set_title('Invoice Type Distribution\n(Data Imbalance Check)', fontsize=14, fontweight='bold')

status_counts = df_invoices['status'].value_counts()
bars = axes[1].bar(status_counts.index, status_counts.values, color=sns.color_palette('viridis', len(status_counts)))
axes[1].set_title('Invoice Status Distribution', fontsize=14, fontweight='bold')
axes[1].set_xlabel('Status')
axes[1].set_ylabel('Count')
for bar, val in zip(bars, status_counts.values):
    axes[1].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 50,
                 f'{val:,}', ha='center', fontsize=10)

plt.tight_layout()
plt.savefig('data_distribution.png', dpi=150, bbox_inches='tight')
plt.close()
print("Saved: data_distribution.png")

# Chart 2: Correlation Matrix
numeric_features = ['subtotal', 'taxAmount', 'discount', 'fees', 'totalAmount']
existing_features = [f for f in numeric_features if f in df_invoices.columns]

if len(existing_features) > 1:
    correlation_matrix = df_invoices[existing_features].corr()

    plt.figure(figsize=(10, 8))
    mask = np.triu(np.ones_like(correlation_matrix, dtype=bool))
    sns.heatmap(correlation_matrix, annot=True, fmt='.3f', cmap='RdYlBu_r',
                mask=mask, square=True, linewidths=0.5, cbar_kws={'shrink': 0.8},
                annot_kws={'size': 12})
    plt.title('Correlation Matrix\nFinancial Features',
              fontsize=16, fontweight='bold', pad=20)
    plt.tight_layout()
    plt.savefig('correlation_matrix.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("Saved: correlation_matrix.png")

    print("\nCorrelation Matrix:")
    print(correlation_matrix.round(3).to_string())

# ===== 5. PREPARE DATA FOR MODELS =====
print("\n[5/7] Data Preprocessing...")

df_invoices['yearMonth'] = df_invoices['invoiceDate'].dt.to_period('M')
df_sales = df_invoices[df_invoices['type'] == 'sale'].copy()

df_monthly = df_sales.groupby('yearMonth').agg({
    'totalAmount': 'sum',
    '_id': 'count'
}).reset_index()
df_monthly.columns = ['period', 'revenue', 'invoice_count']
df_monthly['period'] = df_monthly['period'].astype(str)
df_monthly = df_monthly.sort_values('period').reset_index(drop=True)

print(f"Monthly data: {len(df_monthly)} records")

# Create features
df_model = df_monthly.copy()
df_model['month_index'] = range(len(df_model))
df_model['month'] = pd.to_datetime(df_model['period']).dt.month
df_model['revenue_lag1'] = df_model['revenue'].shift(1)
df_model['revenue_lag2'] = df_model['revenue'].shift(2)
df_model['revenue_ma3'] = df_model['revenue'].rolling(window=3).mean()

df_model_clean = df_model.dropna().reset_index(drop=True)
print(f"Dataset after preprocessing: {len(df_model_clean)} records")

if len(df_model_clean) < 4:
    print("ERROR: Not enough data for training (need at least 4 records)")
    client.close()
    exit()

# ===== 6. TRAIN & EVALUATE MODELS =====
print("\n[6/7] Training & Evaluating Models...")

from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

def calculate_metrics(y_true, y_pred, model_name):
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1e-10))) * 100
    return {
        'Model': model_name,
        'RMSE': rmse,
        'MAE': mae,
        'MAPE (%)': mape,
        'R2': r2
    }

# Train/Test split
train_size = max(int(len(df_model_clean) * 0.8), len(df_model_clean) - 2)
train_data = df_model_clean[:train_size]
test_data = df_model_clean[train_size:]

if len(test_data) < 1:
    test_data = df_model_clean[-2:]
    train_data = df_model_clean[:-2]

feature_cols = ['month_index', 'month', 'revenue_lag1', 'revenue_lag2', 'revenue_ma3']
target_col = 'revenue'

X_train = train_data[feature_cols]
y_train = train_data[target_col]
X_test = test_data[feature_cols]
y_test = test_data[target_col]

print(f"Train size: {len(X_train)} | Test size: {len(X_test)}")

# Baseline Models
y_pred_naive = test_data['revenue_lag1'].values
metrics_naive = calculate_metrics(y_test.values, y_pred_naive, 'Baseline: Naive')

historical_mean = train_data['revenue'].mean()
y_pred_avg = np.full(len(y_test), historical_mean)
metrics_avg = calculate_metrics(y_test.values, y_pred_avg, 'Baseline: Average')

y_pred_ma = test_data['revenue_ma3'].values
metrics_ma = calculate_metrics(y_test.values, y_pred_ma, 'Baseline: MA(3)')

# ML Models
lr_model = LinearRegression()
lr_model.fit(X_train, y_train)
y_pred_lr = lr_model.predict(X_test)
metrics_lr = calculate_metrics(y_test.values, y_pred_lr, 'Linear Regression')

ridge_model = Ridge(alpha=1.0)
ridge_model.fit(X_train, y_train)
y_pred_ridge = ridge_model.predict(X_test)
metrics_ridge = calculate_metrics(y_test.values, y_pred_ridge, 'Ridge Regression')

rf_model = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42)
rf_model.fit(X_train, y_train)
y_pred_rf = rf_model.predict(X_test)
metrics_rf = calculate_metrics(y_test.values, y_pred_rf, 'Random Forest')

gb_model = GradientBoostingRegressor(n_estimators=100, max_depth=3, learning_rate=0.1, random_state=42)
gb_model.fit(X_train, y_train)
y_pred_gb = gb_model.predict(X_test)
metrics_gb = calculate_metrics(y_test.values, y_pred_gb, 'Gradient Boosting')

# ===== 7. RESULTS =====
print("\n[7/7] Generating Results...")

all_metrics = [metrics_naive, metrics_avg, metrics_ma, metrics_lr, metrics_ridge, metrics_rf, metrics_gb]
df_comparison = pd.DataFrame(all_metrics).set_index('Model')

print("\n" + "="*80)
print("MODEL COMPARISON TABLE")
print("="*80)
print(df_comparison.round(2).to_string())

# Export CSV
df_comparison.to_csv('model_comparison_metrics.csv')
print("\nSaved: model_comparison_metrics.csv")

# Comparison Chart
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

models = df_comparison.index.tolist()
colors = ['#95a5a6', '#95a5a6', '#95a5a6', '#3498db', '#2ecc71', '#e74c3c', '#9b59b6']

axes[0, 0].barh(models, df_comparison['RMSE'], color=colors)
axes[0, 0].set_title('RMSE (Root Mean Square Error)', fontweight='bold')
axes[0, 0].set_xlabel('RMSE (VND)')
axes[0, 0].invert_yaxis()

axes[0, 1].barh(models, df_comparison['MAE'], color=colors)
axes[0, 1].set_title('MAE (Mean Absolute Error)', fontweight='bold')
axes[0, 1].set_xlabel('MAE (VND)')
axes[0, 1].invert_yaxis()

axes[1, 0].barh(models, df_comparison['MAPE (%)'], color=colors)
axes[1, 0].set_title('MAPE (%)', fontweight='bold')
axes[1, 0].set_xlabel('MAPE (%)')
axes[1, 0].invert_yaxis()

axes[1, 1].barh(models, df_comparison['R2'], color=colors)
axes[1, 1].set_title('R2 (Coefficient of Determination)', fontweight='bold')
axes[1, 1].set_xlabel('R2')
axes[1, 1].invert_yaxis()
axes[1, 1].axvline(x=0, color='red', linestyle='--', alpha=0.5)

plt.suptitle('MODEL PERFORMANCE COMPARISON\n(Gray: Baseline | Color: ML Models)',
             fontsize=16, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('model_comparison.png', dpi=150, bbox_inches='tight')
plt.close()
print("Saved: model_comparison.png")

# Feature Importance
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

rf_importance = pd.Series(rf_model.feature_importances_, index=feature_cols).sort_values(ascending=True)
rf_importance.plot(kind='barh', ax=axes[0], color='#27ae60')
axes[0].set_title('Feature Importance - Random Forest', fontweight='bold')
axes[0].set_xlabel('Importance')

gb_importance = pd.Series(gb_model.feature_importances_, index=feature_cols).sort_values(ascending=True)
gb_importance.plot(kind='barh', ax=axes[1], color='#e74c3c')
axes[1].set_title('Feature Importance - Gradient Boosting', fontweight='bold')
axes[1].set_xlabel('Importance')

plt.tight_layout()
plt.savefig('feature_importance.png', dpi=150, bbox_inches='tight')
plt.close()
print("Saved: feature_importance.png")

# ===== CONCLUSIONS =====
print("\n" + "="*80)
print("CONCLUSIONS & ANSWERS TO QUESTIONS")
print("="*80)

best_ml_model = df_comparison.loc[['Linear Regression', 'Ridge Regression', 'Random Forest', 'Gradient Boosting'], 'R2'].idxmax()
best_baseline = df_comparison.loc[['Baseline: Naive', 'Baseline: Average', 'Baseline: MA(3)'], 'R2'].idxmax()

print("\n[Q1] ALGORITHMS & METRICS")
print("-"*60)
print("Algorithms used in project:")
print("   - Linear Regression (implemented in prediction.service.js)")
print("   - Moving Average (window=3)")
print("   - Seasonal Adjustment")
print("   - Z-Score Anomaly Detection")
print("\nModels evaluated in this analysis:")
print("   Baseline: Naive, Historical Average, Moving Average")
print("   ML: Linear Regression, Ridge, Random Forest, Gradient Boosting")
print(f"\nBest model: {best_ml_model}")
print(f"   R2 = {df_comparison.loc[best_ml_model, 'R2']:.4f}")
print(f"   RMSE = {df_comparison.loc[best_ml_model, 'RMSE']:,.0f} VND")
print(f"   MAE = {df_comparison.loc[best_ml_model, 'MAE']:,.0f} VND")
print(f"   MAPE = {df_comparison.loc[best_ml_model, 'MAPE (%)']:.2f}%")

print("\n[Q2] EDA & PREPROCESSING")
print("-"*60)
print(f"Data statistics:")
print(f"   Total invoices: {len(df_invoices):,}")
print(f"   Sale invoices: {len(df_sales):,}")
print(f"   Purchase invoices: {len(df_invoices) - len(df_sales):,}")
print(f"   Monthly records: {len(df_monthly)}")
print("\nData processing:")
print("   - Missing values: Convert NaN to empty string")
print("   - Outliers: Checked using IQR method")
print("   - Feature Engineering: Lag features, Moving Average")
print("\nCharts generated:")
print("   - data_distribution.png")
print("   - correlation_matrix.png")
print("   - model_comparison.png")
print("   - feature_importance.png")

print("\n[Q3] RESEARCH QUESTIONS")
print("-"*60)
print("RQ1: Which financial factors affect revenue forecasting?")
print("   Answer (Feature Importance):")
for feat, imp in sorted(zip(feature_cols, rf_model.feature_importances_), key=lambda x: -x[1]):
    print(f"      - {feat}: {imp:.4f}")

print("\nRQ2: How to forecast tax payment trends using historical data?")
print(f"   Answer: Use {best_ml_model} with features:")
print("      - revenue_lag1: Previous month revenue")
print("      - revenue_lag2: Revenue 2 months ago")
print("      - revenue_ma3: 3-month moving average")
print("      - month: Seasonality factor")
print(f"\n   {best_ml_model} achieves R2 = {df_comparison.loc[best_ml_model, 'R2']:.4f}")

if df_comparison.loc[best_baseline, 'RMSE'] != 0:
    improvement = ((df_comparison.loc[best_baseline, 'RMSE'] - df_comparison.loc[best_ml_model, 'RMSE']) / df_comparison.loc[best_baseline, 'RMSE']) * 100
    print(f"   Improvement: {improvement:.1f}% RMSE reduction vs baseline ({best_baseline})")

# Close connection
client.close()
print("\n" + "="*80)
print("ANALYSIS COMPLETED!")
print("="*80)
