import { db, resolveClassGroupId } from '../../database/schema.js';
import { calculateWeekNumber } from './schedule.js';

/**
 * Format angka ke format Rupiah standar (Rp1.000.000)
 */
export function formatRupiah(num) {
  const val = Number(num || 0);
  return `Rp${val.toLocaleString('id-ID')}`;
}

export function toLocalDateString(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format tanggal YYYY-MM-DD ke format Indonesia (e.g. "Jumat, 30 Okt 2026")
 */
export function formatIndoDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Mengambil ringkasan keuangan menyeluruh dan data terfilter per hari/per minggu
 */
export function getFinancialSummary(groupId, options = {}) {
  const targetGroupId = resolveClassGroupId(groupId);
  const classInfo = db.prepare('SELECT * FROM classes WHERE group_id = ?').get(targetGroupId);
  const settings = db.prepare('SELECT weekly_fee, active_weeks_count FROM cash_settings WHERE group_id = ?').get(targetGroupId);
  const weeklyFee = Number(settings?.weekly_fee || 0);

  // 1. Total Akumulasi Seluruh Waktu (All-Time Totals)
  const cashPaymentsRow = db.prepare(`
    SELECT COUNT(*) AS paid_count
    FROM cash_payments
    WHERE group_id = ? AND is_paid = 1
  `).get(targetGroupId);
  const totalCashCount = Number(cashPaymentsRow?.paid_count || 0);
  const totalCashIncome = totalCashCount * weeklyFee;

  const manualTotals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) AS manual_income,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS manual_expense
    FROM financial_transactions
    WHERE group_id = ?
  `).get(targetGroupId);
  const totalManualIncome = Number(manualTotals?.manual_income || 0);
  const totalManualExpense = Number(manualTotals?.manual_expense || 0);

  const totalAllIncome = totalCashIncome + totalManualIncome;
  const currentBalance = totalAllIncome - totalManualExpense;

  // 2. Evaluasi Rentang Tanggal Filter
  const range = (options.range || '30d').toLowerCase();
  const groupBy = (options.groupBy || 'day').toLowerCase(); // 'day' | 'week'
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let startDateStr = null;
  if (range === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    startDateStr = toLocalDateString(d);
  } else if (range === '14d') {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    startDateStr = toLocalDateString(d);
  } else if (range === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    startDateStr = toLocalDateString(d);
  } else if (range === '60d') {
    const d = new Date();
    d.setDate(d.getDate() - 59);
    startDateStr = toLocalDateString(d);
  } else if (range === 'semester') {
    startDateStr = classInfo?.semester_start_date || '2026-07-13';
  }

  // 3. Ambil Transaksi Kas Siswa Otomatis Berdasarkan Tanggal updated_at
  let cashSql = `
    SELECT
      DATE(cp.updated_at) AS tx_date,
      cp.week_number,
      cp.student_id,
      s.name AS student_name,
      s.student_number
    FROM cash_payments cp
    JOIN students s ON cp.student_id = s.id
    WHERE cp.group_id = ? AND cp.is_paid = 1
  `;
  const cashParams = [targetGroupId];
  if (startDateStr) {
    cashSql += ` AND DATE(cp.updated_at) >= ?`;
    cashParams.push(startDateStr);
  }
  cashSql += ` ORDER BY DATE(cp.updated_at) DESC, s.student_number ASC`;
  const cashRows = db.prepare(cashSql).all(...cashParams);

  // 4. Ambil Transaksi Manual (Pemasukan Lain & Pengeluaran)
  let manualSql = `
    SELECT *
    FROM financial_transactions
    WHERE group_id = ?
  `;
  const manualParams = [targetGroupId];
  if (startDateStr) {
    manualSql += ` AND transaction_date >= ?`;
    manualParams.push(startDateStr);
  }
  manualSql += ` ORDER BY transaction_date DESC, id DESC`;
  const manualRows = db.prepare(manualSql).all(...manualParams);

  // 5. Agregasi Data per Tanggal
  const dayMap = new Map(); // dateStr => dayData
  const semStart = classInfo?.semester_start_date || '2026-07-13';
  const semStartDate = new Date(semStart + 'T00:00:00');

  function getWeekWednesday(weekNum) {
    const d = new Date(semStartDate.getTime() + ((Number(weekNum || 1) - 1) * 7 + 2) * 86400000);
    return toLocalDateString(d);
  }

  function getOrCreateDay(dateStr) {
    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, {
        date: dateStr,
        date_formatted: formatIndoDate(dateStr),
        cash_income: 0,
        cash_count: 0,
        cash_students: [],
        manual_income: 0,
        manual_expense: 0,
        total_income: 0,
        total_expense: 0,
        net: 0,
        transactions: []
      });
    }
    return dayMap.get(dateStr);
  }

  // Kelompokkan kas masuk (selalu terpetakan ke tanggal Rabu minggu berjalan)
  for (const c of cashRows) {
    const dateStr = (c.week_number && c.week_number >= 1) ? getWeekWednesday(c.week_number) : c.tx_date;
    const day = getOrCreateDay(dateStr);
    day.cash_count += 1;
    day.cash_income += weeklyFee;
    day.cash_students.push({
      student_id: c.student_id,
      name: c.student_name,
      student_number: c.student_number,
      week_number: c.week_number,
      amount: weeklyFee
    });
  }

  // Kelompokkan transaksi manual
  for (const m of manualRows) {
    const dateStr = m.transaction_date;
    const day = getOrCreateDay(dateStr);
    const amt = Number(m.amount);
    if (m.type === 'INCOME') {
      day.manual_income += amt;
    } else {
      day.manual_expense += amt;
    }
    day.transactions.push({
      id: m.id,
      type: m.type,
      amount: amt,
      description: m.description,
      receipt_url: m.receipt_url,
      created_by: m.created_by,
      created_at: m.created_at
    });
  }

  // Hitung total dan net per hari
  const dailyRecords = Array.from(dayMap.values()).map(d => {
    d.total_income = d.cash_income + d.manual_income;
    d.total_expense = d.manual_expense;
    d.net = d.total_income - d.total_expense;
    return d;
  });

  // Urutkan tanggal dari terbaru ke terlama
  dailyRecords.sort((a, b) => b.date.localeCompare(a.date));

  // Hitung total periode
  let periodIncome = 0;
  let periodExpense = 0;
  for (const d of dailyRecords) {
    periodIncome += d.total_income;
    periodExpense += d.total_expense;
  }
  const periodNet = periodIncome - periodExpense;

  // 6. Jika Pengelompokan adalah 'week'
  let records = dailyRecords;
  if (groupBy === 'week') {
    const weekMap = new Map();
    const semStart = classInfo?.semester_start_date || '2026-07-13';

    for (const d of dailyRecords) {
      const wnum = calculateWeekNumber(semStart, new Date(d.date + 'T00:00:00'));
      if (!weekMap.has(wnum)) {
        weekMap.set(wnum, {
          week_number: wnum,
          week_label: `Minggu ${wnum}`,
          total_income: 0,
          total_expense: 0,
          net: 0,
          cash_income: 0,
          manual_income: 0,
          manual_expense: 0,
          days: []
        });
      }
      const w = weekMap.get(wnum);
      w.total_income += d.total_income;
      w.total_expense += d.total_expense;
      w.cash_income += d.cash_income;
      w.manual_income += d.manual_income;
      w.manual_expense += d.manual_expense;
      w.net += d.net;
      w.days.push(d);
    }

    records = Array.from(weekMap.values()).sort((a, b) => b.week_number - a.week_number);
  }

  return {
    class_name: classInfo?.class_name || 'Kelas',
    group_id: targetGroupId,
    weekly_fee: weeklyFee,
    current_balance: currentBalance,
    all_time: {
      total_income: totalAllIncome,
      total_cash_income: totalCashIncome,
      total_manual_income: totalManualIncome,
      total_manual_expense: totalManualExpense,
      balance: currentBalance
    },
    period_summary: {
      range,
      group_by: groupBy,
      total_income: periodIncome,
      total_expense: periodExpense,
      net: periodNet
    },
    records
  };
}

/**
 * Menghasilkan teks laporan keuangan kelas untuk WhatsApp Bot (/keuangan atau /saldo)
 */
export function getFormattedFinanceReport(groupId) {
  const summary = getFinancialSummary(groupId, { range: 'semester', groupBy: 'day' });

  return (
    `📊 *REKAP KEUANGAN & BUKU KAS ${summary.class_name.toUpperCase()}*\n` +
    `────────────────────────────\n` +
    `💰 *Saldo Kas Saat Ini:* *${formatRupiah(summary.current_balance)}*\n\n` +
    `📈 *Total Pemasukan:* ${formatRupiah(summary.all_time.total_income)}\n` +
    `  • Kas Siswa: ${formatRupiah(summary.all_time.total_cash_income)}\n` +
    `  • Pemasukan Lain: ${formatRupiah(summary.all_time.total_manual_income)}\n\n` +
    `📉 *Total Pengeluaran:* ${formatRupiah(summary.all_time.total_manual_expense)}\n\n` +
    `ℹ️ *Catatan:*\n` +
    `• Ketik \`/kas\` untuk melihat status tunggakan siswa.\n` +
    `• Buka *Web Dashboard* kelas untuk melihat rincian arus kas harian dan nota belanja.`
  );
}

