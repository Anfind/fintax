import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, ChevronLeft, ChevronRight, Download, Eye, X,
  ArrowUpDown, FileText, Calendar, Building2, Hash
} from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/services/api';
import { formatVND } from '@/lib/utils';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  invoiceSymbol: string;
  invoiceDate: string;
  type: 'sale' | 'purchase';
  seller: { name: string; taxCode: string };
  buyer: { name: string; taxCode: string };
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
  paymentMethod: string;
}

interface InvoiceDetail extends Invoice {
  items: {
    productName: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    preTaxAmount: number;
    taxRate: number;
    taxAmount: number;
  }[];
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  replaced: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  adjusted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusLabels: Record<string, string> = {
  new: 'Mới',
  replaced: 'Thay thế',
  adjusted: 'Điều chỉnh',
  cancelled: 'Đã hủy',
};

const typeLabels: Record<string, string> = {
  sale: 'Bán ra',
  purchase: 'Mua vào',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortField, setSortField] = useState('invoiceDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        limit: 15,
        sort: sortField,
        order: sortOrder,
      };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/invoices', { params });
      setInvoices(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    } catch (err) {
      console.error('Fetch invoices error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter, sortField, sortOrder]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/invoices/${id}`);
      setSelectedInvoice(res.data.data);
    } catch (err) {
      console.error('Fetch invoice detail error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <ArrowUpDown
      size={14}
      className={`inline ml-1 cursor-pointer transition-colors ${
        sortField === field ? 'text-blue-400' : 'text-slate-600'
      }`}
      onClick={() => toggleSort(field)}
    />
  );

  return (
    <>
      <Header title="Hóa đơn" subtitle="Quản lý và tra cứu toàn bộ hóa đơn điện tử" />

      <div className="p-6 md:p-8 space-y-6">
        {/* Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"
        >
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm theo số hóa đơn, tên, mã số thuế..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Filter size={16} />
              <span>Lọc:</span>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="">Tất cả loại</option>
              <option value="sale">Bán ra</option>
              <option value="purchase">Mua vào</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="new">Mới</option>
              <option value="replaced">Thay thế</option>
              <option value="adjusted">Điều chỉnh</option>
              <option value="cancelled">Đã hủy</option>
            </select>
            <button
              onClick={() => {
                const params = new URLSearchParams();
                if (typeFilter) params.set('type', typeFilter);
                window.open(`/api/invoices/export-csv?${params.toString()}`, '_blank');
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 text-sm transition-all"
            >
              <Download size={16} />
              Xuất CSV
            </button>
          </div>
        </motion.div>

        {/* Summary */}
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>Tổng: <strong className="text-white font-mono-numbers">{total.toLocaleString()}</strong> hóa đơn</span>
          <span>·</span>
          <span>Trang <strong className="text-white">{page}</strong>/{totalPages}</span>
        </div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-2xl overflow-hidden border border-white/[0.06]"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    { label: 'Số HĐ', field: 'invoiceNumber', width: 'w-28' },
                    { label: 'Ngày', field: 'invoiceDate', width: 'w-28' },
                    { label: 'Loại', field: 'type', width: 'w-24' },
                    { label: 'Đối tác', field: '', width: 'w-52' },
                    { label: 'MST', field: '', width: 'w-32' },
                    { label: 'Tổng tiền', field: 'totalAmount', width: 'w-36' },
                    { label: 'Thuế', field: 'taxAmount', width: 'w-32' },
                    { label: 'Trạng thái', field: 'status', width: 'w-28' },
                    { label: '', field: '', width: 'w-16' },
                  ].map((col) => (
                    <th
                      key={col.label || 'action'}
                      className={`${col.width} px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider`}
                    >
                      {col.label}
                      {col.field && <SortIcon field={col.field} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/[0.04]">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-white/5 rounded animate-pulse" style={{ width: `${50 + Math.random() * 50}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                      <p className="text-slate-400 text-sm">Không tìm thấy hóa đơn nào</p>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv, idx) => (
                    <motion.tr
                      key={inv._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      onClick={() => openDetail(inv._id)}
                    >
                      <td className="px-4 py-3.5 text-sm font-mono-numbers text-blue-400 font-medium">
                        {inv.invoiceNumber || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-300 font-mono-numbers flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-500" />
                        {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            inv.type === 'sale'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          }`}
                        >
                          {typeLabels[inv.type] || inv.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-white max-w-[200px] truncate">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-slate-500 shrink-0" />
                          {(inv.type === 'sale' ? inv.buyer?.name : inv.seller?.name) || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 font-mono-numbers">
                        <div className="flex items-center gap-1.5">
                          <Hash size={14} className="text-slate-600" />
                          {(inv.type === 'sale' ? inv.buyer?.taxCode : inv.seller?.taxCode) || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-white font-mono-numbers font-semibold">
                        {formatVND(inv.totalAmount)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-red-400 font-mono-numbers">
                        {formatVND(inv.taxAmount)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            statusColors[inv.status] || statusColors.new
                          }`}
                        >
                          {statusLabels[inv.status] || inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button className="p-1.5 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all">
                          <Eye size={16} className="text-slate-400" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
              <p className="text-sm text-slate-500">
                Hiển thị {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} / {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"
                >
                  <ChevronLeft size={18} className="text-slate-400" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                        p === page
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                          : 'text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"
                >
                  <ChevronRight size={18} className="text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedInvoice(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto glass-card rounded-2xl border border-white/[0.08] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Modal Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <FileText size={22} className="text-blue-400" />
                        Hóa đơn #{selectedInvoice.invoiceNumber}
                      </h2>
                      <p className="text-slate-400 text-sm mt-1">
                        Ký hiệu: {selectedInvoice.invoiceSymbol || '—'} · {' '}
                        {selectedInvoice.invoiceDate
                          ? new Date(selectedInvoice.invoiceDate).toLocaleDateString('vi-VN')
                          : '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedInvoice(null)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>

                  {/* Seller / Buyer Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Bên bán</p>
                      <p className="text-white font-medium">{selectedInvoice.seller?.name || '—'}</p>
                      <p className="text-slate-400 text-sm">MST: {selectedInvoice.seller?.taxCode || '—'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Bên mua</p>
                      <p className="text-white font-medium">{selectedInvoice.buyer?.name || '—'}</p>
                      <p className="text-slate-400 text-sm">MST: {selectedInvoice.buyer?.taxCode || '—'}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-slate-400 mb-3">Hàng hóa / Dịch vụ</h3>
                      <div className="rounded-xl overflow-hidden border border-white/[0.06]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-white/[0.03]">
                              <th className="px-3 py-2.5 text-left text-xs text-slate-500 font-medium">Tên</th>
                              <th className="px-3 py-2.5 text-right text-xs text-slate-500 font-medium">SL</th>
                              <th className="px-3 py-2.5 text-right text-xs text-slate-500 font-medium">Đơn giá</th>
                              <th className="px-3 py-2.5 text-right text-xs text-slate-500 font-medium">Thành tiền</th>
                              <th className="px-3 py-2.5 text-right text-xs text-slate-500 font-medium">Thuế</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedInvoice.items.map((item, i) => (
                              <tr key={i} className="border-t border-white/[0.04]">
                                <td className="px-3 py-2.5 text-white">{item.productName}</td>
                                <td className="px-3 py-2.5 text-right text-slate-300 font-mono-numbers">
                                  {item.quantity?.toLocaleString() || '—'}
                                </td>
                                <td className="px-3 py-2.5 text-right text-slate-300 font-mono-numbers">
                                  {formatVND(item.unitPrice)}
                                </td>
                                <td className="px-3 py-2.5 text-right text-white font-mono-numbers font-medium">
                                  {formatVND(item.preTaxAmount)}
                                </td>
                                <td className="px-3 py-2.5 text-right text-red-400 font-mono-numbers">
                                  {formatVND(item.taxAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-72 space-y-2 text-sm">
                      <div className="flex justify-between text-slate-400">
                        <span>Tiền trước thuế:</span>
                        <span className="font-mono-numbers text-white">{formatVND(selectedInvoice.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Thuế GTGT:</span>
                        <span className="font-mono-numbers text-red-400">{formatVND(selectedInvoice.taxAmount)}</span>
                      </div>
                      <div className="flex justify-between text-white font-semibold pt-2 border-t border-white/10">
                        <span>Tổng thanh toán:</span>
                        <span className="font-mono-numbers text-lg text-blue-400">
                          {formatVND(selectedInvoice.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
