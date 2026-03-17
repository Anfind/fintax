const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');

// GET /api/invoices?page=1&limit=20&type=sale&status=new&from=&to=&search=
exports.getInvoices = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const match = { company_id: companyId };

    if (req.query.type) match.type = req.query.type;
    if (req.query.status) match.status = req.query.status;
    if (req.query.from) match.invoiceDate = { $gte: new Date(`${req.query.from}`) };
    if (req.query.to) {
      match.invoiceDate = { ...(match.invoiceDate || {}), $lte: new Date(`${req.query.to}T23:59:59`) };
    }
    if (req.query.search) {
      match.$or = [
        { 'buyer.name': { $regex: req.query.search, $options: 'i' } },
        { 'seller.name': { $regex: req.query.search, $options: 'i' } },
        { invoiceNumber: { $regex: req.query.search, $options: 'i' } },
        { 'buyer.taxCode': { $regex: req.query.search, $options: 'i' } },
        { 'seller.taxCode': { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const sortField = req.query.sort || 'invoiceDate';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    const [invoices, total] = await Promise.all([
      Invoice.find(match).sort({ [sortField]: sortOrder }).skip(skip).limit(limit).lean(),
      Invoice.countDocuments(match),
    ]);

    res.json({
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/invoices/:id
exports.getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      company_id: req.user.company_id,
    }).lean();

    if (!invoice) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });

    const items = await InvoiceItem.find({ invoice_id: invoice._id }).lean();

    res.json({ data: { ...invoice, items } });
  } catch (error) {
    next(error);
  }
};

// GET /api/invoices/export-csv?type=sale&from=&to=
exports.exportCSV = async (req, res, next) => {
  try {
    const match = { company_id: req.user.company_id };
    if (req.query.type) match.type = req.query.type;
    if (req.query.from) match.invoiceDate = { $gte: new Date(req.query.from) };
    if (req.query.to) {
      match.invoiceDate = { ...(match.invoiceDate || {}), $lte: new Date(`${req.query.to}T23:59:59`) };
    }

    const invoices = await Invoice.find(match).sort({ invoiceDate: -1 }).lean();

    const header = 'Loai,So HD,Ky hieu,Ngay,Nguoi ban,MST ban,Nguoi mua,MST mua,Tien chua thue,Thue,Tong tien,Trang thai';
    const rows = invoices.map((inv) => {
      const escapeCsv = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
      return [
        inv.type === 'sale' ? 'Ban ra' : 'Mua vao',
        escapeCsv(inv.invoiceNumber),
        escapeCsv(inv.invoiceSymbol),
        inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('vi-VN') : '',
        escapeCsv(inv.seller?.name),
        inv.seller?.taxCode || '',
        escapeCsv(inv.buyer?.name),
        inv.buyer?.taxCode || '',
        inv.subtotal,
        inv.taxAmount,
        inv.totalAmount,
        inv.status,
      ].join(',');
    });

    const csv = '\uFEFF' + header + '\n' + rows.join('\n'); // BOM for UTF-8 in Excel
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=invoices_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