/**
 * Tambah transaksi manual
 */
export function addFinancialTransaction(groupId, tx) {
  const targetGroupId = resolveClassGroupId(groupId);
  const type = (tx.type || '').toUpperCase();
  if (!['INCOME', 'EXPENSE'].includes(type)) {
    throw new Error('Tipe transaksi harus INCOME atau EXPENSE');
  }
  const amount = parseInt(tx.amount, 10);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Nominal transaksi harus lebih dari Rp0');
  }
  const description = String(tx.description || '').trim();
  if (!description) {
    throw new Error('Keterangan transaksi wajib diisi');
  }
  const txDate = tx.transaction_date ? String(tx.transaction_date).trim() : toLocalDateString(new Date());
  const receiptUrl = tx.receipt_url || null;
  const createdBy = tx.created_by || null;

  const res = db.prepare(`
    INSERT INTO financial_transactions (group_id, type, amount, description, receipt_url, transaction_date, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(targetGroupId, type, amount, description, receiptUrl, txDate, createdBy);

  return { id: res.lastInsertRowid, group_id: targetGroupId, type, amount, description, receipt_url: receiptUrl, transaction_date: txDate };
}

/**
 * Update transaksi manual
 */
export function updateFinancialTransaction(groupId, txId, tx) {
  const targetGroupId = resolveClassGroupId(groupId);
  const existing = db.prepare('SELECT * FROM financial_transactions WHERE id = ? AND group_id = ?').get(txId, targetGroupId);
  if (!existing) {
    throw new Error('Transaksi tidak ditemukan atau bukan milik kelas ini');
  }

  const type = tx.type ? String(tx.type).toUpperCase() : existing.type;
  if (!['INCOME', 'EXPENSE'].includes(type)) {
    throw new Error('Tipe transaksi harus INCOME atau EXPENSE');
  }
  const amount = tx.amount !== undefined ? parseInt(tx.amount, 10) : existing.amount;
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Nominal transaksi harus lebih dari Rp0');
  }
  const description = tx.description !== undefined ? String(tx.description).trim() : existing.description;
  if (!description) {
    throw new Error('Keterangan transaksi wajib diisi');
  }
  const txDate = tx.transaction_date ? String(tx.transaction_date).trim() : existing.transaction_date;
  const receiptUrl = tx.receipt_url !== undefined ? tx.receipt_url : existing.receipt_url;

  db.prepare(`
    UPDATE financial_transactions
    SET type = ?, amount = ?, description = ?, receipt_url = ?, transaction_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND group_id = ?
  `).run(type, amount, description, receiptUrl, txDate, txId, targetGroupId);

  return { id: txId, group_id: targetGroupId, type, amount, description, receipt_url: receiptUrl, transaction_date: txDate };
}

/**
 * Hapus transaksi manual
 */
export function deleteFinancialTransaction(groupId, txId) {
  const targetGroupId = resolveClassGroupId(groupId);
  const res = db.prepare('DELETE FROM financial_transactions WHERE id = ? AND group_id = ?').run(txId, targetGroupId);
  if (res.changes === 0) {
    throw new Error('Transaksi tidak ditemukan atau gagal dihapus');
  }
  return true;
}
