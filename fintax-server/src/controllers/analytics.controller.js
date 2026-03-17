const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const InvoiceAnalytics = require('../models/InvoiceAnalytics');

// GET /api/analytics/overview?from=2025-01&to=2025-06
exports.getOverview = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });

    const { from, to } = req.query;
    const match = { company_id: companyId };

    if (from || to) {
      match.invoiceDate = {};
      if (from) match.invoiceDate.$gte = new Date(`${from}-01`);
      if (to) {
        const [y, m] = to.split('-').map(Number);
        match.invoiceDate.$lte = new Date(y, m, 0, 23, 59, 59);
      }
    }

    // Sales aggregation
    const salesAgg = await Invoice.aggregate([
      { $match: { ...match, type: 'sale' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalTax: { $sum: '$taxAmount' },
          count: { $sum: 1 },
          avgValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    // Purchase aggregation
    const purchaseAgg = await Invoice.aggregate([
      { $match: { ...match, type: 'purchase' } },
      {
        $group: {
          _id: null,
          totalExpense: { $sum: '$totalAmount' },
          totalTax: { $sum: '$taxAmount' },
          count: { $sum: 1 },
          avgValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    const sales = salesAgg[0] || { totalRevenue: 0, totalTax: 0, count: 0, avgValue: 0 };
    const purchases = purchaseAgg[0] || { totalExpense: 0, totalTax: 0, count: 0, avgValue: 0 };

    // Previous period for growth calculation
    let prevSales = { totalRevenue: 0 };
    let prevPurchases = { totalExpense: 0 };

    if (from && to) {
      const fromDate = new Date(`${from}-01`);
      const toDate = new Date(`${to}-01`);
      const diffMs = toDate - fromDate;
      const prevFrom = new Date(fromDate - diffMs);
      const prevTo = new Date(fromDate - 1);

      const prevMatch = { company_id: companyId, invoiceDate: { $gte: prevFrom, $lte: prevTo } };

      const prevSalesAgg = await Invoice.aggregate([
        { $match: { ...prevMatch, type: 'sale' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]);
      const prevPurchaseAgg = await Invoice.aggregate([
        { $match: { ...prevMatch, type: 'purchase' } },
        { $group: { _id: null, totalExpense: { $sum: '$totalAmount' } } },
      ]);
      prevSales = prevSalesAgg[0] || { totalRevenue: 0 };
      prevPurchases = prevPurchaseAgg[0] || { totalExpense: 0 };
    }

    const profitGross = sales.totalRevenue - purchases.totalExpense;
    const prevProfit = prevSales.totalRevenue - prevPurchases.totalExpense;

    const calcGrowth = (curr, prev) => (prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100);

    res.json({
      revenue: {
        total: sales.totalRevenue,
        tax: sales.totalTax,
        count: sales.count,
        avg: sales.avgValue,
        growth: parseFloat(calcGrowth(sales.totalRevenue, prevSales.totalRevenue).toFixed(1)),
      },
      expense: {
        total: purchases.totalExpense,
        tax: purchases.totalTax,
        count: purchases.count,
        avg: purchases.avgValue,
        growth: parseFloat(calcGrowth(purchases.totalExpense, prevPurchases.totalExpense).toFixed(1)),
      },
      profit: {
        total: profitGross,
        growth: parseFloat(calcGrowth(profitGross, prevProfit).toFixed(1)),
      },
      invoiceCount: sales.count + purchases.count,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/revenue-trend?from=2025-01&to=2025-06
exports.getRevenueTrend = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });
    const { from, to } = req.query;
    const match = { company_id: companyId };

    if (from) match.invoiceDate = { ...(match.invoiceDate || {}), $gte: new Date(`${from}-01`) };
    if (to) {
      const [y, m] = to.split('-').map(Number);
      match.invoiceDate = { ...(match.invoiceDate || {}), $lte: new Date(y, m, 0, 23, 59, 59) };
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' },
            type: '$type',
          },
          total: { $sum: '$totalAmount' },
          tax: { $sum: '$taxAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ];

    const result = await Invoice.aggregate(pipeline);

    // Transform to chart-friendly format
    const monthMap = {};
    result.forEach((r) => {
      const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { period: key, revenue: 0, expense: 0, revenueTax: 0, expenseTax: 0, revenueCount: 0, expenseCount: 0 };
      if (r._id.type === 'sale') {
        monthMap[key].revenue = r.total;
        monthMap[key].revenueTax = r.tax;
        monthMap[key].revenueCount = r.count;
      } else {
        monthMap[key].expense = r.total;
        monthMap[key].expenseTax = r.tax;
        monthMap[key].expenseCount = r.count;
      }
    });

    const data = Object.values(monthMap).map((m) => ({
      ...m,
      profit: m.revenue - m.expense,
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/top-customers?from=&to=&limit=10
exports.getTopCustomers = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });
    const limit = parseInt(req.query.limit) || 10;
    const match = { company_id: companyId, type: 'sale' };

    if (req.query.from) match.invoiceDate = { $gte: new Date(`${req.query.from}-01`) };
    if (req.query.to) {
      const [y, m] = req.query.to.split('-').map(Number);
      match.invoiceDate = { ...(match.invoiceDate || {}), $lte: new Date(y, m, 0, 23, 59, 59) };
    }

    const result = await Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: { name: '$buyer.name', taxCode: '$buyer.taxCode' },
          totalAmount: { $sum: '$totalAmount' },
          invoiceCount: { $sum: 1 },
          avgAmount: { $avg: '$totalAmount' },
          lastDate: { $max: '$invoiceDate' },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          name: '$_id.name',
          taxCode: '$_id.taxCode',
          totalAmount: 1,
          invoiceCount: 1,
          avgAmount: 1,
          lastDate: 1,
        },
      },
    ]);

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/top-suppliers?from=&to=&limit=10
exports.getTopSuppliers = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });
    const limit = parseInt(req.query.limit) || 10;
    const match = { company_id: companyId, type: 'purchase' };

    if (req.query.from) match.invoiceDate = { $gte: new Date(`${req.query.from}-01`) };
    if (req.query.to) {
      const [y, m] = req.query.to.split('-').map(Number);
      match.invoiceDate = { ...(match.invoiceDate || {}), $lte: new Date(y, m, 0, 23, 59, 59) };
    }

    const result = await Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: { name: '$seller.name', taxCode: '$seller.taxCode' },
          totalAmount: { $sum: '$totalAmount' },
          invoiceCount: { $sum: 1 },
          avgAmount: { $avg: '$totalAmount' },
          lastDate: { $max: '$invoiceDate' },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          name: '$_id.name',
          taxCode: '$_id.taxCode',
          totalAmount: 1,
          invoiceCount: 1,
          avgAmount: 1,
          lastDate: 1,
        },
      },
    ]);

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/tax-distribution?from=&to=
exports.getTaxDistribution = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });
    const match = { company_id: companyId };

    if (req.query.from) match.invoiceDate = { $gte: new Date(`${req.query.from}-01`) };
    if (req.query.to) {
      const [y, m] = req.query.to.split('-').map(Number);
      match.invoiceDate = { ...(match.invoiceDate || {}), $lte: new Date(y, m, 0, 23, 59, 59) };
    }

    const result = await InvoiceItem.aggregate([
      { $match: { company_id: companyId } },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoice_id',
          foreignField: '_id',
          as: 'invoice',
        },
      },
      { $unwind: '$invoice' },
      { $match: {
        'invoice.company_id': companyId,
        ...(match.invoiceDate ? { 'invoice.invoiceDate': match.invoiceDate } : {}),
      } },
      {
        $group: {
          _id: '$taxRate',
          totalTax: { $sum: '$taxAmount' },
          totalPreTax: { $sum: '$preTaxAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalTax: -1 } },
      {
        $project: {
          _id: 0,
          taxRate: '$_id',
          totalTax: 1,
          totalPreTax: 1,
          count: 1,
        },
      },
    ]);

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/invoice-status?from=&to=
exports.getInvoiceStatus = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });
    const match = { company_id: companyId };

    if (req.query.from) match.invoiceDate = { $gte: new Date(`${req.query.from}-01`) };
    if (req.query.to) {
      const [y, m] = req.query.to.split('-').map(Number);
      match.invoiceDate = { ...(match.invoiceDate || {}), $lte: new Date(y, m, 0, 23, 59, 59) };
    }

    const result = await Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: { status: '$status', type: '$type' },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
      {
        $project: {
          _id: 0,
          status: '$_id.status',
          type: '$_id.type',
          count: 1,
          totalAmount: 1,
        },
      },
    ]);

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/strategic-metrics?from=&to=&limit=5
exports.getStrategicMetrics = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: 'Chưa liên kết công ty' });

    const match = { company_id: companyId };
    const limit = Math.max(3, parseInt(req.query.limit, 10) || 5);

    const latestInvoice = await Invoice.findOne({ company_id: companyId })
      .sort({ invoiceDate: -1 })
      .select('invoiceDate')
      .lean();

    const anchor = latestInvoice?.invoiceDate ? new Date(latestInvoice.invoiceDate) : new Date();

    const parseStart = (value) => {
      if (!value) return null;
      const [y, m] = String(value).split('-').map(Number);
      if (!y || !m) return null;
      return new Date(Date.UTC(y, m - 1, 1));
    };

    const parseEnd = (value) => {
      if (!value) return null;
      const [y, m] = String(value).split('-').map(Number);
      if (!y || !m) return null;
      return new Date(Date.UTC(y, m, 0, 23, 59, 59));
    };

    const rangeStart = parseStart(req.query.from)
      || new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 11, 1));
    const rangeEnd = parseEnd(req.query.to)
      || new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 23, 59, 59));

    match.invoiceDate = { $gte: rangeStart, $lte: rangeEnd };

    const monthlyAgg = await Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' },
            type: '$type',
          },
          totalAmount: { $sum: '$totalAmount' },
          totalTax: { $sum: '$taxAmount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const customerAgg = await Invoice.aggregate([
      { $match: { ...match, type: 'sale' } },
      {
        $group: {
          _id: { name: '$buyer.name', taxCode: '$buyer.taxCode' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const supplierAgg = await Invoice.aggregate([
      { $match: { ...match, type: 'purchase' } },
      {
        $group: {
          _id: { name: '$seller.name', taxCode: '$seller.taxCode' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const monthMap = {};
    for (const row of monthlyAgg) {
      const period = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
      if (!monthMap[period]) {
        monthMap[period] = {
          period,
          inflow: 0,
          outflow: 0,
          outputTax: 0,
          inputTax: 0,
        };
      }
      if (row._id.type === 'sale') {
        monthMap[period].inflow = row.totalAmount;
        monthMap[period].outputTax = row.totalTax;
      } else {
        monthMap[period].outflow = row.totalAmount;
        monthMap[period].inputTax = row.totalTax;
      }
    }

    const monthlyData = [];
    const cursor = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1));
    const endCursor = new Date(Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), 1));

    while (cursor <= endCursor) {
      const period = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
      const base = monthMap[period] || {
        period,
        inflow: 0,
        outflow: 0,
        outputTax: 0,
        inputTax: 0,
      };

      const net = base.inflow - base.outflow;
      const marginPct = base.inflow > 0 ? (net / base.inflow) * 100 : 0;
      const netTax = base.outputTax - base.inputTax;
      const taxBurdenPct = base.inflow > 0 ? (netTax / base.inflow) * 100 : 0;

      monthlyData.push({
        period,
        inflow: base.inflow,
        outflow: base.outflow,
        net,
        marginPct: parseFloat(marginPct.toFixed(2)),
        outputTax: base.outputTax,
        inputTax: base.inputTax,
        netTax,
        taxBurdenPct: parseFloat(taxBurdenPct.toFixed(2)),
      });

      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const buildConcentration = (items) => {
      const total = items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
      const top = items.slice(0, limit).map((item) => {
        const share = total > 0 ? ((item.totalAmount || 0) / total) * 100 : 0;
        return {
          name: item._id?.name || 'N/A',
          taxCode: item._id?.taxCode || '',
          totalAmount: item.totalAmount || 0,
          sharePct: parseFloat(share.toFixed(2)),
        };
      });
      const topSharePct = top.reduce((sum, item) => sum + item.sharePct, 0);
      const hhi = items.reduce((sum, item) => {
        const share = total > 0 ? (item.totalAmount || 0) / total : 0;
        return sum + share * share;
      }, 0);

      return {
        totalAmount: total,
        topSharePct: parseFloat(topSharePct.toFixed(2)),
        hhi: parseFloat(hhi.toFixed(4)),
        top,
      };
    };

    res.json({
      data: {
        cashflow: monthlyData.map((m) => ({ period: m.period, inflow: m.inflow, outflow: m.outflow, net: m.net })),
        marginTrend: monthlyData.map((m) => ({ period: m.period, marginPct: m.marginPct, revenue: m.inflow, profit: m.net })),
        taxBurdenTrend: monthlyData.map((m) => ({
          period: m.period,
          outputTax: m.outputTax,
          inputTax: m.inputTax,
          netTax: m.netTax,
          taxBurdenPct: m.taxBurdenPct,
        })),
        customerConcentration: buildConcentration(customerAgg),
        supplierDependency: buildConcentration(supplierAgg),
      },
    });
  } catch (error) {
    next(error);
  }
};
