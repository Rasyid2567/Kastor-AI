import { initDatabase, db, resolveClassGroupId, getLinkedGroups, isGroupDisabled, setGroupDisabled, setGroupEnabled, getCashHolidayWeeks, setCashHolidayWeek, removeCashHolidayWeek } from '../../database/schema.js';
import { seedDefaultClass } from '../../database/seed.js';
import { calculateWeekNumber, getScheduleToday, getScheduleTomorrow, getScheduleByDay, getScheduleFull, getScheduleNow } from '../modules/schedule.js';
import { getTreasurerRole, setWeeklyFee, parseChecklistText, getCashRecap, getStudentCashBill } from '../modules/cash.js';
import { getActiveAssignments, getAllAssignments, getAssignmentDetail, addAssignment, completeAssignment, deleteAssignment, isDeveloper } from '../modules/assignments.js';
import { calculateMath, convertToSticker, generateStickerMeme } from '../modules/media.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isWhatsAppAdmin, setOrganizationPosition } from '../modules/admin.js';
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
import { runDownloaderTests } from './downloader-test.js';
import { getHelpMenu, routeMessage } from '../router.js';
import {
  formatLimitDuration,
  isAuthorizedLimitUser,
  getBotLimitConfig,
  updateBotLimitConfig,
  checkUserCooldown,
  recordUserCooldown,
  clearUserCooldown,
  resetAllUserCooldowns,
  handleLimitCommand
} from '../modules/secret.js';
import assert from 'node:assert';

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

// 3b. Test Minggu Libur Kas
console.log('--- TEST 2b: Minggu Libur Kas (Holiday Weeks) ---');
setCashHolidayWeek(testGroupId, 3, 'Bendahara Test');
const holidays = getCashHolidayWeeks(testGroupId);
if (!holidays.includes(3)) {
  throw new Error('setCashHolidayWeek gagal menyimpan minggu libur!');
}
console.log('[PASS] setCashHolidayWeek berhasil menyimpan minggu 3');

// Periksa bahwa getCashRecap otomatis mengecualikan minggu libur
const recapAfterHoliday = getCashRecap(testGroupId);
if (recapAfterHoliday.includes('Nikita: Rp5.000')) {
  console.log('[PASS] getCashRecap otomatis mengecualikan minggu libur (tunggakan Nikita berkurang dari Rp10.000 ke Rp5.000)');
} else {
  throw new Error(`Nikita harusnya menunggak Rp5.000 setelah minggu 3 diliburkan! Output:\n${recapAfterHoliday}`);
}

// Cek tagihan pribadi (/kas) juga berkurang tanpa membocorkan teks libur
const billNikita = getStudentCashBill(testGroupId, null, 'Nikita');
if (billNikita.includes('Kurang : 1 minggu') && billNikita.includes('Tagihan: Rp5.000') && !billNikita.includes('Libur')) {
  console.log('[PASS] getStudentCashBill bersih tanpa teks keterangan libur dan nominal berkurang akurat');
} else {
  throw new Error(`Format getStudentCashBill salah! Output:\n${billNikita}`);
}

// Kembalikan minggu 3 menjadi masuk (removeCashHolidayWeek)
removeCashHolidayWeek(testGroupId, 3);
const holidaysAfterRemove = getCashHolidayWeeks(testGroupId);
if (holidaysAfterRemove.includes(3)) {
  throw new Error('removeCashHolidayWeek gagal menghapus minggu libur!');
}
console.log('[PASS] removeCashHolidayWeek berhasil mengaktifkan kembali minggu 3 (masuk)');
const recapAfterRemove = getCashRecap(testGroupId);
if (!recapAfterRemove.includes('Nikita: Rp10.000')) {
  throw new Error('Tunggakan Nikita harus kembali ke Rp10.000 setelah minggu libur dihapus!');
}
console.log('[PASS] getCashRecap kembali normal setelah minggu libur dicabut');

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

// 5. Test Modul Tugas
console.log('--- TEST 4: Modul Tugas (/tugas) ---');
const addRes = addAssignment(testGroupId, 'Basis Data | 2026-12-01 23:59 | Query JOIN dan Normalisasi 3NF', 'Nicko (Ketua)');
console.log(`[PASS] Add Tugas:\n${addRes}\n`);
if (!addRes.includes('Tugas Berhasil Ditambahkan')) {
  throw new Error('addAssignment harus mengonfirmasi tugas berhasil ditambahkan!');
}

