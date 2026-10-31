import crypto from 'node:crypto';
import { db } from '../../database/schema.js';

export const SESSION_COOKIE_NAME = 'aras_session';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 menit
export const MAX_FAILED_ATTEMPTS = 5;

const ROLE_PRIORITY = {
  DEVELOPER: 100,
  KETUA: 80,
  WAKIL: 70,
  SEKRETARIS: 60,
  BENDAHARA: 50
};

/**
 * Normalisasi nomor HP Indonesia ke format 628xxxxxxxxxx
 * Validasi panjang digit (10-15 digit, diawali 628). Jika tidak valid -> null.
 */
export function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let trimmed = raw.trim();
  // Jika berformat JID WhatsApp, ambil bagian sebelum '@' dan ':'
  if (trimmed.includes('@')) {
    trimmed = trimmed.split('@')[0];
  }
  if (trimmed.includes(':')) {
    trimmed = trimmed.split(':')[0];
  }

  // Tolak jika mengandung huruf alfabet (misal email atau injeksi string aneh)
  if (/[a-zA-Z]/.test(trimmed)) return null;

  // Bersihkan karakter non-digit
  let digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return null;

  if (digits.startsWith('08')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  } else if (digits.startsWith('00628')) {
    digits = digits.slice(2);
  }

  if (!/^628\d{7,12}$/.test(digits)) {
    return null;
  }

  return digits;
}

/**
 * Cari nama pengurus/siswa berdasarkan nomor telepon dan kelas
 */
function lookupHolderName(normalizedPhone, groupId = null) {
  const jid = `${normalizedPhone}@s.whatsapp.net`;
  const localZero = '0' + normalizedPhone.slice(2);

  if (groupId) {
    const org = db.prepare(`
      SELECT holder_name FROM organization_structures
      WHERE group_id = ? AND (phone_number = ? OR phone_number = ? OR phone_number = ?)
      LIMIT 1
    `).get(groupId, normalizedPhone, jid, localZero);
    if (org && org.holder_name) return org.holder_name;

    const student = db.prepare(`
      SELECT name FROM students
      WHERE group_id = ? AND (phone_number = ? OR phone_number = ? OR phone_number = ?)
      LIMIT 1
    `).get(groupId, normalizedPhone, jid, localZero);
    if (student && student.name) return student.name;
  }

  const orgAny = db.prepare(`
    SELECT holder_name FROM organization_structures
    WHERE phone_number = ? OR phone_number = ? OR phone_number = ?
    LIMIT 1
  `).get(normalizedPhone, jid, localZero);
  if (orgAny && orgAny.holder_name) return orgAny.holder_name;

  const studentAny = db.prepare(`
    SELECT name FROM students
    WHERE phone_number = ? OR phone_number = ? OR phone_number = ?
    LIMIT 1
  `).get(normalizedPhone, jid, localZero);
  if (studentAny && studentAny.name) return studentAny.name;

  return null;
}

/**
 * Resolusi Role Otoritatif dari konfigurasi Developer, class_roles, atau organization_structures
 */
