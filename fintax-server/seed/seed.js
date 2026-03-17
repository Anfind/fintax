/**
 * FinTax Seed Script — Generates realistic Vietnamese invoice data
 *
 * Seeds BOTH databases:
 *   1. fintax_crawler: HoaDonBanRa (~1500 rows) + HoaDonMuaVao (~500 rows)
 *   2. fintax_web: Company (1) + Users (3)
 *
 * After seeding, run sync to populate fintax_web.invoices + invoice_items.
 *
 * Usage:
 *   cd fintax-server
 *   node seed/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../src/config/env');

// ═══════════════════════════════════════════════════════════
// ─── CONFIG ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
const COMPANY = {
  name: 'CÔNG TY CỔ PHẦN GIÁM ĐỊNH & TƯ VẤN VIỆT',
  taxCode: '0302147168',
  address: 'SAV.8-20.13 Tầng 20, Tháp 2, Khu Sài Gòn Avenue, 10 Đại lộ Bình Dương, P. Thuận Giao, TP. Thuận An, Bình Dương',
  industry: 'Giám định & Tư vấn kỹ thuật',
};

const USERS = [
  { email: 'admin@fintax.vn', password: 'Admin@123', fullName: 'Nguyễn Thái An', role: 'admin' },
  { email: 'ketoan@fintax.vn', password: 'Ketoan@123', fullName: 'Trần Thanh Hà', role: 'accountant' },
  { email: 'viewer@fintax.vn', password: 'Viewer@123', fullName: 'Lê Minh Quân', role: 'viewer' },
];

// 24 months of data: Jan 2024 → Dec 2025
const START_YEAR = 2024;
const END_YEAR = 2025;

// ═══════════════════════════════════════════════════════════
// ─── REALISTIC DATA POOLS ─────────────────────────────────
// ═══════════════════════════════════════════════════════════
const CUSTOMERS = [
  { name: 'CÔNG TY CỔ PHẦN LILAMA 10', taxCode: '5400101273', address: 'KCN Phú Mỹ 1, TX Phú Mỹ, Bà Rịa - Vũng Tàu' },
  { name: 'TỔNG CÔNG TY ĐIỆN LỰC MIỀN NAM', taxCode: '0301864857', address: '72 Hai Bà Trưng, Quận 1, TP.HCM' },
  { name: 'CÔNG TY CỔ PHẦN XÂY LẮP DẦU KHÍ MIỀN NAM', taxCode: '0302047076', address: '46 Hoàng Diệu, Quận 4, TP.HCM' },
  { name: 'CÔNG TY TNHH SAMSUNG ELECTRONICS VIỆT NAM', taxCode: '0101735053', address: 'KCN Yên Phong, Bắc Ninh' },
  { name: 'CÔNG TY CỔ PHẦN THÉP HÒA PHÁT', taxCode: '0800379968', address: 'KCN Phúc Điền, Cẩm Giàng, Hải Dương' },
  { name: 'TỔNG CÔNG TY CƠ ĐIỆN XÂY DỰNG - AGRIMECO', taxCode: '0100100115', address: '214 Nguyễn Xiển, Thanh Xuân, Hà Nội' },
  { name: 'CÔNG TY CỔ PHẦN KỸ THUẬT DẦU KHÍ VIỆT NAM', taxCode: '0300455997', address: '21 - 23 Nguyễn Thị Minh Khai, Quận 1, TP.HCM' },
  { name: 'CÔNG TY CỔ PHẦN CƠ ĐIỆN LẠNH REE', taxCode: '0300104809', address: '364 Cộng Hòa, Quận Tân Bình, TP.HCM' },
  { name: 'CÔNG TY TNHH BOSCH VIỆT NAM', taxCode: '3700456287', address: 'Lô I-6 đường D4, KCN Long Hậu, Long An' },
  { name: 'CÔNG TY CỔ PHẦN XÂY DỰNG COTECCONS', taxCode: '0302563840', address: '236/6 Điện Biên Phủ, Quận 3, TP.HCM' },
  { name: 'CÔNG TY CP ĐẦU TƯ XÂY DỰNG TRUNG NAM', taxCode: '4200606373', address: '165 Thái Hà, Đống Đa, Hà Nội' },
  { name: 'CÔNG TY CỔ PHẦN NHIỆT ĐIỆN PHẢ LẠI', taxCode: '0800213042', address: 'TT Phả Lại, Chí Linh, Hải Dương' },
  { name: 'CÔNG TY TNHH MTV TỔNG CÔNG TY PHÁT ĐIỆN 3', taxCode: '0102116407', address: '10 Tràng Thi, Hoàn Kiếm, Hà Nội' },
  { name: 'CÔNG TY CP DỊCH VỤ KỸ THUẬT VIỄN THÔNG', taxCode: '0100101089', address: '57 Huỳnh Thúc Kháng, Đống Đa, Hà Nội' },
  { name: 'TỔNG CÔNG TY LẮP MÁY VIỆT NAM - LILAMA', taxCode: '0100106577', address: 'Số 2 Nguyễn Văn Lộc, Hà Đông, Hà Nội' },
  { name: 'CÔNG TY CỔ PHẦN ĐẠI LÝ HÀNG HẢI VIỆT NAM', taxCode: '0300476893', address: '6 Đoàn Văn Bơ, Quận 4, TP.HCM' },
  { name: 'CÔNG TY CỔ PHẦN SIAM CEMENT GROUP VIỆT NAM', taxCode: '3600272476', address: 'KCN Mỹ Xuân A2, Tân Thành, Bà Rịa – Vũng Tàu' },
  { name: 'CÔNG TY CP XI MĂNG HÀ TIÊN 1', taxCode: '0300357846', address: '360 Bến Chương Dương, Quận 1, TP.HCM' },
  { name: 'CÔNG TY CP ĐIỆN GIÓ BẠC LIÊU', taxCode: '1301466858', address: 'QL1A, Vĩnh Trạch Đông, TP Bạc Liêu' },
  { name: 'CÔNG TY TNHH HYUNDAI ENGINEERING VIỆT NAM', taxCode: '0310367891', address: 'Lầu 12, Tòa nhà Lim Tower, 9-11 Tôn Đức Thắng, Q.1, TP.HCM' },
];

const SUPPLIERS = [
  { name: 'CÔNG TY TNHH THIẾT BỊ ĐO LƯỜNG HỒNG ĐỨC', taxCode: '0315987623', address: '45 Nguyễn Huệ, Quận 1, TP.HCM' },
  { name: 'CÔNG TY CP VẬT TƯ KỸ THUẬT SAIGON', taxCode: '0302345678', address: '123 Hai Bà Trưng, Quận 3, TP.HCM' },
  { name: 'CÔNG TY TNHH TM DV VĂN PHÒNG PHẨM PHÚ THỊNH', taxCode: '0312456789', address: '78 Lý Thường Kiệt, Quận 10, TP.HCM' },
  { name: 'CÔNG TY CP DỊCH VỤ BẢO TRÌ CÔNG NGHIỆP IMECO', taxCode: '0302987654', address: '256 Nguyễn Thị Minh Khai, Quận 3, TP.HCM' },
  { name: 'CÔNG TY TNHH PHẦN MỀM FPT SOFTWARE', taxCode: '0101245000', address: 'FPT Cầu Giấy, Duy Tân, Hà Nội' },
  { name: 'CÔNG TY TNHH DV AN NINH BẢO VỆ LONG HẢI', taxCode: '0314567890', address: '90 Trần Hưng Đạo, Quận 5, TP.HCM' },
  { name: 'CÔNG TY TNHH VẬN TẢI & LOGISTICS TÂN CẢNG', taxCode: '0301234567', address: 'Cảng Cát Lái, TP Thủ Đức, TP.HCM' },
  { name: 'CÔNG TY CP THIẾT BỊ AN TOÀN SAFETECH', taxCode: '0308765432', address: '34 Tôn Đức Thắng, Quận 1, TP.HCM' },
  { name: 'CÔNG TY TNHH TM XĂNG DẦU PETROLIMEX SÀI GÒN', taxCode: '0300387654', address: '15 Lê Duẩn, Quận 1, TP.HCM' },
  { name: 'CÔNG TY CP ĐIỆN NƯỚC LẮP MÁY HẢI PHÒNG', taxCode: '0200654321', address: 'Số 5 Hoàng Văn Thụ, Hồng Bàng, Hải Phòng' },
  { name: 'CÔNG TY TNHH IN ẤN & QUẢNG CÁO MINH PHÁT', taxCode: '0313456781', address: '167 Phan Xích Long, Phú Nhuận, TP.HCM' },
  { name: 'CÔNG TY CP DỊCH VỤ THUÊ NGOÀI NHÂN SỰ MANPOWER', taxCode: '0310112233', address: 'VNPT Building, 57 Huỳnh Thúc Kháng, Q.1, TP.HCM' },
  { name: 'CÔNG TY TNHH BẢO HIỂM BẢO VIỆT TOKIO MARINE', taxCode: '0102233445', address: '35 Hai Bà Trưng, Hoàn Kiếm, Hà Nội' },
  { name: 'CÔNG TY TNHH KẾ TOÁN & KIỂM TOÁN AAC', taxCode: '0401567890', address: '217 Nguyễn Văn Linh, Đà Nẵng' },
  { name: 'CÔNG TY CP VIỄN THÔNG VNPT TP.HCM', taxCode: '0300467895', address: '1 Nguyễn Văn Thủ, Quận 1, TP.HCM' },
];

// Sản phẩm/dịch vụ BÁN RA (Giám định & Tư vấn kỹ thuật)
const SALE_PRODUCTS = [
  { name: 'Kiểm định cần trục tháp', unit: 'Thiết bị', priceMin: 2000000, priceMax: 15000000 },
  { name: 'Kiểm định cần xiết lực', unit: 'Cái', priceMin: 800000, priceMax: 3000000 },
  { name: 'Kiểm định thang máy', unit: 'Thiết bị', priceMin: 3000000, priceMax: 8000000 },
  { name: 'Kiểm định nồi hơi', unit: 'Thiết bị', priceMin: 5000000, priceMax: 20000000 },
  { name: 'Kiểm định bình áp lực', unit: 'Bình', priceMin: 1000000, priceMax: 5000000 },
  { name: 'Kiểm định hệ thống điện công trình', unit: 'Hệ thống', priceMin: 10000000, priceMax: 50000000 },
  { name: 'Hiệu chuẩn thiết bị đo áp suất', unit: 'Thiết bị', priceMin: 500000, priceMax: 2000000 },
  { name: 'Hiệu chuẩn thiết bị đo nhiệt độ', unit: 'Thiết bị', priceMin: 300000, priceMax: 1500000 },
  { name: 'Hiệu chuẩn thiết bị đo lưu lượng', unit: 'Thiết bị', priceMin: 1000000, priceMax: 4000000 },
  { name: 'Hiệu chuẩn cân điện tử', unit: 'Cái', priceMin: 200000, priceMax: 800000 },
  { name: 'Giám sát thi công công trình điện', unit: 'Công trình', priceMin: 20000000, priceMax: 80000000 },
  { name: 'Giám sát lắp đặt thiết bị cơ khí', unit: 'Gói', priceMin: 15000000, priceMax: 60000000 },
  { name: 'Tư vấn an toàn lao động', unit: 'Gói', priceMin: 5000000, priceMax: 25000000 },
  { name: 'Đánh giá hệ thống quản lý chất lượng ISO', unit: 'Gói', priceMin: 10000000, priceMax: 40000000 },
  { name: 'Kiểm tra không phá hủy NDT', unit: 'Mối hàn', priceMin: 150000, priceMax: 500000 },
  { name: 'Kiểm tra siêu âm (UT) đường ống', unit: 'Mét', priceMin: 50000, priceMax: 200000 },
  { name: 'Kiểm tra bằng chụp phim (RT)', unit: 'Phim', priceMin: 200000, priceMax: 800000 },
  { name: 'Tư vấn thiết kế hệ thống PCCC', unit: 'Gói', priceMin: 8000000, priceMax: 35000000 },
  { name: 'Kiểm định xe nâng hàng', unit: 'Xe', priceMin: 1500000, priceMax: 4000000 },
  { name: 'Kiểm định hệ thống khí nén', unit: 'Hệ thống', priceMin: 3000000, priceMax: 12000000 },
  { name: 'Đào tạo an toàn vận hành thiết bị nâng', unit: 'Khóa', priceMin: 5000000, priceMax: 15000000 },
  { name: 'Thử tải cầu trục', unit: 'Lần', priceMin: 8000000, priceMax: 25000000 },
  { name: 'Kiểm tra hệ thống chống sét', unit: 'Hệ thống', priceMin: 2000000, priceMax: 8000000 },
  { name: 'Tư vấn giám sát an toàn công trình xây dựng', unit: 'Tháng', priceMin: 15000000, priceMax: 45000000 },
];

// Sản phẩm/dịch vụ MUA VÀO
const PURCHASE_PRODUCTS = [
  { name: 'Bộ thiết bị đo lường hiệu chuẩn', unit: 'Bộ', priceMin: 5000000, priceMax: 50000000 },
  { name: 'Phim chụp X-Ray công nghiệp', unit: 'Hộp', priceMin: 2000000, priceMax: 8000000 },
  { name: 'Đầu dò siêu âm UT', unit: 'Cái', priceMin: 3000000, priceMax: 15000000 },
  { name: 'Văn phòng phẩm', unit: 'Bộ', priceMin: 200000, priceMax: 2000000 },
  { name: 'Mực in & Giấy in', unit: 'Bộ', priceMin: 300000, priceMax: 3000000 },
  { name: 'Dịch vụ bảo trì máy tính & thiết bị', unit: 'Gói', priceMin: 1000000, priceMax: 5000000 },
  { name: 'Thuê xe ô tô đi dự án', unit: 'Ngày', priceMin: 800000, priceMax: 2500000 },
  { name: 'Xăng dầu', unit: 'Lít', priceMin: 500000, priceMax: 5000000 },
  { name: 'Bảo hiểm trách nhiệm nghề nghiệp', unit: 'Gói', priceMin: 10000000, priceMax: 30000000 },
  { name: 'Phí đào tạo nâng cao chuyên môn', unit: 'Khóa', priceMin: 3000000, priceMax: 15000000 },
  { name: 'Thiết bị bảo hộ lao động', unit: 'Bộ', priceMin: 500000, priceMax: 3000000 },
  { name: 'Dịch vụ thuê ngoài nhân sự kỹ thuật', unit: 'Người/tháng', priceMin: 8000000, priceMax: 20000000 },
  { name: 'Phần mềm quản lý báo cáo kiểm định', unit: 'License', priceMin: 5000000, priceMax: 30000000 },
  { name: 'Dịch vụ viễn thông & Internet', unit: 'Tháng', priceMin: 500000, priceMax: 3000000 },
  { name: 'Thuê văn phòng làm việc', unit: 'Tháng', priceMin: 15000000, priceMax: 40000000 },
  { name: 'Dịch vụ kế toán & kiểm toán', unit: 'Gói', priceMin: 5000000, priceMax: 20000000 },
  { name: 'Dịch vụ bảo vệ', unit: 'Tháng', priceMin: 3000000, priceMax: 8000000 },
  { name: 'Phí chứng nhận hệ thống ISO 17025', unit: 'Gói', priceMin: 20000000, priceMax: 50000000 },
];

// ─── Invoice symbol patterns ──────────────────────────────
const SALE_SYMBOLS = ['C24TVC', 'C24TVD', 'C25TVC', 'C25TVD'];
const PURCHASE_SYMBOLS = ['C24MVC', 'C24MVD', 'C25MVC', 'C25MVD'];

const STATUS_POOL = [
  { text: 'Hóa đơn mới', weight: 90 },
  { text: 'Hóa đơn thay thế', weight: 5 },
  { text: 'Hóa đơn điều chỉnh', weight: 3 },
  { text: 'Hóa đơn đã hủy', weight: 2 },
];

const CHECK_RESULT_POOL = [
  { text: 'Đã cấp mã hóa đơn', weight: 92 },
  { text: 'Hóa đơn hợp lệ', weight: 5 },
  { text: 'Đang xử lý', weight: 3 },
];

const PAYMENT_METHODS = ['TM/CK', 'CK', 'TM', 'Chuyển khoản'];

const TAX_RATES = [
  { rate: 10, label: '10.0%', weight: 55 },
  { rate: 8, label: '8.0%', weight: 30 },
  { rate: 5, label: '5.0%', weight: 10 },
  { rate: 0, label: '0%', weight: 5 },
];

// ═══════════════════════════════════════════════════════════
// ─── UTILITY ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function roundVND(n) { return Math.round(n / 1000) * 1000; }

function weightedPick(pool) {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return pool[0];
}

function padDate(n) { return String(n).padStart(2, '0'); }
function fmtDate(d, m, y) { return `${padDate(d)}/${padDate(m)}/${y}`; }

function randomDate(year, month) {
  const maxDay = new Date(year, month, 0).getDate();
  return rand(1, maxDay);
}

function generateMCCQT() {
  const chars = '0123456789ABCDEF';
  let s = '00';
  for (let i = 0; i < 30; i++) s += chars[rand(0, 15)];
  return s;
}

function generateLookupCode(date, buyerTax) {
  const d = date.replace(/\//g, '').split('').reverse().join('').slice(0, 6);
  return d + rand(10000000, 99999999) + (buyerTax || '').slice(0, 10);
}

// ═══════════════════════════════════════════════════════════
// ─── REVENUE PATTERNS (Seasonal + Growth) ─────────────────
// ═══════════════════════════════════════════════════════════
/**
 * Returns target invoice count per month for sales.
 * Pattern: base ~60-80/month, Q4 peak, Q1 low, 8% YoY growth
 */
