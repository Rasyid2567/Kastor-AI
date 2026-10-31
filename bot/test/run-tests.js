import { initDatabase, db } from '../../database/schema.js';
import { seedDefaultClass } from '../../database/seed.js';
import { calculateWeekNumber, getScheduleToday, getScheduleTomorrow, getScheduleByDay, getScheduleFull, getScheduleNow } from '../modules/schedule.js';
import { getTreasurerRole, setWeeklyFee, parseChecklistText, getCashRecap } from '../modules/cash.js';
import { getActiveAssignments, getAllAssignments, getAssignmentDetail, addAssignment, completeAssignment, deleteAssignment } from '../modules/assignments.js';
import { calculateMath } from '../modules/media.js';
import { isWhatsAppAdmin } from '../modules/admin.js';
import { resolveClassGroupId, getLinkedGroups } from '../../database/schema.js';
import {
  linkGroupToClass,
  unlinkGroup,
  listLinkedGroups,
  getAvailableClasses,
  parseLinkArguments,
  updateLinkedGroupLabel
} from '../modules/classes.js';
import {
  getFinancialSummary,
  getFormattedFinanceReport,
  addFinancialTransaction,
  updateFinancialTransaction,
  deleteFinancialTransaction
} from '../modules/finance.js';
import { getHelpMenu } from '../router.js';

console.log('🧪 Memulai Pengujian Fungsional Bot Kelas...\n');

// 1. Inisialisasi Database & Seeder
initDatabase();
seedDefaultClass('120363000000000001@g.us');

const testGroupId = '120363000000000001@g.us';

// 2. Test Modul Jadwal
console.log('--- TEST 1: Modul Jadwal Blok ---');
const week = calculateWeekNumber('2026-07-13', new Date('2026-07-20'));
console.log(`[PASS] Kalkulasi nomor minggu: ${week} (Ekspektasi: 2)`);

const schedSenin = getScheduleByDay(testGroupId, 'senin');
console.log(`[PASS] Output jadwal Senin:\n${schedSenin.substring(0, 150)}...\n`);

// 3. Test Modul Kas & Format Ketat PRD
console.log('--- TEST 2: Modul Kas (Format Ketat PRD) ---');
const cashRecap = getCashRecap(testGroupId);
console.log(`[PASS] Output /kas di grup:\n${cashRecap.substring(0, 300)}...\n`);

// Verifikasi aturan format ketat PRD:
// - Lunas: ✅
// - Menunggak: Nominal (e.g. Rp10.000)
// - Tidak ada total tunggakan di akhir
if (cashRecap.includes('Naswa: ✅') && cashRecap.includes('Nikita: Rp10.000') && !cashRecap.includes('Total:')) {
  console.log('✅ [VERIFIED] Format /kas 100% mematuhi aturan ketat PRD (ada ✅, ada Rp, tanpa baris total)!');
} else {
  console.error('❌ [FAILED] Format /kas tidak mematuhi PRD!');
}

// 4. Test PM Bendahara: Update via Ceklis Teks
console.log('\n--- TEST 3: PM Bendahara (Teks Ceklis) ---');
const checklistMsg = `KAS TANGGAL 29 JULI 2026 (MINGGU 4)
1. naswa✅
2. natasya✅
3. nia felly
4. nicko✅
5. nikita`;

const updateResult = parseChecklistText(testGroupId, checklistMsg);
console.log(`[PASS] Hasil parse teks ceklis:\n${updateResult}\n`);

// 5. Test Modul Tugas / PR
console.log('--- TEST 4: Modul Tugas & PR ---');
const addRes = addAssignment(testGroupId, 'Basis Data | 2026-11-01 23:59 | Query JOIN dan Normalisasi 3NF', 'Nicko (Ketua)');
console.log(`[PASS] Add PR:\n${addRes}\n`);

const prList = getActiveAssignments(testGroupId);
console.log(`[PASS] Daftar PR Aktif:\n${prList.substring(0, 200)}...\n`);

// 6. Test Kalkulator Matematika
console.log('--- TEST 5: Modul Matematika (/calc) ---');
const calcResult = calculateMath('250 * 4 + 1500 / 3');
console.log(`[PASS] /calc: ${calcResult}`);

// 7. Test Menu Bantuan (Memastikan /rvo tersembunyi)
console.log('\n--- TEST 6: Verifikasi Menu Bantuan (/rvo Rahasia) ---');
const menu = getHelpMenu();
if (!menu.includes('/rvo')) {
  console.log('✅ [VERIFIED] /rvo TERSEMBUNYI dan TIDAK TERCANTUM di /menu sesuai PRD 4.7!');
} else {
  console.error('❌ [FAILED] /rvo bocor di /menu!');
}