export function resolveAuthoritativeRole(rawOrNormalizedPhone) {
  const normalizedPhone = normalizePhone(rawOrNormalizedPhone);
  if (!normalizedPhone) return null;

  // 1. Cek apakah nomor adalah DEVELOPER_NUMBER
  const devEnv = process.env.DEVELOPER_NUMBER || '';
  const devNumbers = devEnv
    .split(',')
    .map(s => normalizePhone(s))
    .filter(Boolean);

  if (devNumbers.includes(normalizedPhone)) {
    const firstClass = db.prepare('SELECT group_id FROM classes ORDER BY created_at ASC LIMIT 1').get();
    const defaultGroupId = firstClass ? firstClass.group_id : null;
    const devName = lookupHolderName(normalizedPhone, defaultGroupId);
    return {
      role: 'DEVELOPER',
      group_id: null,
      default_group_id: defaultGroupId,
      name: (devName && devName !== 'Pengurus') ? devName : 'Developer'
    };
  }

  const jid = `${normalizedPhone}@s.whatsapp.net`;

  // 2. Cek di tabel class_roles
  const roleRows = db.prepare(`
    SELECT group_id, phone_number, role
    FROM class_roles
    WHERE phone_number = ? OR phone_number = ?
  `).all(normalizedPhone, jid);

  if (roleRows && roleRows.length > 0) {
    // Urutkan berdasarkan prioritas role: KETUA > SEKRETARIS > BENDAHARA
    roleRows.sort((a, b) => (ROLE_PRIORITY[b.role] || 0) - (ROLE_PRIORITY[a.role] || 0));
    const chosen = roleRows[0];
    const holderName = lookupHolderName(normalizedPhone, chosen.group_id) || `${chosen.role} Kelas`;
    return {
      role: chosen.role,
      group_id: chosen.group_id,
      default_group_id: chosen.group_id,
      name: holderName
    };
  }

  // 3. Cek di tabel organization_structures untuk WAKIL KETUA / WAKIL
  const wakilRow = db.prepare(`
    SELECT group_id, position_name, holder_name
    FROM organization_structures
    WHERE (phone_number = ? OR phone_number = ?)
      AND UPPER(position_name) LIKE '%WAKIL%'
    LIMIT 1
  `).get(normalizedPhone, jid);

  if (wakilRow) {
    return {
      role: 'WAKIL',
      group_id: wakilRow.group_id,
      default_group_id: wakilRow.group_id,
      name: wakilRow.holder_name || 'Wakil Ketua'
    };
  }

  // 4. Cek juga di organization_structures jika KETUA / SEKRETARIS / BENDAHARA terdaftar di sana namun belum sinkron ke class_roles
  const orgRoleRow = db.prepare(`
    SELECT group_id, position_name, holder_name
    FROM organization_structures
    WHERE (phone_number = ? OR phone_number = ?)
  `).all(normalizedPhone, jid);

  if (orgRoleRow && orgRoleRow.length > 0) {
    for (const row of orgRoleRow) {
      const pos = (row.position_name || '').toUpperCase();
      if (pos.includes('WAKIL')) {
        return {
          role: 'WAKIL',
          group_id: row.group_id,
          default_group_id: row.group_id,
          name: row.holder_name || 'Wakil Ketua'
        };
      }
      if (pos.includes('KETUA')) {
        return {
          role: 'KETUA',
          group_id: row.group_id,
          default_group_id: row.group_id,
          name: row.holder_name || 'Ketua Kelas'
        };
      }
      if (pos.includes('SEKRETARIS') || pos.includes('SEKERTARIS')) {
        return {
          role: 'SEKRETARIS',
          group_id: row.group_id,
          default_group_id: row.group_id,
          name: row.holder_name || 'Sekretaris'
        };
      }
      if (pos.includes('BENDAHARA')) {
        return {
          role: 'BENDAHARA',
          group_id: row.group_id,
          default_group_id: row.group_id,
          name: row.holder_name || 'Bendahara'
        };
      }
    }
  }

  return null;
}

/**
 * Hash password menggunakan node:crypto scryptSync
 * Format: scrypt$<saltHex>$<hashHex>
 */
export function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password wajib diisi');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verifikasi password dengan timingSafeEqual
 */
export function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, salt, hashHex] = parts;
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(hashHex, 'hex');
    if (derivedKey.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(derivedKey, storedBuf);
  } catch {
    return false;
  }
}

/**
 * Cek Rate Limiting Login / Register (Brute Force Protection)
 * Jika >= 5 gagal dalam 15 menit terakhir, kembalikan { blocked: true, retryAfterSec, failedCount }
 */
export function checkRateLimit(identifier) {
  if (!identifier) return { blocked: false, failedCount: 0, retryAfterSec: 0 };

  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
  const row = db.prepare(`
    SELECT COUNT(*) AS failed_count, MIN(attempt_at) AS oldest_attempt
    FROM web_login_attempts
    WHERE identifier = ? AND attempt_at >= ? AND is_success = 0
  `).get(identifier, windowStart);

  const failedCount = Number(row?.failed_count || 0);
  if (failedCount >= MAX_FAILED_ATTEMPTS) {
    const oldest = Number(row?.oldest_attempt || Date.now());
    const retryAfterSec = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000));
    return {
      blocked: true,
      failedCount,
      retryAfterSec
    };
  }

  return {
    blocked: false,
    failedCount,
    retryAfterSec: 0
  };
}

/**
 * Catat percobaan login ke tabel web_login_attempts
 */
export function recordLoginAttempt(identifier, isSuccess = false) {
  if (!identifier) return;
  const now = Date.now();
  db.prepare(`
    INSERT INTO web_login_attempts (identifier, attempt_at, is_success)
    VALUES (?, ?, ?)
  `).run(identifier, now, isSuccess ? 1 : 0);

  if (isSuccess) {
    clearRateLimit(identifier);
  }
}

/**
 * Bersihkan catatan gagal untuk identifier setelah login sukses
 */
export function clearRateLimit(identifier) {
  if (!identifier) return;
  db.prepare(`
    DELETE FROM web_login_attempts
    WHERE identifier = ? AND is_success = 0
  `).run(identifier);
}

/**
 * Parse header Cookie menjadi objek key-value
 */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

/**
 * Buat Set-Cookie string untuk sesi
 */
export function buildSessionCookie(sessionId, req = null, maxAgeSec = 86400) {
  const isHttps =
    req?.headers?.['x-forwarded-proto'] === 'https' ||
    req?.socket?.encrypted === true;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId || '')}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Buat Set-Cookie string untuk menghapus cookie sesi
 */