function getSaleInvoiceCount(year, month) {
  const base = year === 2024 ? 55 : 62; // growth
  const seasonal = {
    1: -15, 2: -20, 3: -5, 4: 0, 5: 5, 6: 5,
    7: 0, 8: 3, 9: 8, 10: 12, 11: 18, 12: 22,
  };
  return Math.max(25, base + seasonal[month] + rand(-5, 5));
}

/**
 * Purchase invoice count per month (more stable).
 */
function getPurchaseInvoiceCount(year, month) {
  const base = year === 2024 ? 18 : 22;
  const seasonal = { 1: -3, 2: -5, 3: 0, 4: 2, 5: 0, 6: 1, 7: -1, 8: 0, 9: 2, 10: 3, 11: 4, 12: 5 };
  return Math.max(10, base + seasonal[month] + rand(-3, 3));
}

// ═══════════════════════════════════════════════════════════
// ─── GENERATE RAW CRAWLER DOCS ────────────────────────────
// ═══════════════════════════════════════════════════════════
function generateSaleDoc(invoiceNumber, year, month, day, customer, product, qty, taxRateObj, symbol) {
  const unitPrice = roundVND(rand(product.priceMin, product.priceMax));
  const preTax = unitPrice * qty;
  const taxAmount = Math.round(preTax * taxRateObj.rate / 100);
  const total = preTax + taxAmount;
  const dateStr = fmtDate(day, month, year);
  const signDay = Math.min(day + rand(0, 2), new Date(year, month, 0).getDate());
  const signDate = fmtDate(signDay, month, year);
  const status = weightedPick(STATUS_POOL);
  const checkResult = weightedPick(CHECK_RESULT_POOL);

  return {
    username: COMPANY.taxCode,
    'Mẫu số HD': 1,
    'Ký hiệu hóa  đơn': symbol,
    'Số hóa đơn': ` ${invoiceNumber}`,
    'Ngày lập hóa đơn': dateStr,
    'Ngày người bán ký số': signDate,
    'MCCQT': generateMCCQT(),
    'Ngày CQT ký số': signDate,
    'Đơn vị tiền tệ': 'VND',
    'Tỷ giá': 1.0,
    'Tên người bán': COMPANY.name,
    'MST người bán': COMPANY.taxCode,
    'Địa chỉ người bán': COMPANY.address,
    'Tên người mua': customer.name,
    'MST người mua': customer.taxCode,
    'Địa chỉ người mua': customer.address,
    'Mã VT': '',
    'Tên hàng hóa, dịch vụ': product.name,
    'Đơn vị tính': product.unit,
    'Số lượng': qty,
    'Đơn giá': unitPrice,
    'Chiết khấu': 0,
    'Thuế suất': taxRateObj.label,
    'Thành tiền chưa thuế': preTax,
    'Tiền thuế': taxAmount,
    'Tổng tiền CKTM': 0,
    'Tổng tiền phí': null,
    'Tổng tiền thanh toán': total,
    'Trạng thái hóa đơn': status.text,
    'Kết quả kiểm tra hóa đơn': checkResult.text,
    'url  tra cứu hóa đơn': '',
    'Mã tra cứu': generateLookupCode(dateStr, customer.taxCode),
    'Ghi chú 1': '  ',
    'Hình  thức thanh toán': pick(PAYMENT_METHODS),
    'Tính chất': 'Hàng hóa, dịch vụ',
    'Ghi chú 2': ' ',
    'Số lô ': null,
    'Hạn dùng ': null,
  };
}