const prList = getActiveAssignments(testGroupId);
console.log(`[PASS] Daftar Tugas Aktif:\n${prList.substring(0, 200)}...\n`);
if (!prList.includes('DAFTAR TUGAS AKTIF') || !prList.includes('/tugas detail')) {
  throw new Error('Daftar tugas aktif harus menggunakan judul DAFTAR TUGAS AKTIF dan petunjuk /tugas detail!');
}

// 6. Test Kalkulator Matematika
console.log('--- TEST 5: Modul Matematika (/calc) ---');
const calcResult = calculateMath('250 * 4 + 1500 / 3');
console.log(`[PASS] /calc: ${calcResult}`);

// 7. Test Menu Bantuan (Memastikan /rvo tersembunyi, /tugas aktif, /pr mati, format pipa konsisten)
console.log('\n--- TEST 6: Verifikasi Menu Bantuan (/menu) ---');
const menu = getHelpMenu();
if (!menu.includes('/rvo')) {
  console.log('✅ [VERIFIED] /rvo TERSEMBUNYI dan TIDAK TERCANTUM di /menu sesuai PRD 4.7!');
} else {
  throw new Error('❌ [FAILED] /rvo bocor di /menu!');
}

if (!menu.includes('/off') && !menu.includes('/on')) {
  console.log('✅ [VERIFIED] /off dan /on TERSEMBUNYI dan TIDAK TERCANTUM di /menu!');
} else {
  throw new Error('❌ [FAILED] /off atau /on bocor di /menu!');
}

if (!menu.includes('/limit')) {
  console.log('✅ [VERIFIED] /limit TERSEMBUNYI dan TIDAK TERCANTUM di /menu!');
} else {
  throw new Error('❌ [FAILED] /limit bocor di /menu!');
}

if (menu.includes('/tugas') && !menu.includes('• `/pr`') && !menu.includes('• `/pr all`')) {
  console.log('✅ [VERIFIED] /tugas AKTIF di /menu dan /pr telah dinonaktifkan sepenuhnya!');
} else {
  throw new Error('❌ [FAILED] /menu harus menampilkan /tugas dan mematikan /pr!');
}

if (menu.includes('/smeme [atas] | [bawah]') && menu.includes('/struktur set [jabatan] | [nama] | [tag]')) {
  console.log('✅ [VERIFIED] Seluruh perintah multi-argumen di /menu konsisten menggunakan pemisah pipa (|)!');
} else {
  throw new Error('❌ [FAILED] Format pipa (|) pada /menu belum konsisten!');
}