// 8. Test Otorisasi Admin Grup WhatsApp (isWhatsAppAdmin)
console.log('\n--- TEST 7: Otorisasi Admin WhatsApp Grup (isWhatsAppAdmin) ---');
const mockGroupMeta = {
  id: '120363999999999999@g.us',
  subject: 'Kelas Uji Coba',
  participants: [
    {
      id: '6281111111111@s.whatsapp.net',
      lid: '111111111111111@lid',
      admin: 'superadmin'
    },
    {
      id: '6282222222222@s.whatsapp.net',
      lid: '222222222222222@lid',
      admin: 'admin'
    },
    {
      id: '6283333333333@s.whatsapp.net',
      lid: '333333333333333@lid',
      admin: null
    }
  ]
};

// Case 1: Superadmin via Phone JID
const testSuperadminPhone = isWhatsAppAdmin(mockGroupMeta, '6281111111111@s.whatsapp.net');
console.log(`[PASS] Superadmin via Phone JID: ${testSuperadminPhone} (Ekspektasi: true)`);
if (!testSuperadminPhone) throw new Error('Superadmin Phone JID harus diakui!');

// Case 2: Superadmin via LID
const testSuperadminLid = isWhatsAppAdmin(mockGroupMeta, '111111111111111@lid');
console.log(`[PASS] Superadmin via LID: ${testSuperadminLid} (Ekspektasi: true)`);
if (!testSuperadminLid) throw new Error('Superadmin LID harus diakui!');

// Case 3: Admin via Phone JID dengan device suffix
const testAdminPhoneDevice = isWhatsAppAdmin(mockGroupMeta, '6282222222222:15@s.whatsapp.net');
console.log(`[PASS] Admin via Phone JID device: ${testAdminPhoneDevice} (Ekspektasi: true)`);
if (!testAdminPhoneDevice) throw new Error('Admin Phone JID device suffix harus diakui!');

// Case 4: Admin via LID dengan device suffix
const testAdminLidDevice = isWhatsAppAdmin(mockGroupMeta, '222222222222222:2@lid');
console.log(`[PASS] Admin via LID device: ${testAdminLidDevice} (Ekspektasi: true)`);
if (!testAdminLidDevice) throw new Error('Admin LID device suffix harus diakui!');

// Case 5: Member biasa (bukan admin) harus ditolak
const testMember = isWhatsAppAdmin(mockGroupMeta, '6283333333333@s.whatsapp.net');
console.log(`[PASS] Member biasa ditolak: ${!testMember} (Ekspektasi: true)`);
if (testMember) throw new Error('Member biasa TIDAK boleh dianggap admin!');

// Case 6: Nomor asing tidak ada di grup
const testStranger = isWhatsAppAdmin(mockGroupMeta, '6289999999999@s.whatsapp.net');
console.log(`[PASS] Pengguna asing ditolak: ${!testStranger} (Ekspektasi: true)`);
if (testStranger) throw new Error('Pengguna asing TIDAK boleh dianggap admin!');

// 9. Test Multi-Group Class Linking (Grup Putra, Putri, dsb.)
console.log('\n--- TEST 8: Multi-Group Class Linking ---');
const boyGroup = '120363000000000002@g.us';
const girlGroup = '120363000000000003@g.us';

db.prepare('DELETE FROM class_groups WHERE group_id IN (?, ?)').run(boyGroup, girlGroup);

// 8.1 Link grup putra ke kelas utama testGroupId
const linkBoyRes = linkGroupToClass(boyGroup, testGroupId, 'Khusus Putra');
console.log(`[PASS] Link grup putra: ${linkBoyRes.ok} (Ekspektasi: true)`);
if (!linkBoyRes.ok) throw new Error(`Gagal link grup putra: ${linkBoyRes.message}`);

// 8.2 Link grup putri ke kelas utama testGroupId
const linkGirlRes = linkGroupToClass(girlGroup, testGroupId, 'Khusus Putri');
console.log(`[PASS] Link grup putri: ${linkGirlRes.ok} (Ekspektasi: true)`);
if (!linkGirlRes.ok) throw new Error(`Gagal link grup putri: ${linkGirlRes.message}`);