function generatePurchaseDoc(invoiceNumber, year, month, day, supplier, product, qty, taxRateObj, symbol) {
  const unitPrice = roundVND(rand(product.priceMin, product.priceMax));
  const preTax = unitPrice * qty;
  const taxAmount = Math.round(preTax * taxRateObj.rate / 100);
  const total = preTax + taxAmount;
  const dateStr = fmtDate(day, month, year);
  const signDay = Math.min(day + rand(0, 2), new Date(year, month, 0).getDate());
  const signDate = fmtDate(signDay, month, year);
  const status = weightedPick(STATUS_POOL);
  const checkResult = weightedPick(CHECK_RESULT_POOL);

  return {
    username: COMPANY.taxCode,
    'Mẫu số HD': 1,
    'Ký hiệu hóa  đơn': symbol,
    'Số hóa đơn': ` ${invoiceNumber}`,
    'Ngày lập hóa đơn': dateStr,
    'Ngày người bán ký số': signDate,
    'MCCQT': generateMCCQT(),
    'Ngày CQT ký số': signDate,
    'Đơn vị tiền tệ': 'VND',
    'Tỷ giá': 1.0,
    'Tên người bán': supplier.name,
    'MST người bán': supplier.taxCode,
    'Địa chỉ người bán': supplier.address,
    'Tên người mua': COMPANY.name,
    'MST người mua': COMPANY.taxCode,
    'Địa chỉ người mua': COMPANY.address,
    'Mã VT': '',
    'Tên hàng hóa, dịch vụ': product.name,
    'Đơn vị tính': product.unit,
    'Số lượng': qty,
    'Đơn giá': unitPrice,
    'Chiết khấu': 0,
    'Thuế suất': taxRateObj.label,
    'Thành tiền chưa thuế': preTax,
    'Tiền thuế': taxAmount,
    'Tổng tiền CKTM': 0,
    'Tổng tiền phí': null,
    'Tổng tiền thanh toán': total,
    'Trạng thái hóa đơn': status.text,
    'Kết quả kiểm tra hóa đơn': checkResult.text,
    'url  tra cứu hóa đơn': '',
    'Mã tra cứu': generateLookupCode(dateStr, COMPANY.taxCode),
    'Ghi chú 1': '  ',
    'Hình  thức thanh toán': pick(PAYMENT_METHODS),
    'Tính chất': 'Hàng hóa, dịch vụ',
    'Ghi chú 2': ' ',
    'Số lô ': null,
    'Hạn dùng ': null,
  };
}

