/**
 * Unit & Integration Test untuk Client-Side Demo Sandbox
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sandboxFile = path.resolve(__dirname, '../public/demo-sandbox.js');

console.log('🧪 [TEST] Memulai pengujian Demo Sandbox...');

// 1. Verifikasi File Fisik & Syntax
assert.ok(fs.existsSync(sandboxFile), 'File demo-sandbox.js harus ada');
const scriptContent = fs.readFileSync(sandboxFile, 'utf8');
assert.ok(scriptContent.includes('KastorDemoSandbox'), 'Harus mengekspor KastorDemoSandbox');
assert.ok(scriptContent.includes('handleDemoApi'), 'Harus memiliki handler handleDemoApi');
assert.ok(scriptContent.includes('XI Sains Digital (Demo)'), 'Harus menyertakan kelas dummy default');

// 2. Mocking DOM & Browser Environment untuk pengujian logika
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

globalThis.localStorage = localStorageMock;
globalThis.window = {
  location: { pathname: '/demo', search: '', origin: 'http://localhost:3001' },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}) })
};
globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  addEventListener: () => {}
};

// Evaluasi script dalam konteks sandbox
const runSandbox = new Function(scriptContent);
runSandbox();

const Sandbox = globalThis.window.KastorDemoSandbox;
assert.ok(Sandbox, 'Objek global KastorDemoSandbox harus terinisialisasi');

// Test 2a: Inisialisasi awal
Sandbox.activate();
assert.strictEqual(Sandbox.isActive(), true, 'Sandbox harus dalam kondisi aktif');

const initialStore = Sandbox.getStore();
assert.ok(initialStore.students.length >= 10, 'Harus memiliki minimal 10 siswa dummy');
assert.strictEqual(initialStore.classes[0].class_name, 'XI Sains Digital (Demo)', 'Nama kelas dummy sesuai');
assert.strictEqual(initialStore.cash_settings.weekly_fee, 5000, 'Uang kas default 5000');

console.log('  ✅ [PASS] Inisialisasi awal sandbox dan seeding data dummy berhasil');

// Test 2b: Intercept fetch /api/auth/me
const meRes = await globalThis.window.fetch('/api/auth/me');
assert.strictEqual(meRes.status, 200);
const meData = await meRes.json();
assert.strictEqual(meData.ok, true);
assert.strictEqual(meData.user.role, 'DEVELOPER');
assert.strictEqual(meData.user.name, 'Demo Developer');
assert.strictEqual(meData.permissions.can_view_all_classes, true);

console.log('  ✅ [PASS] Intercept GET /api/auth/me mengembalikan profil DEVELOPER demo');

// Test 2c: Tambah siswa baru di sandbox
const addRes = await globalThis.window.fetch('/api/students', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Siswa Percobaan QA',
    phone_number: '081299990001',
    gender: 'L'
  })
});
assert.strictEqual(addRes.status, 201);
const addData = await addRes.json();
assert.strictEqual(addData.ok, true);
assert.strictEqual(addData.student.name, 'Siswa Percobaan QA');

// Verifikasi perubahan tersimpan di mock store
const updatedStore = Sandbox.getStore();
const found = updatedStore.students.find(s => s.name === 'Siswa Percobaan QA');
assert.ok(found, 'Siswa baru harus tersimpan di storage sandbox');

console.log('  ✅ [PASS] Penambahan siswa tersimpan di storage lokal sandbox');

// Test 2d: Edit siswa
const editRes = await globalThis.window.fetch(`/api/students/${found.id}`, {
  method: 'PUT',
  body: JSON.stringify({ name: 'Siswa Percobaan Terupdate' })
});
assert.strictEqual(editRes.status, 200);
const afterEditStore = Sandbox.getStore();
const edited = afterEditStore.students.find(s => s.id === found.id);
assert.strictEqual(edited.name, 'Siswa Percobaan Terupdate');

console.log('  ✅ [PASS] Pembaruan siswa berhasil tercermin di sandbox');

// Test 2e: Hapus siswa
const delRes = await globalThis.window.fetch(`/api/students/${found.id}`, {
  method: 'DELETE'
});
assert.strictEqual(delRes.status, 200);
const afterDelStore = Sandbox.getStore();
assert.strictEqual(afterDelStore.students.some(s => s.id === found.id), false);

console.log('  ✅ [PASS] Penghapusan siswa berhasil');

// Test 2f: Reset Store ("Balik dari 0")
// Tambahkan perubahan acak dulu
afterDelStore.cash_settings.weekly_fee = 20000;
Sandbox.saveStore(afterDelStore);
assert.strictEqual(Sandbox.getStore().cash_settings.weekly_fee, 20000);

// Panggil reset
Sandbox.resetStore();
const resetStore = Sandbox.getStore();
assert.strictEqual(resetStore.cash_settings.weekly_fee, 5000, 'Uang kas harus kembali ke default 5000');
assert.strictEqual(resetStore.students.length, 10, 'Jumlah siswa harus kembali ke default 10');

console.log('  ✅ [PASS] Reset store ("Balik dari 0") berhasil mengembalikan kondisi awal');

// Test 2g: Keluar dari Demo
Sandbox.exit();
assert.strictEqual(localStorage.getItem('kastor_demo_active'), null);
assert.strictEqual(localStorage.getItem('kastor_demo_store'), null);

console.log('  ✅ [PASS] Keluar sesi demo berhasil membersihkan storage');

console.log('\n🎉 SELURUH PENGUJIAN DEMO SANDBOX BERHASIL LULUS 100%!');