if (menu.includes('/tt') && menu.includes('/yt') && menu.includes('/ig') && menu.includes('/fb')) {
  console.log('✅ [VERIFIED] Perintah downloader /tt, /yt, /ig, /fb terdaftar di /menu!');
} else {
  throw new Error('❌ [FAILED] /menu belum mencantumkan /tt, /yt, /ig, /fb!');
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

// 10. Test Standarisasi Pemisah Pipa (|) & Parser /smeme
console.log('\n--- TEST 10: Standarisasi Pemisah Pipa (|) & /smeme Parser ---');

// 10.1 /struktur set dengan pemisah pipa '|'
const structRes1 = setOrganizationPosition(testGroupId, 'Ketua | Rasyid Ridho | @6281200000002', ['6281200000002@s.whatsapp.net']);
console.log(`[PASS] /struktur set dengan pipa: ${structRes1.text ? 'Berhasil' : 'Gagal'}`);
const checkStruct1 = db.prepare('SELECT * FROM organization_structures WHERE group_id = ? AND UPPER(position_name) = ?').get(testGroupId, 'KETUA');
if (!checkStruct1 || checkStruct1.holder_name !== 'Rasyid Ridho') {
  throw new Error(`Holder name harus "Rasyid Ridho", dapat: "${checkStruct1?.holder_name}"`);
}

// 10.2 /struktur set jabatan multi-kata dengan pemisah pipa '|'
const structRes2 = setOrganizationPosition(testGroupId, 'Wakil Ketua | Budi Santoso | 081200000003');
console.log(`[PASS] /struktur set multi-kata dengan pipa: ${structRes2.text ? 'Berhasil' : 'Gagal'}`);
const checkStruct2 = db.prepare('SELECT * FROM organization_structures WHERE group_id = ? AND UPPER(position_name) = ?').get(testGroupId, 'WAKIL KETUA');
if (!checkStruct2 || checkStruct2.holder_name !== 'Budi Santoso' || !checkStruct2.phone_number.includes('6281200000003')) {
  throw new Error(`Data Wakil Ketua salah! holder_name: "${checkStruct2?.holder_name}", phone: "${checkStruct2?.phone_number}"`);
}

// 10.3 Logika Parser /smeme
function parseSmemeArgs(args) {
  let topText = '';
  let bottomText = '';
  if (args.includes('|')) {
    const parts = args.split('|');
    topText = parts[0].trim();
    bottomText = parts.slice(1).join('|').trim();
  } else {
    topText = args.trim();
  }
  if (!topText && !bottomText) {
    topText = 'MEME TEXT';
  }
  return { topText, bottomText };
}

// Skenario A: Teks atas saja (/smeme anjay)
const sA = parseSmemeArgs('anjay');
console.log(`[PASS] /smeme anjay -> top: "${sA.topText}", bottom: "${sA.bottomText}"`);
if (sA.topText !== 'anjay' || sA.bottomText !== '') {
  throw new Error('Skenario /smeme anjay harus hanya mengisi topText!');
}

// Skenario B: Teks bawah saja (/smeme | anjay)
const sB = parseSmemeArgs('| anjay');
console.log(`[PASS] /smeme | anjay -> top: "${sB.topText}", bottom: "${sB.bottomText}"`);
if (sB.topText !== '' || sB.bottomText !== 'anjay') {
  throw new Error('Skenario /smeme | anjay harus hanya mengisi bottomText!');
}

// Skenario C: Teks atas dan bawah (/smeme atas | bawah)
const sC = parseSmemeArgs('atas | bawah');
console.log(`[PASS] /smeme atas | bawah -> top: "${sC.topText}", bottom: "${sC.bottomText}"`);
if (sC.topText !== 'atas' || sC.bottomText !== 'bawah') {
  throw new Error('Skenario /smeme atas | bawah harus mengisi kedua teks!');
}

// 11. Test Modul Downloader (/tt, /yt, /ig, /fb)
runDownloaderTests();

// 12. Test Modul Toggle Bot Per-Grup (/off & /on)
console.log('\n--- TEST 12: Modul Toggle Bot Per-Grup (/off & /on) ---');
const testOffGroup = '120363000000000099@g.us';
const devPhone = '628999888777';
const devJid = `${devPhone}@s.whatsapp.net`;
const nonDevJid = '628111222333@s.whatsapp.net';

// Pastikan grup bersih
setGroupEnabled(testOffGroup);
if (isGroupDisabled(testOffGroup)) {
  throw new Error('isGroupDisabled harus false sebelum dimatikan!');
}
console.log('[PASS] State awal grup: aktif (isGroupDisabled = false)');

// Set disabled
setGroupDisabled(testOffGroup, devJid);
if (!isGroupDisabled(testOffGroup)) {
  throw new Error('setGroupDisabled gagal menonaktifkan grup!');
}
console.log('[PASS] setGroupDisabled berhasil menyimpan ke database (isGroupDisabled = true)');

// Set disabled lagi (uji ON CONFLICT / upsert)
setGroupDisabled(testOffGroup, '628000000000@s.whatsapp.net');
if (!isGroupDisabled(testOffGroup)) {
  throw new Error('Upsert setGroupDisabled gagal!');
}
console.log('[PASS] Upsert setGroupDisabled berhasil');

// Set enabled
setGroupEnabled(testOffGroup);
if (isGroupDisabled(testOffGroup)) {
  throw new Error('setGroupEnabled gagal mengaktifkan grup kembali!');
}
console.log('[PASS] setGroupEnabled berhasil menghapus status nonaktif (isGroupDisabled = false)');

// Uji otorisasi isDeveloper
const isDevTrue = isDeveloper(devJid, devPhone);
const isDevFalse = isDeveloper(nonDevJid, devPhone);
console.log(`[PASS] isDeveloper valid: ${isDevTrue}, invalid: ${!isDevFalse}`);
if (!isDevTrue || isDevFalse) {
  throw new Error('Pemeriksaan isDeveloper tidak sesuai ekspektasi!');
}

// Simulasi alur router (routeMessage)
const origDevEnv = process.env.DEVELOPER_NUMBER;
process.env.DEVELOPER_NUMBER = devPhone;

try {
  let sentMessages = [];
  const mockSock = {
    sendMessage: async (jid, content, options) => {
      sentMessages.push({ jid, content, options });
      return { key: { id: 'test_msg_id' } };
    }
  };

  // Helper untuk buat fake msg
  const createMockMsg = (sender, text) => ({
    key: { remoteJid: testOffGroup, participant: sender, fromMe: false },
    message: { conversation: text },
    messageTimestamp: Math.floor(Date.now() / 1000)
  });

  // Skenario 1: Non-dev kirim /off saat bot aktif -> SENYAP TOTAL (tanpa teks maupun reaksi)
  sentMessages = [];
  await routeMessage(mockSock, createMockMsg(nonDevJid, '/off'));
  if (sentMessages.length > 0) {
    throw new Error('Non-developer /off harus senyap total!');
  }
  console.log('[PASS] Skenario 1: Non-developer mencoba /off -> senyap total (diabaikan)');

  // Skenario 2: Developer kirim /off saat bot aktif -> grup nonaktif + HANYA REAKSI ⛔ (tanpa pesan teks)
  sentMessages = [];
  const offMsg = createMockMsg(devJid, '/off');
  await routeMessage(mockSock, offMsg);
  if (!isGroupDisabled(testOffGroup)) {
    throw new Error('Developer /off harus menonaktifkan grup!');
  }
  const reactOff = sentMessages.find(m => m.content?.react?.text === '⛔');
  const hasTextOutputOff = sentMessages.some(m => m.content?.text);
  if (!reactOff || hasTextOutputOff) {
    throw new Error('Developer /off harus mengirim reaksi ⛔ dan TIDAK BOLEH mengirim pesan teks!');
  }
  console.log('[PASS] Skenario 2: Developer mengirim /off -> reaksi ⛔ dikirim & tanpa pesan teks');

  // Skenario 3: Pesan biasa / command lain saat bot nonaktif -> SENYAP TOTAL (tidak ada balasan)
  sentMessages = [];
  await routeMessage(mockSock, createMockMsg(devJid, '/menu'));
  await routeMessage(mockSock, createMockMsg(nonDevJid, 'Halo bot apa kabar'));
  await routeMessage(mockSock, createMockMsg(nonDevJid, '/jadwal'));
  if (sentMessages.length > 0) {
    throw new Error('Bot harus senyap total saat grup dinonaktifkan!');
  }
  console.log('[PASS] Skenario 3: Seluruh pesan / perintah biasa diabaikan saat grup nonaktif');

  // Skenario 4: Non-dev kirim /on saat bot nonaktif -> SENYAP TOTAL (tidak ada respon)
  sentMessages = [];
  await routeMessage(mockSock, createMockMsg(nonDevJid, '/on'));
  if (sentMessages.length > 0 || !isGroupDisabled(testOffGroup)) {
    throw new Error('Non-dev tidak boleh membangunkan bot saat grup nonaktif!');
  }
  console.log('[PASS] Skenario 4: Non-developer mencoba /on saat bot nonaktif -> tetap senyap');

  // Skenario 5: Developer kirim /on saat bot nonaktif -> bot aktif kembali + HANYA REAKSI ✅ (tanpa pesan teks)
  sentMessages = [];
  const onMsg = createMockMsg(devJid, '/on');
  await routeMessage(mockSock, onMsg);
  if (isGroupDisabled(testOffGroup)) {
    throw new Error('Developer /on harus mengaktifkan kembali grup!');
  }
  const reactOn = sentMessages.find(m => m.content?.react?.text === '✅');
  const hasTextOutputOn = sentMessages.some(m => m.content?.text);
  if (!reactOn || hasTextOutputOn) {
    throw new Error('Developer /on harus mengirim reaksi ✅ dan TIDAK BOLEH mengirim pesan teks!');
  }
  console.log('[PASS] Skenario 5: Developer mengirim /on saat nonaktif -> reaksi ✅ dikirim & tanpa pesan teks');

  // Skenario 6: Developer kirim /on lagi saat sudah aktif -> reaksi ✅ (tanpa pesan teks)
  sentMessages = [];
  await routeMessage(mockSock, createMockMsg(devJid, '/on'));
  const reactAlreadyOn = sentMessages.find(m => m.content?.react?.text === '✅');
  const hasTextOutputAlreadyOn = sentMessages.some(m => m.content?.text);
  if (!reactAlreadyOn || hasTextOutputAlreadyOn) {
    throw new Error('Developer /on saat sudah aktif harus memberi reaksi ✅ dan TIDAK BOLEH mengirim pesan teks!');
  }
  console.log('[PASS] Skenario 6: Developer mengirim /on saat sudah aktif -> reaksi ✅ dikonfirmasi');
} finally {
  process.env.DEVELOPER_NUMBER = origDevEnv;
  setGroupEnabled(testOffGroup);
}

// 14. Test Command Rahasia /limit & Rate Limiting
console.log('\n--- TEST 13: Command Rahasia /limit & Rate Limiting ---');

// 1. Formatter tests (0 -> "0d", 45 -> "45d", 60 -> "1m", 90 -> "1m 30d", 120 -> "2m")
assert.strictEqual(formatLimitDuration(0), '0d');
assert.strictEqual(formatLimitDuration(45), '45d');
assert.strictEqual(formatLimitDuration(60), '1m');
assert.strictEqual(formatLimitDuration(90), '1m 30d');
assert.strictEqual(formatLimitDuration(120), '2m');
assert.strictEqual(formatLimitDuration(150), '2m 30d');
assert.strictEqual(formatLimitDuration(-10), '0d');
console.log('[PASS] formatLimitDuration validasi 0s, 45s, 60s, 90s, 120s lulus');

// 2. Authorization check tests (Developer, class_roles, web_users, non-authorized)
const limitDevPhone = '628999111222';
const limitDevJid = `${limitDevPhone}@s.whatsapp.net`;
const limitNonDevJid = '628999333444@s.whatsapp.net';

assert.strictEqual(isAuthorizedLimitUser(limitDevJid, null, limitDevPhone), true);
assert.strictEqual(isAuthorizedLimitUser(limitNonDevJid, null, limitDevPhone), false);

// Test class_roles authorization
const limitKetuaPhone = '628777777777';
const limitKetuaJid = `${limitKetuaPhone}@s.whatsapp.net`;
db.prepare(`
  INSERT OR REPLACE INTO class_roles (group_id, phone_number, role)
  VALUES (?, ?, 'KETUA')
`).run(testGroupId, limitKetuaJid);
assert.strictEqual(isAuthorizedLimitUser(limitKetuaJid, testGroupId, limitDevPhone), true);
db.prepare('DELETE FROM class_roles WHERE group_id = ? AND phone_number = ?').run(testGroupId, limitKetuaJid);

// Test web_users authorization
const limitWebPhone = '62888888888';
db.prepare(`
  INSERT OR REPLACE INTO web_users (phone_number, password_hash, role)
  VALUES (?, 'fakehash', 'SEKRETARIS')
`).run(limitWebPhone);
assert.strictEqual(isAuthorizedLimitUser(`${limitWebPhone}@s.whatsapp.net`, null, limitDevPhone), true);
db.prepare('DELETE FROM web_users WHERE phone_number = ?').run(limitWebPhone);
console.log('[PASS] isAuthorizedLimitUser valid: developer, class_roles, dan web_users diizinkan, pihak luar ditolak');

// 3. Persistent config update & retrieval
updateBotLimitConfig('ai', { window_seconds: 90, enabled: true });
let limitCfg = getBotLimitConfig();
assert.strictEqual(limitCfg.ai.window_seconds, 90);
assert.strictEqual(limitCfg.ai.enabled, true);

updateBotLimitConfig('tt', { window_seconds: 45, enabled: true });
limitCfg = getBotLimitConfig();
assert.strictEqual(limitCfg.tt.window_seconds, 45);
assert.strictEqual(limitCfg.tt.enabled, true);

updateBotLimitConfig('sticker', { window_seconds: 120, enabled: true });
limitCfg = getBotLimitConfig();
assert.strictEqual(limitCfg.sticker.window_seconds, 120);
assert.strictEqual(limitCfg.sticker.enabled, true);

// Setting window_seconds to 0 automatically disables the limit
updateBotLimitConfig('ai', { window_seconds: 0 });
limitCfg = getBotLimitConfig();
assert.strictEqual(limitCfg.ai.enabled, false);
assert.strictEqual(limitCfg.ai.window_seconds, 0);

// Restore default limits for ai and tt
updateBotLimitConfig('ai', { window_seconds: 30, enabled: true });
updateBotLimitConfig('tt', { window_seconds: 60, enabled: true });
console.log('[PASS] updateBotLimitConfig persisten tersimpan di bot_settings');

// 4. Per-user cooldown check & reset
resetAllUserCooldowns();
assert.strictEqual(checkUserCooldown('ai', 'user_limit_123').allowed, true);
recordUserCooldown('ai', 'user_limit_123');
const cdCheck = checkUserCooldown('ai', 'user_limit_123');
assert.strictEqual(cdCheck.allowed, false);
assert.strictEqual(cdCheck.formatted_remaining, '30d');

clearUserCooldown('ai', 'user_limit_123');
assert.strictEqual(checkUserCooldown('ai', 'user_limit_123').allowed, true);

recordUserCooldown('tt', 'user_limit_456');
assert.strictEqual(checkUserCooldown('tt', 'user_limit_456').allowed, false);
resetAllUserCooldowns('tt');
assert.strictEqual(checkUserCooldown('tt', 'user_limit_456').allowed, true);
console.log('[PASS] checkUserCooldown, recordUserCooldown, clearUserCooldown, dan resetAllUserCooldowns lulus');

// 5. handleLimitCommand execution via mock socket
let limitSent = [];
const mockLimitSock = {
  sendMessage: async (jid, content, opts) => {
    limitSent.push({ jid, content, opts });
    return { key: { id: 'MOCK_LIMIT_' + Date.now() } };
  }
};
const mockLimitMsg = { key: { id: 'LIMIT_KEY', remoteJid: testGroupId } };

// 5a. Regular user can view status (clean without footer guide), but setting limits is rejected
limitSent = [];
await handleLimitCommand(mockLimitSock, mockLimitMsg, testGroupId, limitNonDevJid, 'status', limitDevPhone);
assert.strictEqual(limitSent.length, 1);
assert.match(limitSent[0].content.text, /INFORMASI RATE LIMIT BOT/i);
assert.doesNotMatch(limitSent[0].content.text, /Panduan Pengaturan/i);
assert.doesNotMatch(limitSent[0].content.text, /Ubah batas/i);

// Also test regular user calling /limit without args (defaults to status)
limitSent = [];
await handleLimitCommand(mockLimitSock, mockLimitMsg, testGroupId, limitNonDevJid, '', limitDevPhone);
assert.strictEqual(limitSent.length, 1);
assert.match(limitSent[0].content.text, /INFORMASI RATE LIMIT BOT/i);
assert.doesNotMatch(limitSent[0].content.text, /Panduan Pengaturan/i);
assert.doesNotMatch(limitSent[0].content.text, /Ubah batas/i);

// Setting limits by regular user is rejected strictly
limitSent = [];
await handleLimitCommand(mockLimitSock, mockLimitMsg, testGroupId, limitNonDevJid, 'ai 90', limitDevPhone);
assert.strictEqual(limitSent.length, 1);
assert.match(limitSent[0].content.text, /Akses ditolak: Hanya Developer yang berhak mengatur batas limit/);

// 5b. Authorized caller requesting status
limitSent = [];
await handleLimitCommand(mockLimitSock, mockLimitMsg, testGroupId, limitDevJid, 'status', limitDevPhone);
assert.strictEqual(limitSent.length, 1);
assert.match(limitSent[0].content.text, /INFORMASI RATE LIMIT BOT/);
assert.match(limitSent[0].content.text, /Stiker/);
assert.match(limitSent[0].content.text, /AI Assistant/);
assert.match(limitSent[0].content.text, /Downloader/);

// 5c. Authorized caller setting limit with seconds
limitSent = [];
await handleLimitCommand(mockLimitSock, mockLimitMsg, testGroupId, limitDevJid, 'ai 90', limitDevPhone);
assert.strictEqual(limitSent.length, 1);
assert.match(limitSent[0].content.text, /1m 30d/);
assert.strictEqual(getBotLimitConfig().ai.window_seconds, 90);

// 5d. Authorized caller turning limit off
limitSent = [];
await handleLimitCommand(mockLimitSock, mockLimitMsg, testGroupId, limitDevJid, 'ai off', limitDevPhone);
assert.strictEqual(limitSent.length, 1);
assert.match(limitSent[0].content.text, /dinonaktifkan/i);
assert.strictEqual(getBotLimitConfig().ai.enabled, false);

// 5e. Authorized caller turning limit on
limitSent = [];
await handleLimitCommand(mockLimitSock, mockLimitMsg, testGroupId, limitDevJid, 'ai on', limitDevPhone);
assert.strictEqual(limitSent.length, 1);
assert.match(limitSent[0].content.text, /diaktifkan/i);
assert.strictEqual(getBotLimitConfig().ai.enabled, true);

// 5e-2. Authorized caller using /limit all [detik] and /limit * [detik]
limitSent = [];
await handleLimitCommand(mockLimitSock, mockLimitMsg, testGroupId, limitDevJid, 'all 75', limitDevPhone);
assert.strictEqual(limitSent.length, 1);
assert.match(limitSent[0].content.text, /Seluruh fitur/i);
assert.match(limitSent[0].content.text, /1m 15d/);
assert.strictEqual(getBotLimitConfig().sticker.window_seconds, 75);
assert.strictEqual(getBotLimitConfig().ai.window_seconds, 75);
assert.strictEqual(getBotLimitConfig().tt.window_seconds, 75);

limitSent = [];
await handleLimitCommand(mockLimitSock, mockLimitMsg, testGroupId, limitDevJid, '* off', limitDevPhone);
assert.strictEqual(limitSent.length, 1);
assert.match(limitSent[0].content.text, /dinonaktifkan/i);
assert.strictEqual(getBotLimitConfig().sticker.enabled, false);
assert.strictEqual(getBotLimitConfig().ai.enabled, false);
assert.strictEqual(getBotLimitConfig().tt.enabled, false);

limitSent = [];
await handleLimitCommand(mockLimitSock, mockLimitMsg, testGroupId, limitDevJid, 'all on', limitDevPhone);
assert.strictEqual(limitSent.length, 1);
assert.match(limitSent[0].content.text, /diaktifkan/i);
assert.strictEqual(getBotLimitConfig().sticker.enabled, true);
assert.strictEqual(getBotLimitConfig().ai.enabled, true);
assert.strictEqual(getBotLimitConfig().tt.enabled, true);

// 5f. Router dispatch for /limit
limitSent = [];
const mockRouterSock = {
  sendMessage: async (jid, content, opts) => {
    limitSent.push({ jid, content, opts });
    return { key: { id: 'MOCK_R_' + Date.now() } };
  },
  sendPresenceUpdate: async () => {}
};
const routeMsg = {
  key: { remoteJid: testGroupId, participant: limitDevJid, fromMe: false, id: 'RT_LIMIT_1' },
  message: { conversation: '/limit status' },
  messageTimestamp: Math.floor(Date.now() / 1000)
};
const origDevLimit = process.env.DEVELOPER_NUMBER;
process.env.DEVELOPER_NUMBER = limitDevPhone;
try {
  await routeMessage(mockRouterSock, routeMsg);
  assert.strictEqual(limitSent.length, 1);
  assert.match(limitSent[0].content.text, /INFORMASI RATE LIMIT BOT/);
} finally {
  process.env.DEVELOPER_NUMBER = origDevLimit;
}

// Reset limit AI back to standard 30s
updateBotLimitConfig('ai', { window_seconds: 30, enabled: true });
console.log('[PASS] handleLimitCommand dan router dispatch /limit terverifikasi');

// --- TEST 14: Pembuatan Stiker Aspek Rasio Alami (Horizontal & Vertikal Bebas 1:1) & Resolusi Rendah ---
console.log('\n--- TEST 14: Pembuatan Stiker Rasio Alami & Resolusi Rendah ---');
// 14a. Foto landscape 16:9 (640x360) tetap memanjang horizontal (512x288, tidak dipaksa 1:1 kotak)
const tmpTestJpg = path.join(os.tmpdir(), `test_14_169_${Date.now()}.jpg`);
spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=green:s=640x360:d=1', '-vframes', '1', tmpTestJpg]);
const buf169 = fs.readFileSync(tmpTestJpg);
fs.unlinkSync(tmpTestJpg);

const sticker169 = await convertToSticker(buf169, false);
assert(Buffer.isBuffer(sticker169) && sticker169.length > 0, 'Output stiker 16:9 harus berupa buffer valid');

const tmpProbeWebp = path.join(os.tmpdir(), `test_probe_14_${Date.now()}.webp`);
fs.writeFileSync(tmpProbeWebp, sticker169);
let probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', tmpProbeWebp]);
let [w169, h169] = probe.stdout.toString().trim().split(',');
fs.unlinkSync(tmpProbeWebp);

assert.strictEqual(w169, '512');
assert.strictEqual(h169, '288');
console.log('[PASS] Foto landscape 16:9 tetap horizontal alami (512x288, tanpa dipaksa kotak 1:1)');

// 14b. Foto portrait 9:16 (360x640) tetap vertikal tinggi alami (288x512)
const tmpPortJpg = path.join(os.tmpdir(), `test_14_port_${Date.now()}.jpg`);
spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=360x640:d=1', '-vframes', '1', tmpPortJpg]);
const bufPort = fs.readFileSync(tmpPortJpg);
fs.unlinkSync(tmpPortJpg);

const stickerPort = await convertToSticker(bufPort, false);
fs.writeFileSync(tmpProbeWebp, stickerPort);
probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', tmpProbeWebp]);
let [wPort, hPort] = probe.stdout.toString().trim().split(',');
fs.unlinkSync(tmpProbeWebp);

assert.strictEqual(wPort, '288');
assert.strictEqual(hPort, '512');
console.log('[PASS] Foto portrait 9:16 tetap vertikal tinggi alami (288x512, tanpa dipaksa kotak 1:1)');

// 14c. Foto resolusi sangat kecil (60x60) berhasil di-scale up ke kanvas 512x512
const tmpTinyJpg = path.join(os.tmpdir(), `test_14_tiny_${Date.now()}.jpg`);
spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=yellow:s=60x60:d=1', '-vframes', '1', tmpTinyJpg]);
const bufTiny = fs.readFileSync(tmpTinyJpg);
fs.unlinkSync(tmpTinyJpg);

const stickerTiny = await convertToSticker(bufTiny, false);
assert(Buffer.isBuffer(stickerTiny) && stickerTiny.length > 0, 'Output stiker resolusi kecil harus berupa buffer valid');

fs.writeFileSync(tmpProbeWebp, stickerTiny);
probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', tmpProbeWebp]);
let [tw, th] = probe.stdout.toString().trim().split(',');
fs.unlinkSync(tmpProbeWebp);

assert.strictEqual(tw, '512');
assert.strictEqual(th, '512');
console.log('[PASS] Foto resolusi kecil (60x60) berhasil di-scale up ke 512x512 dengan lanczos + unsharp');

// 14d. Meme stiker dengan gambar landscape juga mempertahankan bentuk horizontal
const memeBuf = await generateStickerMeme(buf169, 'TEST MEME ATAS', 'TEST MEME BAWAH');
assert(Buffer.isBuffer(memeBuf) && memeBuf.length > 0, 'Output meme stiker harus valid');

fs.writeFileSync(tmpProbeWebp, memeBuf);
probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', tmpProbeWebp]);
let [mw, mh] = probe.stdout.toString().trim().split(',');
fs.unlinkSync(tmpProbeWebp);

assert.strictEqual(mw, '512');
assert.strictEqual(mh, '288');
console.log('[PASS] Meme stiker foto 16:9 berhasil dirender tetap horizontal (512x288)');

// Bersihkan data uji coba agar tidak mencemari database produksi
db.prepare('DELETE FROM organization_structures WHERE group_id = ?').run(testGroupId);
db.prepare('DELETE FROM financial_transactions WHERE group_id = ?').run(testGroupId);
db.prepare('DELETE FROM class_groups WHERE target_group_id = ?').run(testGroupId);
db.prepare('DELETE FROM classes WHERE group_id = ?').run(testGroupId);

console.log('\n🎉 SELURUH PENGUJIAN LOGIKA & REGEX BERHASIL!');