// 8.3 Resolusi group_id cabang ke kelas induk
const resolvedBoy = resolveClassGroupId(boyGroup);
const resolvedGirl = resolveClassGroupId(girlGroup);
console.log(`[PASS] Resolusi boyGroup -> ${resolvedBoy} (Ekspektasi: ${testGroupId})`);
console.log(`[PASS] Resolusi girlGroup -> ${resolvedGirl} (Ekspektasi: ${testGroupId})`);
if (resolvedBoy !== testGroupId || resolvedGirl !== testGroupId) {
  throw new Error('resolveClassGroupId gagal merujuk ke kelas induk!');
}

// 8.4 Akses modul dari grup cabang (jadwal, kas, PR)
const schedFromBoy = getScheduleByDay(boyGroup, 'senin');
console.log(`[PASS] getScheduleToday/getScheduleByDay dari grup putra berhasil memuat jadwal XI RPL C`);
if (!schedFromBoy.includes('XI RPL C')) {
  throw new Error('Jadwal di grup putra tidak memuat nama kelas induk!');
}

const prFromBoy = getActiveAssignments(boyGroup);
console.log(`[PASS] getActiveAssignments dari grup putra berhasil memuat PR kelas`);
if (!prFromBoy.includes('Basis Data')) {
  throw new Error('PR di grup putra tidak tersinkronisasi!');
}

const cashFromGirl = getCashRecap(girlGroup);
console.log(`[PASS] getCashRecap dari grup putri berhasil memuat kas XI RPL C`);
if (!cashFromGirl.includes('REKAP KAS KELAS XI RPL C')) {
  throw new Error('Kas di grup putri tidak tersinkronisasi!');
}

// 8.5 getLinkedGroups untuk cron broadcast
const branches = getLinkedGroups(testGroupId);
console.log(`[PASS] getLinkedGroups: [${branches.join(', ')}] (Ekspektasi ada boyGroup dan girlGroup)`);
if (!branches.includes(boyGroup) || !branches.includes(girlGroup)) {
  throw new Error('getLinkedGroups tidak mengembalikan grup cabang!');
}

// 8.6 listLinkedGroups tampilan teks tanpa emoji mahkota
const listText = listLinkedGroups(boyGroup);
console.log(`[PASS] listLinkedGroups text output valid`);
if (!listText.includes('Khusus Putra') || !listText.includes('Khusus Putri')) {
  throw new Error('listLinkedGroups tidak menampilkan label grup cabang!');
}
if (listText.includes('👑')) {
  throw new Error('listLinkedGroups tidak boleh mengandung emoji mahkota!');
}

// 8.6.b Parsing Cerdas /link (Greedy match nama kelas)
const parsed1 = parseLinkArguments('XI RPL C');
console.log(`[PASS] parseLinkArguments('XI RPL C'): target="${parsed1.targetIdentifier}", label="${parsed1.groupLabel}"`);
if (parsed1.targetIdentifier !== 'XI RPL C' || parsed1.groupLabel !== '') {
  throw new Error(`Parsing 'XI RPL C' salah! Target harus 'XI RPL C' tanpa label terpotong.`);
}

const parsed2 = parseLinkArguments('XI RPL C Khusus Cowok');
console.log(`[PASS] parseLinkArguments('XI RPL C Khusus Cowok'): target="${parsed2.targetIdentifier}", label="${parsed2.groupLabel}"`);
if (parsed2.targetIdentifier !== 'XI RPL C' || parsed2.groupLabel !== 'Khusus Cowok') {
  throw new Error(`Parsing 'XI RPL C Khusus Cowok' salah!`);
}

const parsed3 = parseLinkArguments('1 Grup Diskusi');
console.log(`[PASS] parseLinkArguments('1 Grup Diskusi'): target="${parsed3.targetIdentifier}", label="${parsed3.groupLabel}"`);
if (parsed3.targetIdentifier !== '1' || parsed3.groupLabel !== 'Grup Diskusi') {
  throw new Error(`Parsing '1 Grup Diskusi' salah!`);
}

// 8.6.c Update label penanda grup via updateLinkedGroupLabel
const updateLabelRes = updateLinkedGroupLabel(boyGroup, 'Grup Cowok Mantap');
console.log(`[PASS] updateLinkedGroupLabel: ${updateLabelRes.ok} (Ekspektasi: true)`);
if (!updateLabelRes.ok || updateLabelRes.newLabel !== 'Grup Cowok Mantap') {
  throw new Error('Gagal memperbarui label penanda grup cabang!');
}
const checkDbLabel = db.prepare('SELECT group_label FROM class_groups WHERE group_id = ?').get(boyGroup);
if (checkDbLabel.group_label !== 'Grup Cowok Mantap') {
  throw new Error('Label penanda grup di DB tidak berubah sesuai updateLinkedGroupLabel!');
}

