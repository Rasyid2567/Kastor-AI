import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../database.sqlite');

let dbInstance;

// Cek runtime: Deno, Bun, atau Node.js
if (typeof Deno !== 'undefined') {
  // Deno: menggunakan built-in node:sqlite (DatabaseSync)
  const { DatabaseSync } = await import('node:sqlite');
  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec('PRAGMA busy_timeout = 5000;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');
} else if (typeof process !== 'undefined' && typeof process.versions?.bun !== 'undefined') {
  // Bun: menggunakan built-in ultra-fast bun:sqlite
  const { Database } = await import('bun:sqlite');
  dbInstance = new Database(dbPath);
  dbInstance.exec('PRAGMA busy_timeout = 5000;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');
} else {
  // Node.js: menggunakan better-sqlite3 atau fallback node:sqlite
  try {
    const { default: Database } = await import('better-sqlite3');
    dbInstance = new Database(dbPath);
    dbInstance.pragma('busy_timeout = 5000');
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  } catch (_) {
    const { DatabaseSync } = await import('node:sqlite');
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec('PRAGMA busy_timeout = 5000;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
  }
}

export const db = dbInstance;

export function initDatabase() {
  db.exec(`
    -- 1. Identitas Grup Kelas
    CREATE TABLE IF NOT EXISTS classes (
        group_id TEXT PRIMARY KEY,
        class_name TEXT NOT NULL,
        academic_year TEXT DEFAULT '2026/2027',
        semester_start_date DATE NOT NULL, -- Acuan minggu ke-1: 2026-07-13
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Master Siswa per Kelas
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        student_number INTEGER NOT NULL,  -- Urutan nomor absen (1-36)
        name TEXT NOT NULL,
        phone_number TEXT,
        nis TEXT,
        birth_info TEXT,
        address TEXT,
        parent_name TEXT,
        FOREIGN KEY(group_id) REFERENCES classes(group_id) ON DELETE CASCADE,
        UNIQUE(group_id, student_number)
    );

    -- 3. Hak Akses Peran Khusus
    CREATE TABLE IF NOT EXISTS class_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        phone_number TEXT NOT NULL,       -- Format: 628xxxxxxxx@s.whatsapp.net
        role TEXT CHECK(role IN ('BENDAHARA', 'KETUA', 'SEKRETARIS')),
        FOREIGN KEY(group_id) REFERENCES classes(group_id) ON DELETE CASCADE,
        UNIQUE(group_id, phone_number, role)
    );

    -- 4. Master Jadwal Blok Mingguan
    CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        week_number INTEGER NOT NULL,      -- Minggu ke-1 s/d Minggu ke-20
        day_index INTEGER NOT NULL,        -- 1: Senin, 2: Selasa, ..., 5: Jumat
        block_type TEXT CHECK(block_type IN ('TEORI', 'BENGKEL')),
        subject_name TEXT NOT NULL,
        teacher_name TEXT NOT NULL,
        room_name TEXT NOT NULL,           -- Ruang Teori (R.2, R.3) atau Bengkel/Lab
        time_start TEXT DEFAULT '07:00',
        time_end TEXT DEFAULT '15:30',
        notes TEXT,
        FOREIGN KEY(group_id) REFERENCES classes(group_id) ON DELETE CASCADE
    );

    -- 5. Pengaturan Kas Kelas
    CREATE TABLE IF NOT EXISTS cash_settings (
        group_id TEXT PRIMARY KEY,
        weekly_fee INTEGER DEFAULT NULL,
        active_weeks_count INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES classes(group_id) ON DELETE CASCADE
    );

    -- 6. Status Pembayaran Kas Siswa per Minggu
    CREATE TABLE IF NOT EXISTS cash_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        student_id INTEGER NOT NULL,
        week_number INTEGER NOT NULL,
        is_paid BOOLEAN DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES classes(group_id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE(group_id, student_id, week_number)
    );

    -- 7. Modul Tugas & PR
    CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        deadline DATETIME NOT NULL,
        created_by TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT 0,
        image_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES classes(group_id) ON DELETE CASCADE
    );

    -- 8. Struktur Organisasi Kelas Tambahan (Key-Value per jabatan)
    CREATE TABLE IF NOT EXISTS organization_structures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        position_name TEXT NOT NULL,
        holder_name TEXT NOT NULL,
        phone_number TEXT,
        FOREIGN KEY(group_id) REFERENCES classes(group_id) ON DELETE CASCADE,
        UNIQUE(group_id, position_name)
    );

    -- 9. Akun Pengguna Dashboard Web (Non-destructive Web Auth)
    CREATE TABLE IF NOT EXISTS web_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('DEVELOPER', 'KETUA', 'WAKIL', 'SEKRETARIS', 'BENDAHARA')),
        group_id TEXT,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES classes(group_id) ON DELETE CASCADE
    );

    -- 10. Sesi Login Dashboard Web (HttpOnly Cookie Store)
    CREATE TABLE IF NOT EXISTS web_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        phone_number TEXT NOT NULL,
        role TEXT NOT NULL,
        active_group_id TEXT,
        csrf_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES web_users(id) ON DELETE CASCADE
    );

    -- 11. Pembatasan Percobaan Login / Brute Force (Rate Limiting)
    CREATE TABLE IF NOT EXISTS web_login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL,
        attempt_at INTEGER NOT NULL,
        is_success BOOLEAN DEFAULT 0
    );

    -- 12. Audit Log Aktivitas Dashboard Web
    CREATE TABLE IF NOT EXISTS web_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        phone_number TEXT,
        role TEXT,
        group_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Pengaturan Sistem Bot Global (Dapat Diatur Developer di Web Dashboard)
    CREATE TABLE IF NOT EXISTS bot_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 14. Riwayat Penggunaan & Cooldown Limit Stiker per Grup
    CREATE TABLE IF NOT EXISTS sticker_rate_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        sender_jid TEXT,
        command TEXT,
        created_at_ms INTEGER NOT NULL
    );

    -- 15. Grup Cabang Terhubung (Multi-Group Class Linking)
    CREATE TABLE IF NOT EXISTS class_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL UNIQUE,       -- ID WhatsApp grup cabang (misal grup putra/putri)
        target_group_id TEXT NOT NULL,      -- ID WhatsApp kelas induk (referensi ke classes.group_id)
        group_label TEXT,                   -- Label grup (misal: 'Putra', 'Putri', 'Umum')
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(target_group_id) REFERENCES classes(group_id) ON DELETE CASCADE
    );

    -- 16. Transaksi Keuangan & Buku Kas (Pemasukan Non-Kas & Pengeluaran)
    CREATE TABLE IF NOT EXISTS financial_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
        amount INTEGER NOT NULL CHECK(amount > 0),
        description TEXT NOT NULL,
        receipt_url TEXT DEFAULT NULL,
        transaction_date DATE NOT NULL,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES classes(group_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_web_users_phone ON web_users(phone_number);
    CREATE INDEX IF NOT EXISTS idx_web_sessions_expires ON web_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_web_login_attempts_id_time ON web_login_attempts(identifier, attempt_at);
    CREATE INDEX IF NOT EXISTS idx_sticker_rate_group_time ON sticker_rate_limits(group_id, created_at_ms);
    CREATE INDEX IF NOT EXISTS idx_class_groups_target ON class_groups(target_group_id);
    CREATE INDEX IF NOT EXISTS idx_fin_tx_group_date ON financial_transactions(group_id, transaction_date);

    INSERT OR IGNORE INTO bot_settings (key, value) VALUES ('sticker_limit_enabled', '1');
    INSERT OR IGNORE INTO bot_settings (key, value) VALUES ('sticker_limit_count', '1');
    INSERT OR IGNORE INTO bot_settings (key, value) VALUES ('sticker_limit_window_seconds', '120');
    INSERT OR IGNORE INTO bot_settings (key, value) VALUES ('sticker_limit_message', 'Pembuatan sticker sedang limit, mohon tunggu sebentar');
  `);

  // Migrasi safe jika kolom image_path belum ada di database yang sudah dibuat
  try {
    const tableInfo = db.prepare('PRAGMA table_info(assignments)').all();
    const hasImagePath = tableInfo.some(col => col.name === 'image_path');
    if (!hasImagePath) {
      db.exec('ALTER TABLE assignments ADD COLUMN image_path TEXT;');
    }
  } catch (e) {
    // ignore
  }

  // Migrasi safe untuk kolom biodata siswa (nis, birth_info, address)
  try {
    const studentCols = db.prepare('PRAGMA table_info(students)').all();
    const colNames = studentCols.map(c => c.name);
    if (!colNames.includes('nis')) {
      db.exec('ALTER TABLE students ADD COLUMN nis TEXT;');
    }
    if (!colNames.includes('birth_info')) {
      db.exec('ALTER TABLE students ADD COLUMN birth_info TEXT;');
    }
    if (!colNames.includes('address')) {
      db.exec('ALTER TABLE students ADD COLUMN address TEXT;');
    }
    if (!colNames.includes('parent_name')) {
      db.exec('ALTER TABLE students ADD COLUMN parent_name TEXT;');
    }
  } catch (e) {
    // ignore
  }
  // Migrasi safe jika tabel class_groups belum dibuat di database yang sudah ada
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS class_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id TEXT NOT NULL UNIQUE,
          target_group_id TEXT NOT NULL,
          group_label TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(target_group_id) REFERENCES classes(group_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_class_groups_target ON class_groups(target_group_id);
    `);
  } catch (e) {
    // ignore
  }

  // Migrasi safe jika tabel financial_transactions belum dibuat di database yang sudah ada
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
          amount INTEGER NOT NULL CHECK(amount > 0),
          description TEXT NOT NULL,
          receipt_url TEXT DEFAULT NULL,
          transaction_date DATE NOT NULL,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(group_id) REFERENCES classes(group_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_fin_tx_group_date ON financial_transactions(group_id, transaction_date);
    `);
  } catch (e) {
    // ignore
  }
}

/**
 * Resolusi grup WhatsApp ke ID kelas induk jika grup ini berstatus linked group (grup cabang)
 */
export function resolveClassGroupId(groupId) {
  if (!groupId) return groupId;
  try {
    const link = db.prepare('SELECT target_group_id FROM class_groups WHERE group_id = ?').get(groupId);
    if (link && link.target_group_id) {
      return link.target_group_id;
    }
  } catch {}
  return groupId;
}

/**
 * Mengambil seluruh JID grup cabang yang terhubung ke kelas induk tertentu
 */
export function getLinkedGroups(targetGroupId) {
  if (!targetGroupId) return [];
  try {
    const rows = db.prepare('SELECT group_id FROM class_groups WHERE target_group_id = ?').all(targetGroupId);
    return rows.map(r => r.group_id);
  } catch {
    return [];
  }
}

export default db;