export function buildClearSessionCookie(req = null) {
  return buildSessionCookie('', req, 0);
}

/**
 * Buat sesi login baru di tabel web_sessions
 */
export function createSession(user) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;

  let activeGroupId = user.group_id || null;
  if (user.role === 'DEVELOPER') {
    if (!activeGroupId) {
      const firstClass = db.prepare('SELECT group_id FROM classes ORDER BY created_at ASC LIMIT 1').get();
      activeGroupId = firstClass ? firstClass.group_id : null;
    }
  }

  db.prepare(`
    INSERT INTO web_sessions (id, user_id, phone_number, role, active_group_id, csrf_token, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    user.id,
    user.phone_number,
    user.role,
    activeGroupId,
    csrfToken,
    expiresAt
  );

  return {
    id: sessionId,
    user_id: user.id,
    phone_number: user.phone_number,
    role: user.role,
    group_id: user.group_id || null,
    active_group_id: activeGroupId,
    name: user.name || user.role,
    csrf_token: csrfToken,
    expires_at: expiresAt
  };
}

/**
 * Hapus sesi dari database
 */
export function destroySession(sessionId) {
  if (!sessionId) return;
  db.prepare('DELETE FROM web_sessions WHERE id = ?').run(sessionId);
}

/**
 * Ambil dan validasi sesi dari HTTP request (termasuk validasi real-time jabatan di DB)
 */
export function getSessionFromRequest(req) {
  const cookieHeader = req?.headers?.cookie || '';
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) return null;

  const session = db.prepare(`
    SELECT s.*, u.name AS user_name, u.group_id AS user_group_id
    FROM web_sessions s
    JOIN web_users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(sessionId);

  if (!session) return null;

  // Cek kadaluarsa sesi
  if (Number(session.expires_at) <= Date.now()) {
    destroySession(sessionId);
    return null;
  }

  // Validasi real-time jabatan pengguna terhadap database utama
  const authInfo = resolveAuthoritativeRole(session.phone_number);
  if (!authInfo) {
    // Jabatan telah dicabut di database WhatsApp bot -> cabut sesi seketika!
    destroySession(sessionId);
    return null;
  }

  let effectiveRole = authInfo.role;
  let effectiveGroupId = authInfo.role === 'DEVELOPER' ? null : authInfo.group_id;
  let activeGroupId = session.active_group_id;

  if (effectiveRole !== 'DEVELOPER') {
    activeGroupId = effectiveGroupId;
  } else if (!activeGroupId) {
    activeGroupId = authInfo.default_group_id;
  }

  // Sinkronkan perubahan role/group_id jika terjadi perubahan jabatan di DB
  if (
    session.role !== effectiveRole ||
    session.user_group_id !== effectiveGroupId ||
    (effectiveRole !== 'DEVELOPER' && session.active_group_id !== activeGroupId)
  ) {
    db.prepare(`
      UPDATE web_users
      SET role = ?, group_id = ?, name = COALESCE(?, name), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(effectiveRole, effectiveGroupId, authInfo.name, session.user_id);

    db.prepare(`
      UPDATE web_sessions
      SET role = ?, active_group_id = ?
      WHERE id = ?
    `).run(effectiveRole, activeGroupId, session.id);
  }

  // Sinkronkan nama pengguna asli jika tersedia
  const realName = (session.user_name && session.user_name !== session.phone_number && session.user_name !== 'Developer')
    ? session.user_name
    : ((authInfo.name && authInfo.name !== 'Developer' && authInfo.name !== session.phone_number)
      ? authInfo.name
      : (session.user_name || authInfo.name || effectiveRole));

  if ((!session.user_name || session.user_name === session.phone_number || session.user_name === 'Developer') && authInfo.name && authInfo.name !== 'Developer') {
    db.prepare('UPDATE web_users SET name = ? WHERE id = ?').run(authInfo.name, session.user_id);
  }

  return {
    id: session.id,
    user_id: session.user_id,
    phone_number: session.phone_number,
    role: effectiveRole,
    group_id: effectiveGroupId,
    active_group_id: activeGroupId,
    name: realName,
    csrf_token: session.csrf_token,
    expires_at: session.expires_at
  };
}

/**
 * Catat aktivitas ke tabel web_audit_logs
 */
export function writeAuditLog({ user_id = null, phone_number = null, role = null, group_id = null, action, details = null }) {
  try {
    const detailsStr = typeof details === 'object' && details !== null ? JSON.stringify(details) : (details ? String(details) : null);
    db.prepare(`
      INSERT INTO web_audit_logs (user_id, phone_number, role, group_id, action, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user_id, phone_number, role, group_id, action, detailsStr);
  } catch {
    // ignore logging error
  }
}