/**
 * For multi-item invoices: generate additional items sharing the same
 * invoice number/symbol/date/partner but different product + total recalculated.
 */
function fixMultiItemTotal(docs) {
  if (docs.length <= 1) return;
  let sumPreTax = 0, sumTax = 0;
  for (const d of docs) {
    sumPreTax += d['Thành tiền chưa thuế'];
    sumTax += d['Tiền thuế'];
  }
  const total = sumPreTax + sumTax;
  for (const d of docs) {
    d['Tổng tiền thanh toán'] = total;
  }
}

// ═══════════════════════════════════════════════════════════
// ─── MAIN SEED FUNCTION ───────────────────────────────────
// ═══════════════════════════════════════════════════════════
async function seed() {
  console.log('🌱 FinTax Seed Script');
  console.log('═══════════════════════════════════════════');

  // Connect using the app's DB module so getCrawlerDb() works for sync
  const { connectDB, getCrawlerDb } = require('../src/config/db');
  await connectDB();
  const crawlerDb = getCrawlerDb();

  // ── Step 1: Clean existing data ──────────────────────
  console.log('\n🗑️  Cleaning existing data...');
  // Crawler
  await crawlerDb.collection('HoaDonBanRa').deleteMany({ username: COMPANY.taxCode });
  await crawlerDb.collection('HoaDonMuaVao').deleteMany({ username: COMPANY.taxCode });
  // Web
  const Company = require('../src/models/Company');
  const User = require('../src/models/User');
  const Invoice = require('../src/models/Invoice');
  const InvoiceItem = require('../src/models/InvoiceItem');
  const ChatHistory = require('../src/models/ChatHistory');
  const CrawlJob = require('../src/models/CrawlJob');

  const existingCompany = await Company.findOne({ taxCode: COMPANY.taxCode });
  if (existingCompany) {
    await Invoice.deleteMany({ company_id: existingCompany._id });
    await InvoiceItem.deleteMany({ company_id: existingCompany._id });
    await ChatHistory.deleteMany({ company_id: existingCompany._id });
    await CrawlJob.deleteMany({ company_id: existingCompany._id });
    await User.deleteMany({ company_id: existingCompany._id });
    await Company.deleteOne({ _id: existingCompany._id });
  }
  console.log('  ✓ Cleaned');

  // ── Step 2: Create Company ────────────────────────────
  console.log('\n🏢 Creating company...');
  const company = await Company.create({
    companyName: COMPANY.name,
    taxCode: COMPANY.taxCode,
    address: COMPANY.address,
    industry: COMPANY.industry,
  });
  console.log(`  ✓ ${company.companyName} (MST: ${company.taxCode})`);

  // ── Step 3: Create Users ──────────────────────────────
  console.log('\n👥 Creating users...');
  for (const u of USERS) {
    // Pass plain password — User model's pre('save') hook hashes it
    await User.create({
      email: u.email,
      password: u.password,
      fullName: u.fullName,
      role: u.role,
      company_id: company._id,
      isActive: true,
    });
    console.log(`  ✓ ${u.email} (${u.role}) — password: ${u.password}`);
  }

  // ── Step 4: Generate HoaDonBanRa ──────────────────────
  console.log('\n📄 Generating HoaDonBanRa (sale invoices)...');
  const saleDocs = [];
  let saleInvoiceNum = 1;

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (let month = 1; month <= 12; month++) {
      const count = getSaleInvoiceCount(year, month);
      const symbol = year === 2024
        ? pick(SALE_SYMBOLS.slice(0, 2))
        : pick(SALE_SYMBOLS.slice(2));

      for (let i = 0; i < count; i++) {
        const day = randomDate(year, month);
        const customer = pick(CUSTOMERS);
        const taxRate = weightedPick(TAX_RATES);

        // 20% chance of multi-item invoice (2-3 items)
        const itemCount = Math.random() < 0.2 ? rand(2, 3) : 1;
        const invoiceDocs = [];

        for (let j = 0; j < itemCount; j++) {
          const product = pick(SALE_PRODUCTS);
          const qty = rand(1, 5);
          const doc = generateSaleDoc(
            saleInvoiceNum, year, month, day, customer, product, qty, taxRate, symbol
          );
          invoiceDocs.push(doc);
        }

        fixMultiItemTotal(invoiceDocs);
        saleDocs.push(...invoiceDocs);
        saleInvoiceNum++;
      }
    }
  }

  // Insert anomaly months: Nov 2024 spike, Jul 2025 spike
  // (already handled by seasonal pattern — Nov/Dec are high)

  const saleInsertResult = await crawlerDb.collection('HoaDonBanRa').insertMany(saleDocs);
  console.log(`  ✓ ${saleInsertResult.insertedCount} line items (${saleInvoiceNum - 1} invoices)`);

  // ── Step 5: Generate HoaDonMuaVao ─────────────────────
  console.log('\n📄 Generating HoaDonMuaVao (purchase invoices)...');
  const purchaseDocs = [];
  let purchaseInvoiceNum = 1;

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (let month = 1; month <= 12; month++) {
      const count = getPurchaseInvoiceCount(year, month);
      const symbol = year === 2024
        ? pick(PURCHASE_SYMBOLS.slice(0, 2))
        : pick(PURCHASE_SYMBOLS.slice(2));

      for (let i = 0; i < count; i++) {
        const day = randomDate(year, month);
        const supplier = pick(SUPPLIERS);
        const taxRate = weightedPick(TAX_RATES);

        // 15% chance multi-item
        const itemCount = Math.random() < 0.15 ? rand(2, 3) : 1;
        const invoiceDocs = [];

        for (let j = 0; j < itemCount; j++) {
          const product = pick(PURCHASE_PRODUCTS);
          const qty = rand(1, 10);
          const doc = generatePurchaseDoc(
            purchaseInvoiceNum, year, month, day, supplier, product, qty, taxRate, symbol
          );
          invoiceDocs.push(doc);
        }

        fixMultiItemTotal(invoiceDocs);
        purchaseDocs.push(...invoiceDocs);
        purchaseInvoiceNum++;
      }
    }
  }

  const purchaseInsertResult = await crawlerDb.collection('HoaDonMuaVao').insertMany(purchaseDocs);
  console.log(`  ✓ ${purchaseInsertResult.insertedCount} line items (${purchaseInvoiceNum - 1} invoices)`);

  // ── Step 6: Run Sync (crawler → web) ──────────────────
  console.log('\n🔄 Running sync (fintax_crawler → fintax_web)...');
  const { syncInvoices } = require('../src/services/sync.service');

  const syncResult = await syncInvoices(COMPANY.taxCode, (current, total) => {
    const pct = Math.round(current / total * 100);
    process.stdout.write(`\r  ⏳ Syncing... ${pct}% (${current}/${total})`);
  });
  console.log(`\n  ✓ Synced: ${syncResult.totalSynced} invoices, ${syncResult.totalItems} items`);
  if (syncResult.totalSkipped > 0) {
    console.log(`  ⚠ Skipped: ${syncResult.totalSkipped} (duplicates)`);
  }

  // ── Step 7: Create sample CrawlJobs ───────────────────
  console.log('\n📋 Creating sample crawl jobs...');
  const adminUser = await User.findOne({ email: 'admin@fintax.vn' });
  const crawlDates = [
    new Date('2024-03-15'), new Date('2024-06-20'), new Date('2024-09-10'),
    new Date('2024-12-05'), new Date('2025-03-12'), new Date('2025-06-18'),
    new Date('2025-09-08'), new Date('2025-12-01'),
  ];
  for (const date of crawlDates) {
    const fromMonth = date.getMonth() - 2; // 3 months prior
    const fromYear = fromMonth < 0 ? date.getFullYear() - 1 : date.getFullYear();
    const fmtFrom = `01/${padDate((fromMonth + 12) % 12 || 12)}/${fromYear}`;
    const endDay = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
    const fmtTo = `${padDate(endDay)}/${padDate(date.getMonth())}/${date.getFullYear()}`;
    const found = rand(150, 300);
    await CrawlJob.create({
      company_id: company._id,
      triggeredBy: adminUser._id,
      type: 'both',
      processType: 'chitiet',
      dateRange: { start: fmtFrom, end: fmtTo },
      status: 'completed',
      progress: 100,
      result: {
        invoicesFound: found,
        invoicesSaved: found - rand(0, 10),
        message: 'Hoàn tất crawl dữ liệu hóa đơn',
      },
      startedAt: date,
      completedAt: new Date(date.getTime() + rand(60, 300) * 1000),
    });
  }
  console.log(`  ✓ ${crawlDates.length} crawl jobs created`);

  // ── Summary ────────────────────────────────────────────
  const totalSaleInvoices = await Invoice.countDocuments({ company_id: company._id, type: 'sale' });
  const totalPurchaseInvoices = await Invoice.countDocuments({ company_id: company._id, type: 'purchase' });
  const totalItems = await InvoiceItem.countDocuments({ company_id: company._id });

  console.log('\n═══════════════════════════════════════════');
  console.log('✅ SEED COMPLETE!');
  console.log('═══════════════════════════════════════════');
  console.log(`\n📊 fintax_crawler:`);
  console.log(`   HoaDonBanRa:  ${saleDocs.length} line items`);
  console.log(`   HoaDonMuaVao: ${purchaseDocs.length} line items`);
  console.log(`   TOTAL RAW:    ${saleDocs.length + purchaseDocs.length}`);
  console.log(`\n📊 fintax_web:`);
  console.log(`   Company:      1 (${COMPANY.name})`);
  console.log(`   Users:        ${USERS.length}`);
  console.log(`   Invoices:     ${totalSaleInvoices} sale + ${totalPurchaseInvoices} purchase = ${totalSaleInvoices + totalPurchaseInvoices}`);
  console.log(`   InvoiceItems: ${totalItems}`);
  console.log(`   CrawlJobs:    ${crawlDates.length}`);
  console.log(`\n🔑 Login credentials:`);
  USERS.forEach(u => console.log(`   ${u.email} / ${u.password} (${u.role})`));
  console.log(`\n⏰ Data range: Jan ${START_YEAR} → Dec ${END_YEAR} (24 months)`);

  await mongoose.disconnect();
  console.log('\n✓ Disconnected. Done!');
}

// Run
seed().catch(err => {
  console.error('\n❌ SEED FAILED:', err);
  process.exit(1);
});