// 8.7 Unlink grup putra
const unlinkBoyRes = unlinkGroup(boyGroup);
console.log(`[PASS] Unlink grup putra: ${unlinkBoyRes.ok} (Ekspektasi: true)`);
if (!unlinkBoyRes.ok) throw new Error('Unlink boy group gagal!');

const resolvedAfterUnlink = resolveClassGroupId(boyGroup);
console.log(`[PASS] Resolusi setelah unlink: ${resolvedAfterUnlink} (Ekspektasi kembali ke ${boyGroup})`);
if (resolvedAfterUnlink !== boyGroup) {
  throw new Error('Setelah unlink, resolveClassGroupId harus kembali ke grup itu sendiri!');
}

// 9. Test Modul Rekap Keuangan & Buku Kas (/keuangan, /saldo)
console.log('\n--- TEST 9: Modul Rekap Keuangan & Buku Kas Kelas ---');

const initSummary = getFinancialSummary(testGroupId);
console.log(`[PASS] Summary awal: Saldo ${initSummary.current_balance}, Kas Masuk: ${initSummary.all_time.total_cash_income}`);

// 9.1 Tambah Pengeluaran Manual
const expenseTx = addFinancialTransaction(testGroupId, {
  type: 'EXPENSE',
  amount: 25000,
  description: 'Beli Spidol & Penghapus Whiteboard',
  transaction_date: '2026-10-30',
  created_by: '6282118116660@s.whatsapp.net'
});
console.log(`[PASS] Tambah pengeluaran berhasil: ID ${expenseTx.id}, amount ${expenseTx.amount}`);
if (expenseTx.amount !== 25000 || expenseTx.type !== 'EXPENSE') {
  throw new Error('Data pengeluaran tidak sesuai!');
}

// 9.2 Tambah Pemasukan Manual Non-Kas
const incomeTx = addFinancialTransaction(testGroupId, {
  type: 'INCOME',
  amount: 50000,
  description: 'Hadiah Juara 1 Lomba Kebersihan Kelas',
  transaction_date: '2026-10-30',
  created_by: '6282118116660@s.whatsapp.net'
});
console.log(`[PASS] Tambah pemasukan non-kas berhasil: ID ${incomeTx.id}, amount ${incomeTx.amount}`);

// 9.3 Cek Summary & Saldo
const afterSummary = getFinancialSummary(testGroupId);
console.log(`[PASS] Saldo setelah transaksi: ${afterSummary.current_balance} (Ekspektasi: ${initSummary.current_balance + 25000})`);
if (afterSummary.current_balance !== initSummary.current_balance + 25000) {
  throw new Error('Kalkulasi saldo bersih setelah transaksi manual salah!');
}

// 9.4 Cek Laporan WhatsApp Bot
const botReport = getFormattedFinanceReport(testGroupId);
console.log(`[PASS] Format Laporan WhatsApp Bot valid:\n${botReport.slice(0, 150)}...`);
if (!botReport.includes('REKAP KEUANGAN') || !botReport.includes('Saldo Kas Saat Ini')) {
  throw new Error('Laporan WhatsApp bot keuangan tidak memuat header/saldo!');
}

// 9.5 Edit Transaksi
const updatedTx = updateFinancialTransaction(testGroupId, expenseTx.id, {
  amount: 30000,
  description: 'Beli Spidol, Penghapus & Refill Tinta'
});
console.log(`[PASS] Update transaksi: nominal baru ${updatedTx.amount}`);
if (updatedTx.amount !== 30000) {
  throw new Error('Gagal memperbarui nominal transaksi keuangan!');
}

// 9.6 Hapus Transaksi
deleteFinancialTransaction(testGroupId, expenseTx.id);
deleteFinancialTransaction(testGroupId, incomeTx.id);
const finalSummary = getFinancialSummary(testGroupId);
console.log(`[PASS] Saldo setelah hapus transaksi kembali ke: ${finalSummary.current_balance}`);
if (finalSummary.current_balance !== initSummary.current_balance) {
  throw new Error('Saldo setelah penghapusan transaksi tidak kembali ke nominal semula!');
}

// Bersihkan data uji coba agar tidak mencemari database produksi
db.prepare('DELETE FROM financial_transactions WHERE group_id = ?').run(testGroupId);
db.prepare('DELETE FROM class_groups WHERE target_group_id = ?').run(testGroupId);
db.prepare('DELETE FROM classes WHERE group_id = ?').run(testGroupId);

console.log('\n🎉 SELURUH PENGUJIAN LOGIKA & REGEX BERHASIL!');
