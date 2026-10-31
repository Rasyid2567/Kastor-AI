import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { db } from '../../database/schema.js';
import { calculateWeekNumber } from '../../bot/modules/schedule.js';
import { parseChecklistText, getCashRecap } from '../../bot/modules/cash.js';
import {
  getFinancialSummary,
  addFinancialTransaction,
  updateFinancialTransaction,
  deleteFinancialTransaction
} from '../../bot/modules/finance.js';
import {
  calculateMath,
  evaluateMathRaw,
  getStickerLimitConfig,
  updateStickerLimitConfig,
  resetStickerRateLimit,
  getStickerUsageSummary
} from '../../bot/modules/media.js';
import { askAiAssistant } from '../../bot/modules/ai.js';
import { getSystemStatusInfo } from '../../bot/modules/system.js';
import {
  normalizePhone,
  resolveAuthoritativeRole,
  hashPassword,
  verifyPassword,
  checkRateLimit,
  recordLoginAttempt,
  clearRateLimit,
  createSession,
  destroySession,
  getSessionFromRequest,
  buildSessionCookie,
  buildClearSessionCookie,
  writeAuditLog
} from './auth.js';
import {
  getEffectiveRole,
  getRolePermissions,
  enforceClassIsolation,
  checkEndpointPermission
} from './rbac.js';

const MAX_BODY_SIZE = 8 * 1024 * 1024; // 8 MB (mendukung lampiran foto nota)

/**
 * Helper kirim JSON response
 */
export function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

/**
 * Helper baca body JSON dari IncomingMessage
 */
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_SIZE) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        req.body = parsed;
        resolve(parsed);
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

/**
 * Ambil IP klien dari request
 */
function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Sanitasi string input dasar
 */
function cleanStr(val, maxLen = 500) {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

/**
 * Simpan foto nota/struk belanja dari payload base64
 */
function saveReceiptImage(base64Data) {
  if (!base64Data || typeof base64Data !== 'string') return null;
  const match = base64Data.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
  if (!match) return null;
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Ukuran foto bukti tidak boleh melebihi 5MB');
  }
  const filename = `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const targetDir = path.resolve(process.cwd(), 'uploads/receipts');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, filename), buffer);
  return `/uploads/receipts/${filename}`;
}

/**
 * Bobot urutan jabatan struktur organisasi
 */
function getPositionWeight(positionName) {
  const norm = (positionName || '').toUpperCase().trim();
  if (norm === 'KETUA' || norm === 'KETUA KELAS') return 10;
  if (norm.includes('WAKIL')) return 20;
  if (norm.includes('SEKRETARIS') || norm.includes('SEKERTARIS')) {
    const m = norm.match(/\d+/);
    return 30 + (m ? parseInt(m[0], 10) : 1);
  }
  if (norm.includes('BENDAHARA')) {
    const m = norm.match(/\d+/);
    return 50 + (m ? parseInt(m[0], 10) : 1);
  }
  return 100;
}

/**
 * Router utama untuk semua endpoint `/api/*`
 */
export async function handleApiRequest(req, res, reqUrl) {
  const pathname = reqUrl.pathname.replace(/\/+$/, '') || '/';
  const method = (req.method || 'GET').toUpperCase();

  let body = {};
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    try {
      body = await readJsonBody(req);
    } catch (err) {
      if (err.message === 'PAYLOAD_TOO_LARGE') {
        return sendJson(res, 413, { ok: false, error: 'Ukuran data terlalu besar (maksimal 2MB).' });
      }
      return sendJson(res, 400, { ok: false, error: 'Format JSON tidak valid.' });
    }
  }

  // =========================================================================
  // 1. AUTHENTICATION ENDPOINTS (Public / Semi-Public)
  // =========================================================================

  if (pathname === '/api/auth/register' && method === 'POST') {
    const rawPhone = body.phone_number || body.phone || '';
    const password = body.password || '';
    const customName = cleanStr(body.name, 100);
    const clientIp = getClientIp(req);

    const normalizedPhone = normalizePhone(rawPhone);
    const rateId = normalizedPhone ? `reg:${normalizedPhone}` : `reg_ip:${clientIp}`;
    const rl = checkRateLimit(rateId);
    if (rl.blocked) {
      return sendJson(res, 429, {
        ok: false,
        error: `Terlalu banyak percobaan. Silakan coba lagi dalam ${Math.ceil(rl.retryAfterSec / 60)} menit.`
      });
    }

    if (!normalizedPhone) {
      recordLoginAttempt(rateId, false);
      return sendJson(res, 400, {
        ok: false,
        error: 'Format nomor HP tidak valid. Gunakan nomor WhatsApp Indonesia (contoh: 081234567890).'
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Kata sandi minimal harus terdiri dari 8 karakter.'
      });
    }

    // Verifikasi apakah nomor terdaftar sebagai pengurus sah di database
    const authRole = resolveAuthoritativeRole(normalizedPhone);
    if (!authRole) {
      recordLoginAttempt(rateId, false);
      writeAuditLog({
        phone_number: normalizedPhone,
        action: 'REGISTER_REJECTED_UNAUTHORIZED',
        details: { ip: clientIp }
      });
      return sendJson(res, 403, {
        ok: false,
        error: 'Nomor HP tidak terdaftar sebagai pengurus kelas yang berwenang.'
      });
    }

    // Cek apakah akun sudah pernah diregistrasi di web_users
    const existingUser = db.prepare('SELECT id FROM web_users WHERE phone_number = ?').get(normalizedPhone);
    if (existingUser) {
      return sendJson(res, 409, {
        ok: false,
        error: 'Nomor HP ini sudah terdaftar. Silakan langsung masuk (Login).'
      });
    }

    const passwordHash = hashPassword(password);
    const finalName = customName || authRole.name || authRole.role;

    const insertRes = db.prepare(`
      INSERT INTO web_users (phone_number, password_hash, role, group_id, name)
      VALUES (?, ?, ?, ?, ?)
    `).run(normalizedPhone, passwordHash, authRole.role, authRole.group_id, finalName);

    const newUser = {
      id: Number(insertRes.lastInsertRowid),
      phone_number: normalizedPhone,
      role: authRole.role,
      group_id: authRole.group_id,
      name: finalName
    };

    clearRateLimit(rateId);
    const session = createSession(newUser);
    const cookieHeader = buildSessionCookie(session.id, req);

    writeAuditLog({
      user_id: newUser.id,
      phone_number: newUser.phone_number,
      role: newUser.role,
      group_id: session.active_group_id,
      action: 'AUTH_REGISTER_SUCCESS',
      details: { ip: clientIp }
    });

    const activeClass = session.active_group_id
      ? db.prepare('SELECT group_id, class_name, academic_year FROM classes WHERE group_id = ?').get(session.active_group_id)
      : null;

    return sendJson(
      res,
      201,
      {
        ok: true,
        message: 'Registrasi berhasil.',
        user: {
          id: newUser.id,
          phone_number: newUser.phone_number,
          name: newUser.name,
          role: newUser.role,
          group_id: newUser.group_id,
          active_group_id: session.active_group_id,
          class_name: activeClass?.class_name || null
        },
        csrf_token: session.csrf_token,
        permissions: getRolePermissions(newUser.role)
      },
      { 'Set-Cookie': cookieHeader }
    );
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const rawPhone = body.phone_number || body.phone || '';
    const password = body.password || '';
    const clientIp = getClientIp(req);
    const normalizedPhone = normalizePhone(rawPhone);

    const ipRateKey = `ip:${clientIp}`;
    const phoneRateKey = normalizedPhone ? `phone:${normalizedPhone}` : `raw:${cleanStr(rawPhone, 30)}`;

    const ipLimit = checkRateLimit(ipRateKey);
    const phoneLimit = checkRateLimit(phoneRateKey);

    if (ipLimit.blocked || phoneLimit.blocked) {
      const retrySec = Math.max(ipLimit.retryAfterSec, phoneLimit.retryAfterSec);
      return sendJson(res, 429, {
        ok: false,
        error: `Terlalu banyak percobaan login gagal. Silakan tunggu ${Math.ceil(retrySec / 60)} menit lagi.`,
        retry_after_seconds: retrySec
      });
    }

    if (!normalizedPhone || !password) {
      recordLoginAttempt(ipRateKey, false);
      recordLoginAttempt(phoneRateKey, false);
      return sendJson(res, 401, {
        ok: false,
        error: 'Nomor HP atau kata sandi tidak valid.'
      });
    }

    const user = db.prepare('SELECT * FROM web_users WHERE phone_number = ?').get(normalizedPhone);
    if (!user || !verifyPassword(password, user.password_hash)) {
      recordLoginAttempt(ipRateKey, false);
      recordLoginAttempt(phoneRateKey, false);
      writeAuditLog({
        phone_number: normalizedPhone,
        action: 'AUTH_LOGIN_FAILED',
        details: { ip: clientIp }
      });
      return sendJson(res, 401, {
        ok: false,
        error: 'Nomor HP atau kata sandi tidak valid.'
      });
    }

    // Verifikasi real-time bahwa nomor masih menjabat sebagai pengurus atau developer
    const authRole = resolveAuthoritativeRole(normalizedPhone);
    if (!authRole) {
      recordLoginAttempt(ipRateKey, false);
      recordLoginAttempt(phoneRateKey, false);
      return sendJson(res, 403, {
        ok: false,
        error: 'Hak akses kepengurusan Anda telah berakhir atau dicabut.'
      });
    }

    // Sinkronkan role & group_id terbaru di tabel web_users
    if (user.role !== authRole.role || user.group_id !== authRole.group_id) {
      db.prepare(`
        UPDATE web_users
        SET role = ?, group_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(authRole.role, authRole.group_id, user.id);
      user.role = authRole.role;
      user.group_id = authRole.group_id;
    }

    recordLoginAttempt(ipRateKey, true);
    recordLoginAttempt(phoneRateKey, true);

    const session = createSession(user);
    const cookieHeader = buildSessionCookie(session.id, req);

    writeAuditLog({
      user_id: user.id,
      phone_number: user.phone_number,
      role: user.role,
      group_id: session.active_group_id,
      action: 'AUTH_LOGIN_SUCCESS',
      details: { ip: clientIp }
    });

    const activeClass = session.active_group_id
      ? db.prepare('SELECT group_id, class_name, academic_year FROM classes WHERE group_id = ?').get(session.active_group_id)
      : null;

    return sendJson(
      res,
      200,
      {
        ok: true,
        message: 'Login berhasil.',
        user: {
          id: user.id,
          phone_number: user.phone_number,
          name: user.name || authRole.name || user.role,
          role: user.role,
          group_id: user.group_id,
          active_group_id: session.active_group_id,
          class_name: activeClass?.class_name || null
        },
        csrf_token: session.csrf_token,
        permissions: getRolePermissions(user.role)
      },
      { 'Set-Cookie': cookieHeader }
    );
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const session = getSessionFromRequest(req);
    if (session) {
      destroySession(session.id);
      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: session.active_group_id,
        action: 'AUTH_LOGOUT'
      });
    }
    return sendJson(
      res,
      200,
      { ok: true, message: 'Berhasil keluar.' },
      { 'Set-Cookie': buildClearSessionCookie(req) }
    );
  }

  // =========================================================================
  // 2. PROTECTED ENDPOINTS — CEK SESI & RBAC
  // =========================================================================
  const session = getSessionFromRequest(req);
  if (!session) {
    return sendJson(res, 401, {
      ok: false,
      error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.'
    });
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const activeClass = session.active_group_id
      ? db.prepare('SELECT group_id, class_name, academic_year, semester_start_date FROM classes WHERE group_id = ?').get(session.active_group_id)
      : null;

    return sendJson(res, 200, {
      ok: true,
      user: {
        id: session.user_id,
        phone_number: session.phone_number,
        name: session.name,
        role: session.role,
        effective_role: getEffectiveRole(session.role),
        group_id: session.group_id,
        active_group_id: session.active_group_id,
        class_name: activeClass?.class_name || null,
        academic_year: activeClass?.academic_year || null
      },
      csrf_token: session.csrf_token,
      permissions: getRolePermissions(session.role)
    });
  }

  // Cek izin endpoint RBAC berdasarkan role dan method
  const permCheck = checkEndpointPermission(session, pathname, method);
  if (!permCheck.allowed) {
    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: session.active_group_id,
      action: 'RBAC_ACCESS_DENIED',
      details: { method, pathname }
    });
    return sendJson(res, permCheck.status || 403, {
      ok: false,
      error: permCheck.message
    });
  }

  // Cek isolasi kelas (Anti-IDOR) untuk semua endpoint selain switch class dan system console
  let targetGroupId = session.active_group_id;
  if (pathname !== '/api/classes/switch' && !pathname.startsWith('/api/system')) {
    const isolation = enforceClassIsolation(session, reqUrl, body);
    if (!isolation.allowed) {
      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: session.active_group_id,
        action: 'CLASS_ISOLATION_VIOLATION',
        details: { method, pathname, query: Object.fromEntries(reqUrl.searchParams), body_group: body?.group_id || body?.class_id }
      });
      return sendJson(res, isolation.status || 403, {
        ok: false,
        error: isolation.message
      });
    }
    targetGroupId = isolation.targetGroupId;
  }

  // =========================================================================
  // 3. CLASSES ENDPOINTS
  // =========================================================================
  if (pathname === '/api/classes' && method === 'GET') {
    if (session.role === 'DEVELOPER') {
      const classes = db.prepare(`
        SELECT c.*,
               (SELECT COUNT(*) FROM students s WHERE s.group_id = c.group_id) AS student_count,
               (SELECT COUNT(*) FROM class_groups cg WHERE cg.target_group_id = c.group_id) AS linked_count
        FROM classes c
        ORDER BY c.created_at ASC
      `).all();

      return sendJson(res, 200, {
        ok: true,
        active_group_id: session.active_group_id,
        classes
      });
    } else {
      const classes = db.prepare(`
        SELECT c.*,
               (SELECT COUNT(*) FROM students s WHERE s.group_id = c.group_id) AS student_count,
               (SELECT COUNT(*) FROM class_groups cg WHERE cg.target_group_id = c.group_id) AS linked_count
        FROM classes c
        WHERE c.group_id = ?
      `).all(session.group_id);

      return sendJson(res, 200, {
        ok: true,
        active_group_id: session.group_id,
        classes
      });
    }
  }

  // =========================================================================
  // 3.1 LINKED GROUPS ENDPOINTS (/api/classes/linked-groups)
  // =========================================================================
  if (pathname === '/api/classes/linked-groups' && method === 'GET') {
    const linkedGroups = db.prepare(`
      SELECT cg.*, c.class_name as target_class_name
      FROM class_groups cg
      JOIN classes c ON cg.target_group_id = c.group_id
      WHERE cg.target_group_id = ?
      ORDER BY cg.created_at ASC
    `).all(targetGroupId);

    const classInfo = db.prepare('SELECT group_id, class_name FROM classes WHERE group_id = ?').get(targetGroupId);

    return sendJson(res, 200, {
      ok: true,
      target_group_id: targetGroupId,
      class_name: classInfo?.class_name || 'Kelas',
      linked_groups: linkedGroups
    });
  }

  if (pathname === '/api/classes/linked-groups' && method === 'POST') {
    const rawBranchJid = cleanStr(body.linked_group_id || body.branch_group_id || body.group_id, 120);
    const label = cleanStr(body.group_label || body.label, 80) || 'Cabang';

    if (!rawBranchJid) {
      return sendJson(res, 400, {
        ok: false,
        error: 'ID Grup WhatsApp cabang (JID) wajib diisi.'
      });
    }

    let branchJid = rawBranchJid;
    if (!branchJid.endsWith('@g.us')) {
      if (/^[0-9]{10,25}$/.test(branchJid)) {
        branchJid = `${branchJid}@g.us`;
      } else {
        return sendJson(res, 400, {
          ok: false,
          error: 'Format ID Grup WhatsApp tidak valid. Masukkan ID seperti 120363xxxxxxxxxx@g.us atau digit angka saja.'
        });
      }
    }

    if (!/^[0-9\-]{10,35}@g\.us$/.test(branchJid)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Format ID Grup WhatsApp tidak valid. Harus berakhiran @g.us (contoh: 120363xxxxxxxxxx@g.us)'
      });
    }

    // Cek apakah grup ini sudah merupakan kelas induk di classes
    const isPrimary = db.prepare('SELECT class_name FROM classes WHERE group_id = ?').get(branchJid);
    if (isPrimary) {
      return sendJson(res, 400, {
        ok: false,
        error: `Grup ini sudah terdaftar sebagai Kelas Utama (${isPrimary.class_name}). Kelas utama tidak dapat dihubungkan sebagai cabang.`
      });
    }

    // Cek apakah sudah terhubung ke kelas lain
    const existing = db.prepare(`
      SELECT cg.*, c.class_name 
      FROM class_groups cg 
      JOIN classes c ON cg.target_group_id = c.group_id 
      WHERE cg.group_id = ?
    `).get(branchJid);

    if (existing) {
      return sendJson(res, 409, {
        ok: false,
        error: `Grup ini sudah terhubung ke kelas ${existing.class_name}. Putuskan tautan terlebih dahulu jika ingin memindahkannya.`
      });
    }

    const insertRes = db.prepare(`
      INSERT INTO class_groups (group_id, target_group_id, group_label)
      VALUES (?, ?, ?)
    `).run(branchJid, targetGroupId, label);

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'CLASS_GROUP_LINK',
      details: { id: Number(insertRes.lastInsertRowid), group_id: branchJid, label }
    });

    return sendJson(res, 201, {
      ok: true,
      message: `Grup cabang "${label}" berhasil dihubungkan ke kelas.`,
      id: Number(insertRes.lastInsertRowid),
      linked_group: {
        id: Number(insertRes.lastInsertRowid),
        group_id: branchJid,
        target_group_id: targetGroupId,
        group_label: label,
        created_at: new Date().toISOString()
      }
    });
  }

  // DELETE: baik via /api/classes/linked-groups/:id maupun /api/classes/linked-groups?id=...
  if (
    (pathname === '/api/classes/linked-groups' && method === 'DELETE') ||
    (pathname.startsWith('/api/classes/linked-groups/') && method === 'DELETE')
  ) {
    let linkId = null;
    if (pathname.startsWith('/api/classes/linked-groups/')) {
      linkId = parseInt(pathname.replace('/api/classes/linked-groups/', ''), 10);
    } else {
      linkId = parseInt(reqUrl.searchParams.get('id') || body?.id, 10);
    }

    if (isNaN(linkId)) {
      return sendJson(res, 400, { ok: false, error: 'ID tautan grup cabang tidak valid.' });
    }

    const existing = db.prepare('SELECT * FROM class_groups WHERE id = ?').get(linkId);
    if (!existing) {
      return sendJson(res, 404, { ok: false, error: 'Tautan grup cabang tidak ditemukan.' });
    }

    if (session.role !== 'DEVELOPER' && existing.target_group_id !== targetGroupId) {
      return sendJson(res, 403, { ok: false, error: 'Akses ditolak: Anda tidak memiliki izin untuk mengelola grup kelas lain.' });
    }

    db.prepare('DELETE FROM class_groups WHERE id = ?').run(linkId);

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: existing.target_group_id,
      action: 'CLASS_GROUP_UNLINK',
      details: { id: linkId, group_id: existing.group_id, label: existing.group_label }
    });

    return sendJson(res, 200, {
      ok: true,
      message: 'Tautan grup cabang berhasil diputuskan.'
    });
  }

  // PUT / PATCH: Memperbarui label penanda grup cabang
  if (
    ((pathname === '/api/classes/linked-groups' && (method === 'PUT' || method === 'PATCH')) ||
     (pathname.startsWith('/api/classes/linked-groups/') && (method === 'PUT' || method === 'PATCH')))
  ) {
    let linkId = null;
    if (pathname.startsWith('/api/classes/linked-groups/')) {
      linkId = parseInt(pathname.replace('/api/classes/linked-groups/', ''), 10);
    } else {
      linkId = parseInt(reqUrl.searchParams.get('id') || body?.id, 10);
    }

    if (isNaN(linkId)) {
      return sendJson(res, 400, { ok: false, error: 'ID tautan grup cabang tidak valid.' });
    }

    const newLabel = cleanStr(body.group_label || body.label || body.name, 80);
    if (!newLabel) {
      return sendJson(res, 400, { ok: false, error: 'Nama penanda/label grup wajib diisi.' });
    }

    const existing = db.prepare('SELECT * FROM class_groups WHERE id = ?').get(linkId);
    if (!existing) {
      return sendJson(res, 404, { ok: false, error: 'Tautan grup cabang tidak ditemukan.' });
    }

    if (session.role !== 'DEVELOPER' && existing.target_group_id !== targetGroupId) {
      return sendJson(res, 403, { ok: false, error: 'Akses ditolak: Anda tidak memiliki izin untuk mengelola grup kelas lain.' });
    }

    db.prepare('UPDATE class_groups SET group_label = ? WHERE id = ?').run(newLabel, linkId);

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: existing.target_group_id,
      action: 'CLASS_GROUP_UPDATE_LABEL',
      details: { id: linkId, group_id: existing.group_id, old_label: existing.group_label, new_label: newLabel }
    });

    return sendJson(res, 200, {
      ok: true,
      message: `Nama penanda grup berhasil diperbarui menjadi "${newLabel}".`,
      linked_group: {
        ...existing,
        group_label: newLabel
      }
    });
  }

  if (pathname === '/api/classes/switch' && method === 'POST') {
    const nextGroupId = cleanStr(body.group_id || body.class_id, 120);
    if (!nextGroupId) {
      return sendJson(res, 400, { ok: false, error: 'Parameter group_id wajib diisi.' });
    }

    const cls = db.prepare('SELECT * FROM classes WHERE group_id = ?').get(nextGroupId);
    if (!cls) {
      return sendJson(res, 404, { ok: false, error: 'Kelas tidak ditemukan.' });
    }

    db.prepare('UPDATE web_sessions SET active_group_id = ? WHERE id = ?').run(cls.group_id, session.id);

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: cls.group_id,
      action: 'DEVELOPER_SWITCH_CLASS',
      details: { class_name: cls.class_name }
    });

    return sendJson(res, 200, {
      ok: true,
      message: `Berhasil beralih ke kelas ${cls.class_name}.`,
      active_group_id: cls.group_id,
      class_info: cls
    });
  }

  // =========================================================================
  // 4. DASHBOARD OVERVIEW STATS
  // =========================================================================
  if (pathname === '/api/dashboard/stats' && method === 'GET') {
    const classInfo = targetGroupId
      ? db.prepare('SELECT * FROM classes WHERE group_id = ?').get(targetGroupId)
      : null;

    if (!classInfo) {
      return sendJson(res, 200, {
        ok: true,
        class_info: null,
        student_count: 0,
        active_assignments: [],
        today_schedules: [],
        structure_count: 0,
        cash_summary: null
      });
    }

    const currentWeek = calculateWeekNumber(classInfo.semester_start_date);
    const now = new Date();
    const dayIndex = now.getDay(); // 0: Minggu, 1..5: Senin..Jumat

    const studentCountRow = db.prepare('SELECT COUNT(*) AS count FROM students WHERE group_id = ?').get(targetGroupId);
    const studentCount = Number(studentCountRow?.count || 0);

    const activeAssignments = db.prepare(`
      SELECT * FROM assignments
      WHERE group_id = ? AND is_completed = 0
      ORDER BY deadline ASC
    `).all(targetGroupId);

    const completedAssignmentsRow = db.prepare(`
      SELECT COUNT(*) AS count FROM assignments
      WHERE group_id = ? AND is_completed = 1
    `).get(targetGroupId);

    const todaySchedules = (dayIndex >= 1 && dayIndex <= 5)
      ? db.prepare(`
          SELECT * FROM schedules
          WHERE group_id = ? AND week_number = ? AND day_index = ?
          ORDER BY time_start ASC
        `).all(targetGroupId, currentWeek, dayIndex)
      : [];

    const weekSchedules = db.prepare(`
      SELECT * FROM schedules
      WHERE group_id = ? AND week_number = ?
      ORDER BY day_index ASC, time_start ASC
    `).all(targetGroupId, currentWeek);

    const structureCountRow = db.prepare('SELECT COUNT(*) AS count FROM organization_structures WHERE group_id = ?').get(targetGroupId);
    const structureCount = Number(structureCountRow?.count || 0);

    // Cash summary HANYA jika role bukan SEKRETARIS
    let cashSummary = null;
    const effRole = getEffectiveRole(session.role);
    if (effRole !== 'SEKRETARIS') {
      const cashSettings = db.prepare('SELECT weekly_fee, active_weeks_count FROM cash_settings WHERE group_id = ?').get(targetGroupId);
      const weeklyFee = Number(cashSettings?.weekly_fee || 0);
      const activeWeeks = Number(cashSettings?.active_weeks_count || 0);
      const hasWeek1 = db.prepare('SELECT 1 FROM cash_payments WHERE group_id = ? AND week_number = 1 AND is_paid = 1 LIMIT 1').get(targetGroupId);
      const startWeek = hasWeek1 ? 1 : 2;
      const totalWeeks = Math.max(0, activeWeeks - startWeek + 1);

      const studentsPayment = db.prepare(`
        SELECT s.id,
               COALESCE(SUM(CASE WHEN cp.is_paid = 1 AND cp.week_number >= ? AND cp.week_number <= ? THEN 1 ELSE 0 END), 0) AS paid_weeks
        FROM students s
        LEFT JOIN cash_payments cp ON s.id = cp.student_id AND cp.group_id = s.group_id
        WHERE s.group_id = ?
        GROUP BY s.id
      `).all(startWeek, activeWeeks, targetGroupId);

      let lunasCount = 0;
      let menunggakCount = 0;
      let totalPaidWeeks = 0;

      for (const sp of studentsPayment) {
        const pw = Number(sp.paid_weeks || 0);
        totalPaidWeeks += pw;
        if (totalWeeks > 0 && pw >= totalWeeks) {
          lunasCount++;
        } else if (totalWeeks > 0) {
          menunggakCount++;
        }
      }

      cashSummary = {
        weekly_fee: weeklyFee,
        active_weeks_count: totalWeeks,
        lunas_count: lunasCount,
        menunggak_count: menunggakCount,
        total_collected: totalPaidWeeks * weeklyFee
      };
    }

    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRamPct = (((totalRam - freeRam) / totalRam) * 100).toFixed(1);

    return sendJson(res, 200, {
      ok: true,
      class_info: {
        ...classInfo,
        current_week: currentWeek,
        day_index: dayIndex
      },
      student_count: studentCount,
      active_assignments: activeAssignments,
      active_assignments_count: activeAssignments.length,
      completed_assignments_count: Number(completedAssignmentsRow?.count || 0),
      today_schedules: todaySchedules,
      week_schedules: weekSchedules,
      structure_count: structureCount,
      cash_summary: cashSummary,
      bot_status: {
        online: true,
        uptime_seconds: Math.floor(process.uptime()),
        vps_uptime_seconds: Math.floor(os.uptime()),
        ram_used_percent: Number(usedRamPct),
        rss_mb: Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1))
      }
    });
  }

  // =========================================================================
  // 5. STUDENTS ENDPOINTS (/api/students)
  // =========================================================================
  if (pathname === '/api/students' && method === 'GET') {
    const search = cleanStr(reqUrl.searchParams.get('search'), 100);
    const page = parseInt(reqUrl.searchParams.get('page') || '0', 10);
    const limit = parseInt(reqUrl.searchParams.get('limit') || '0', 10);

    let rows;
    if (search) {
      const likeParam = `%${search}%`;
      rows = db.prepare(`
        SELECT * FROM students
        WHERE group_id = ?
          AND (
            name LIKE ? OR
            COALESCE(parent_name, '') LIKE ? OR
            COALESCE(nis, '') LIKE ? OR
            COALESCE(phone_number, '') LIKE ? OR
            COALESCE(address, '') LIKE ? OR
            CAST(student_number AS TEXT) = ?
          )
        ORDER BY student_number ASC
      `).all(targetGroupId, likeParam, likeParam, likeParam, likeParam, likeParam, search);
    } else {
      rows = db.prepare(`
        SELECT * FROM students
        WHERE group_id = ?
        ORDER BY student_number ASC
      `).all(targetGroupId);
    }

    const total = rows.length;
    if (page > 0 && limit > 0) {
      const start = (page - 1) * limit;
      rows = rows.slice(start, start + limit);
    }

    return sendJson(res, 200, {
      ok: true,
      total,
      students: rows
    });
  }

  if (pathname === '/api/students/import' && method === 'POST') {
    const itemsToImport = [];

    if (Array.isArray(body.students)) {
      for (const item of body.students) {
        const num = parseInt(item.student_number, 10);
        const name = cleanStr(item.name, 120);
        if (!isNaN(num) && num >= 1 && num <= 50 && name) {
          itemsToImport.push({
            student_number: num,
            name,
            phone_number: cleanStr(item.phone_number, 50) || null,
            nis: cleanStr(item.nis, 50) || null,
            birth_info: cleanStr(item.birth_info, 150) || null,
            address: cleanStr(item.address, 250) || null,
            parent_name: cleanStr(item.parent_name, 120) || null
          });
        }
      }
    } else if (typeof body.text === 'string' && body.text.trim()) {
      const lines = body.text.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*(\d+)[\.\)\-\s]+(.+?)\s*$/);
        if (match) {
          const num = parseInt(match[1], 10);
          const rawRest = match[2].trim();
          const parts = rawRest.split('|').map(s => s.trim());
          const name = cleanStr(parts[0], 120);
          if (!isNaN(num) && num >= 1 && num <= 50 && name) {
            itemsToImport.push({
              student_number: num,
              name,
              nis: cleanStr(parts[1], 50) || null,
              birth_info: cleanStr(parts[2], 150) || null,
              address: cleanStr(parts[3], 250) || null,
              phone_number: cleanStr(parts[4], 50) || null,
              parent_name: cleanStr(parts[5], 120) || null
            });
          }
        }
      }
    }

    if (itemsToImport.length === 0) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Tidak ada data siswa valid untuk diimpor. Gunakan format "1. Nama Siswa" per baris.'
      });
    }

    const upsertStmt = db.prepare(`
      INSERT INTO students (group_id, student_number, name, phone_number, nis, birth_info, address, parent_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(group_id, student_number) DO UPDATE SET
        name = excluded.name,
        phone_number = COALESCE(excluded.phone_number, students.phone_number),
        nis = COALESCE(excluded.nis, students.nis),
        birth_info = COALESCE(excluded.birth_info, students.birth_info),
        address = COALESCE(excluded.address, students.address),
        parent_name = COALESCE(excluded.parent_name, students.parent_name)
    `);

    db.exec('BEGIN');
    try {
      for (const st of itemsToImport) {
        upsertStmt.run(
          targetGroupId,
          st.student_number,
          st.name,
          st.phone_number,
          st.nis,
          st.birth_info,
          st.address,
          st.parent_name
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      return sendJson(res, 500, { ok: false, error: `Gagal mengimpor siswa: ${err.message}` });
    }

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'STUDENTS_BULK_IMPORT',
      details: { count: itemsToImport.length }
    });

    return sendJson(res, 200, {
      ok: true,
      message: `Berhasil mengimpor ${itemsToImport.length} data siswa.`,
      imported_count: itemsToImport.length
    });
  }

  if (pathname === '/api/students' && method === 'POST') {
    const studentNumber = parseInt(body.student_number, 10);
    const name = cleanStr(body.name, 120);
    const rawPhone = cleanStr(body.phone_number, 50);
    const normalizedStudentPhone = rawPhone ? (normalizePhone(rawPhone) || rawPhone) : null;
    const nis = cleanStr(body.nis, 50) || null;
    const birthInfo = cleanStr(body.birth_info, 150) || null;
    const address = cleanStr(body.address, 250) || null;
    const parentName = cleanStr(body.parent_name, 120) || null;

    if (isNaN(studentNumber) || studentNumber < 1 || studentNumber > 50) {
      return sendJson(res, 400, { ok: false, error: 'Nomor absen harus berupa angka antara 1 sampai 50.' });
    }
    if (!name) {
      return sendJson(res, 400, { ok: false, error: 'Nama siswa wajib diisi.' });
    }

    const dup = db.prepare('SELECT id FROM students WHERE group_id = ? AND student_number = ?').get(targetGroupId, studentNumber);
    if (dup) {
      return sendJson(res, 409, {
        ok: false,
        error: `Nomor absen ${studentNumber} sudah terdaftar di kelas ini.`
      });
    }

    const result = db.prepare(`
      INSERT INTO students (group_id, student_number, name, phone_number, nis, birth_info, address, parent_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(targetGroupId, studentNumber, name, normalizedStudentPhone, nis, birthInfo, address, parentName);

    const created = db.prepare('SELECT * FROM students WHERE id = ?').get(Number(result.lastInsertRowid));

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'STUDENT_CREATE',
      details: { id: created.id, student_number: studentNumber, name }
    });

    return sendJson(res, 201, {
      ok: true,
      message: 'Data siswa berhasil ditambahkan.',
      student: created
    });
  }

  const studentIdMatch = pathname.match(/^\/api\/students\/(\d+)$/);
  if (studentIdMatch) {
    const studentId = parseInt(studentIdMatch[1], 10);
    const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);

    if (!existing) {
      return sendJson(res, 404, { ok: false, error: 'Data siswa tidak ditemukan.' });
    }
    if (existing.group_id !== targetGroupId) {
      return sendJson(res, 403, { ok: false, error: 'Akses ditolak: Siswa berasal dari kelas lain.' });
    }

    if (method === 'GET') {
      return sendJson(res, 200, { ok: true, student: existing });
    }

    if (method === 'PUT' || method === 'PATCH') {
      const nextNum = body.student_number !== undefined ? parseInt(body.student_number, 10) : existing.student_number;
      const nextName = body.name !== undefined ? cleanStr(body.name, 120) : existing.name;
      const rawPhone = body.phone_number !== undefined ? cleanStr(body.phone_number, 50) : existing.phone_number;
      const nextPhone = rawPhone ? (normalizePhone(rawPhone) || rawPhone) : null;
      const nextNis = body.nis !== undefined ? (cleanStr(body.nis, 50) || null) : existing.nis;
      const nextBirth = body.birth_info !== undefined ? (cleanStr(body.birth_info, 150) || null) : existing.birth_info;
      const nextAddr = body.address !== undefined ? (cleanStr(body.address, 250) || null) : existing.address;
      const nextParent = body.parent_name !== undefined ? (cleanStr(body.parent_name, 120) || null) : existing.parent_name;

      if (isNaN(nextNum) || nextNum < 1 || nextNum > 50) {
        return sendJson(res, 400, { ok: false, error: 'Nomor absen harus antara 1 sampai 50.' });
      }
      if (!nextName) {
        return sendJson(res, 400, { ok: false, error: 'Nama siswa tidak boleh kosong.' });
      }

      if (nextNum !== existing.student_number) {
        const dup = db.prepare('SELECT id FROM students WHERE group_id = ? AND student_number = ? AND id != ?')
          .get(targetGroupId, nextNum, studentId);
        if (dup) {
          return sendJson(res, 409, { ok: false, error: `Nomor absen ${nextNum} sudah digunakan siswa lain.` });
        }
      }

      db.prepare(`
        UPDATE students
        SET student_number = ?, name = ?, phone_number = ?, nis = ?, birth_info = ?, address = ?, parent_name = ?
        WHERE id = ? AND group_id = ?
      `).run(nextNum, nextName, nextPhone, nextNis, nextBirth, nextAddr, nextParent, studentId, targetGroupId);

      const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);

      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: targetGroupId,
        action: 'STUDENT_UPDATE',
        details: { id: studentId, student_number: nextNum, name: nextName }
      });

      return sendJson(res, 200, {
        ok: true,
        message: 'Biodata siswa berhasil diperbarui.',
        student: updated
      });
    }

    if (method === 'DELETE') {
      db.prepare('DELETE FROM students WHERE id = ? AND group_id = ?').run(studentId, targetGroupId);
      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: targetGroupId,
        action: 'STUDENT_DELETE',
        details: { id: studentId, name: existing.name }
      });
      return sendJson(res, 200, { ok: true, message: 'Data siswa berhasil dihapus.' });
    }
  }

  // =========================================================================
  // 6. SCHEDULES ENDPOINTS (/api/schedules)
  // =========================================================================
  if (pathname === '/api/schedules/today' && method === 'GET') {
    const classInfo = db.prepare('SELECT * FROM classes WHERE group_id = ?').get(targetGroupId);
    const currentWeek = classInfo ? calculateWeekNumber(classInfo.semester_start_date) : 1;
    const now = new Date();
    const dayIndex = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const todayItems = (dayIndex >= 1 && dayIndex <= 5)
      ? db.prepare(`
          SELECT * FROM schedules
          WHERE group_id = ? AND week_number = ? AND day_index = ?
          ORDER BY time_start ASC
        `).all(targetGroupId, currentWeek, dayIndex)
      : [];

    const ongoingItems = todayItems.filter(it => it.time_start <= currentTime && it.time_end >= currentTime);

    return sendJson(res, 200, {
      ok: true,
      week_number: currentWeek,
      day_index: dayIndex,
      current_time: currentTime,
      today_schedules: todayItems,
      ongoing_schedules: ongoingItems
    });
  }

  if (pathname === '/api/schedules' && method === 'GET') {
    const classInfo = db.prepare('SELECT * FROM classes WHERE group_id = ?').get(targetGroupId);
    const activeWeek = classInfo ? calculateWeekNumber(classInfo.semester_start_date) : 1;

    const weekParam = reqUrl.searchParams.get('week_number') || reqUrl.searchParams.get('week');
    const dayParam = reqUrl.searchParams.get('day_index') || reqUrl.searchParams.get('day');
    const teacherParam = cleanStr(reqUrl.searchParams.get('teacher'), 100);

    let sql = 'SELECT * FROM schedules WHERE group_id = ?';
    const params = [targetGroupId];

    if (weekParam && weekParam !== 'all') {
      const wn = parseInt(weekParam, 10);
      if (!isNaN(wn)) {
        sql += ' AND week_number = ?';
        params.push(wn);
      }
    } else if (!weekParam && !teacherParam) {
      sql += ' AND week_number = ?';
      params.push(activeWeek);
    }

    if (dayParam) {
      const di = parseInt(dayParam, 10);
      if (!isNaN(di) && di >= 1 && di <= 5) {
        sql += ' AND day_index = ?';
        params.push(di);
      }
    }

    if (teacherParam) {
      sql += ' AND (teacher_name LIKE ? OR subject_name LIKE ?)';
      params.push(`%${teacherParam}%`, `%${teacherParam}%`);
    }

    sql += ' ORDER BY week_number ASC, day_index ASC, time_start ASC';
    const schedules = db.prepare(sql).all(...params);

    return sendJson(res, 200, {
      ok: true,
      active_week: activeWeek,
      schedules
    });
  }

  if (pathname === '/api/schedules' && method === 'POST') {
    const weekNumber = parseInt(body.week_number, 10);
    const dayIndex = parseInt(body.day_index, 10);
    const blockType = cleanStr(body.block_type || 'TEORI', 20).toUpperCase();
    const subjectName = cleanStr(body.subject_name, 150);
    const teacherName = cleanStr(body.teacher_name, 150);
    const roomName = cleanStr(body.room_name, 100);
    const timeStart = cleanStr(body.time_start || '07:00', 10);
    const timeEnd = cleanStr(body.time_end || '15:30', 10);
    const notes = cleanStr(body.notes, 300) || null;

    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 20) {
      return sendJson(res, 400, { ok: false, error: 'Minggu KBM harus berupa angka antara 1 sampai 20.' });
    }
    if (isNaN(dayIndex) || dayIndex < 1 || dayIndex > 5) {
      return sendJson(res, 400, { ok: false, error: 'Hari KBM harus antara 1 (Senin) sampai 5 (Jumat).' });
    }
    if (!['TEORI', 'BENGKEL'].includes(blockType)) {
      return sendJson(res, 400, { ok: false, error: 'Tipe blok harus TEORI atau BENGKEL.' });
    }
    if (!subjectName || !teacherName || !roomName) {
      return sendJson(res, 400, { ok: false, error: 'Nama mata pelajaran, guru, dan ruangan wajib diisi.' });
    }

    const resInsert = db.prepare(`
      INSERT INTO schedules (group_id, week_number, day_index, block_type, subject_name, teacher_name, room_name, time_start, time_end, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(targetGroupId, weekNumber, dayIndex, blockType, subjectName, teacherName, roomName, timeStart, timeEnd, notes);

    const created = db.prepare('SELECT * FROM schedules WHERE id = ?').get(Number(resInsert.lastInsertRowid));

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'SCHEDULE_CREATE',
      details: { id: created.id, week_number: weekNumber, day_index: dayIndex, subject_name: subjectName }
    });

    return sendJson(res, 201, {
      ok: true,
      message: 'Jadwal berhasil ditambahkan.',
      schedule: created
    });
  }

  const scheduleIdMatch = pathname.match(/^\/api\/schedules\/(\d+)$/);
  if (scheduleIdMatch) {
    const scheduleId = parseInt(scheduleIdMatch[1], 10);
    const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);

    if (!existing) {
      return sendJson(res, 404, { ok: false, error: 'Jadwal tidak ditemukan.' });
    }
    if (existing.group_id !== targetGroupId) {
      return sendJson(res, 403, { ok: false, error: 'Akses ditolak: Jadwal milik kelas lain.' });
    }

    if (method === 'PUT' || method === 'PATCH') {
      const weekNumber = body.week_number !== undefined ? parseInt(body.week_number, 10) : existing.week_number;
      const dayIndex = body.day_index !== undefined ? parseInt(body.day_index, 10) : existing.day_index;
      const blockType = body.block_type !== undefined ? cleanStr(body.block_type, 20).toUpperCase() : existing.block_type;
      const subjectName = body.subject_name !== undefined ? cleanStr(body.subject_name, 150) : existing.subject_name;
      const teacherName = body.teacher_name !== undefined ? cleanStr(body.teacher_name, 150) : existing.teacher_name;
      const roomName = body.room_name !== undefined ? cleanStr(body.room_name, 100) : existing.room_name;
      const timeStart = body.time_start !== undefined ? cleanStr(body.time_start, 10) : existing.time_start;
      const timeEnd = body.time_end !== undefined ? cleanStr(body.time_end, 10) : existing.time_end;
      const notes = body.notes !== undefined ? (cleanStr(body.notes, 300) || null) : existing.notes;

      if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 20 || isNaN(dayIndex) || dayIndex < 1 || dayIndex > 5) {
        return sendJson(res, 400, { ok: false, error: 'Minggu (1-20) atau hari (1-5) tidak valid.' });
      }
      if (!['TEORI', 'BENGKEL'].includes(blockType)) {
        return sendJson(res, 400, { ok: false, error: 'Tipe blok harus TEORI atau BENGKEL.' });
      }

      db.prepare(`
        UPDATE schedules
        SET week_number = ?, day_index = ?, block_type = ?, subject_name = ?, teacher_name = ?, room_name = ?, time_start = ?, time_end = ?, notes = ?
        WHERE id = ? AND group_id = ?
      `).run(weekNumber, dayIndex, blockType, subjectName, teacherName, roomName, timeStart, timeEnd, notes, scheduleId, targetGroupId);

      const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);

      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: targetGroupId,
        action: 'SCHEDULE_UPDATE',
        details: { id: scheduleId, subject_name: subjectName }
      });

      return sendJson(res, 200, {
        ok: true,
        message: 'Jadwal berhasil diperbarui.',
        schedule: updated
      });
    }

    if (method === 'DELETE') {
      db.prepare('DELETE FROM schedules WHERE id = ? AND group_id = ?').run(scheduleId, targetGroupId);
      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: targetGroupId,
        action: 'SCHEDULE_DELETE',
        details: { id: scheduleId, subject_name: existing.subject_name }
      });
      return sendJson(res, 200, { ok: true, message: 'Jadwal berhasil dihapus.' });
    }
  }

  // =========================================================================
  // 7. CASH MANAGEMENT ENDPOINTS (/api/cash)
  // =========================================================================
  if (pathname === '/api/cash/settings' && method === 'GET') {
    const settings = db.prepare('SELECT * FROM cash_settings WHERE group_id = ?').get(targetGroupId) || {
      group_id: targetGroupId,
      weekly_fee: 0,
      active_weeks_count: 0
    };

    const classInfo = db.prepare('SELECT * FROM classes WHERE group_id = ?').get(targetGroupId);
    const activeSchoolWeek = classInfo ? calculateWeekNumber(classInfo.semester_start_date) : 1;

    const treasurers = db.prepare(`
      SELECT cr.phone_number,
             COALESCE(
               (SELECT holder_name FROM organization_structures os WHERE os.group_id = cr.group_id AND (os.phone_number LIKE '%' || REPLACE(REPLACE(cr.phone_number, '+', ''), '@s.whatsapp.net', '') || '%' OR cr.phone_number LIKE '%' || REPLACE(REPLACE(os.phone_number, '+', ''), '@s.whatsapp.net', '') || '%') LIMIT 1),
               (SELECT name FROM students s WHERE s.group_id = cr.group_id AND (s.phone_number LIKE '%' || REPLACE(REPLACE(cr.phone_number, '+', ''), '@s.whatsapp.net', '') || '%' OR cr.phone_number LIKE '%' || REPLACE(REPLACE(s.phone_number, '+', ''), '@s.whatsapp.net', '') || '%') LIMIT 1),
               (SELECT name FROM web_users wu WHERE wu.phone_number = cr.phone_number LIMIT 1)
             ) AS name
      FROM class_roles cr
      WHERE cr.group_id = ? AND cr.role = 'BENDAHARA'
    `).all(targetGroupId);

    return sendJson(res, 200, {
      ok: true,
      active_school_week: activeSchoolWeek,
      settings: {
        group_id: targetGroupId,
        weekly_fee: Number(settings.weekly_fee || 0),
        active_weeks_count: Number(settings.active_weeks_count || 0),
        updated_at: settings.updated_at || null
      },
      treasurers: treasurers.map(t => ({
        phone_number: t.phone_number,
        name: t.name || null
      })),
      treasurer_names: treasurers.map(t => t.name || t.phone_number)
    });
  }

  if (pathname === '/api/cash/settings' && (method === 'POST' || method === 'PUT')) {
    const current = db.prepare('SELECT * FROM cash_settings WHERE group_id = ?').get(targetGroupId);
    const weeklyFee = body.weekly_fee !== undefined ? parseInt(body.weekly_fee, 10) : Number(current?.weekly_fee || 5000);
    const activeWeeks = body.active_weeks_count !== undefined ? parseInt(body.active_weeks_count, 10) : Number(current?.active_weeks_count || 0);

    if (isNaN(weeklyFee) || weeklyFee < 0) {
      return sendJson(res, 400, { ok: false, error: 'Nominal tarif kas mingguan tidak valid.' });
    }
    if (isNaN(activeWeeks) || activeWeeks < 0 || activeWeeks > 52) {
      return sendJson(res, 400, { ok: false, error: 'Jumlah minggu aktif harus antara 0 sampai 52.' });
    }

    db.prepare(`
      INSERT INTO cash_settings (group_id, weekly_fee, active_weeks_count, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(group_id) DO UPDATE SET
        weekly_fee = excluded.weekly_fee,
        active_weeks_count = excluded.active_weeks_count,
        updated_at = CURRENT_TIMESTAMP
    `).run(targetGroupId, weeklyFee, activeWeeks);

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'CASH_SETTINGS_UPDATE',
      details: { weekly_fee: weeklyFee, active_weeks_count: activeWeeks }
    });

    return sendJson(res, 200, {
      ok: true,
      message: 'Pengaturan kas kelas berhasil disimpan.',
      settings: {
        group_id: targetGroupId,
        weekly_fee: weeklyFee,
        active_weeks_count: activeWeeks
      }
    });
  }

  if (pathname === '/api/cash/recap' && method === 'GET') {
    const settings = db.prepare('SELECT weekly_fee, active_weeks_count FROM cash_settings WHERE group_id = ?').get(targetGroupId);
    const weeklyFee = Number(settings?.weekly_fee || 0);
    const activeWeeks = Number(settings?.active_weeks_count || 0);

    const students = db.prepare(`
      SELECT id, student_number, name, phone_number
      FROM students
      WHERE group_id = ?
      ORDER BY student_number ASC
    `).all(targetGroupId);

    const payments = db.prepare(`
      SELECT student_id, week_number, is_paid
      FROM cash_payments
      WHERE group_id = ?
    `).all(targetGroupId);

    const paymentMap = new Map();
    for (const p of payments) {
      if (!paymentMap.has(p.student_id)) {
        paymentMap.set(p.student_id, {});
      }
      paymentMap.get(p.student_id)[p.week_number] = Boolean(p.is_paid);
    }

    // Kas kelas: periksa apakah kelas memiliki pembayaran di minggu 1
    const hasWeek1 = db.prepare('SELECT 1 FROM cash_payments WHERE group_id = ? AND week_number = 1 AND is_paid = 1 LIMIT 1').get(targetGroupId);
    const startWeek = hasWeek1 ? 1 : 2;
    const maxWeek = Number(settings?.active_weeks_count || 1);
    const totalWeeks = Math.max(0, maxWeek - startWeek + 1);

    const recapList = students.map(s => {
      const weeksObj = paymentMap.get(s.id) || {};
      let paidWeeksCount = 0;
      for (let w = startWeek; w <= maxWeek; w++) {
        if (weeksObj[w]) paidWeeksCount++;
      }
      const unpaidWeeks = Math.max(0, totalWeeks - paidWeeksCount);
      const arrearsNominal = unpaidWeeks * weeklyFee;
      const statusDisplay = unpaidWeeks === 0 ? '✅' : `-Rp${arrearsNominal.toLocaleString('id-ID')}`;

      return {
        student_id: s.id,
        student_number: s.student_number,
        name: s.name,
        phone_number: s.phone_number,
        weeks: weeksObj,
        paid_weeks: paidWeeksCount,
        unpaid_weeks: unpaidWeeks,
        arrears: arrearsNominal,
        is_lunas: unpaidWeeks === 0,
        status_label: statusDisplay
      };
    });

    const formattedText = getCashRecap(targetGroupId);
    const classInfo = db.prepare('SELECT * FROM classes WHERE group_id = ?').get(targetGroupId);
    const activeSchoolWeek = classInfo ? calculateWeekNumber(classInfo.semester_start_date) : 1;

    return sendJson(res, 200, {
      ok: true,
      active_school_week: activeSchoolWeek,
      weekly_fee: weeklyFee,
      active_weeks_count: activeWeeks,
      students: recapList,
      formatted_text: formattedText
    });
  }

  if (pathname === '/api/cash/payments' && method === 'POST') {
    const updates = Array.isArray(body.payments)
      ? body.payments
      : [{ student_id: body.student_id, week_number: body.week_number, is_paid: body.is_paid }];

    const upsertPayment = db.prepare(`
      INSERT INTO cash_payments (group_id, student_id, week_number, is_paid, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(group_id, student_id, week_number)
      DO UPDATE SET is_paid = excluded.is_paid, updated_at = CURRENT_TIMESTAMP
    `);

    const checkStudent = db.prepare('SELECT id FROM students WHERE id = ? AND group_id = ?');
    const updateActiveWeeks = db.prepare(`
      UPDATE cash_settings 
      SET active_weeks_count = MAX(active_weeks_count, ?), updated_at = CURRENT_TIMESTAMP
      WHERE group_id = ?
    `);

    let updatedCount = 0;
    db.exec('BEGIN');
    try {
      for (const item of updates) {
        const sid = parseInt(item.student_id, 10);
        const wnum = parseInt(item.week_number, 10);
        const isPaid = item.is_paid ? 1 : 0;

        if (isNaN(sid) || isNaN(wnum) || wnum < 1 || wnum > 52) continue;

        const studentRow = checkStudent.get(sid, targetGroupId);
        if (!studentRow) {
          throw new Error('FORBIDDEN_STUDENT');
        }

        upsertPayment.run(targetGroupId, sid, wnum, isPaid);
        updateActiveWeeks.run(wnum, targetGroupId);
        updatedCount++;
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      if (err.message === 'FORBIDDEN_STUDENT') {
        return sendJson(res, 403, { ok: false, error: 'Akses ditolak: Siswa tidak terdaftar di kelas ini.' });
      }
      return sendJson(res, 400, { ok: false, error: 'Gagal memperbarui status pembayaran kas.' });
    }

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'CASH_PAYMENT_UPDATE',
      details: { updated_count: updatedCount }
    });

    return sendJson(res, 200, {
      ok: true,
      message: 'Status pembayaran kas berhasil diperbarui.',
      updated_count: updatedCount
    });
  }

  if (pathname === '/api/cash/import-checklist' && method === 'POST') {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return sendJson(res, 400, { ok: false, error: 'Teks ceklis kas tidak boleh kosong.' });
    }

    const resultMessage = parseChecklistText(targetGroupId, text);
    const isWarn = resultMessage.startsWith('⚠️');

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'CASH_IMPORT_CHECKLIST',
      details: { success: !isWarn }
    });

    return sendJson(res, isWarn ? 400 : 200, {
      ok: !isWarn,
      message: resultMessage
    });
  }

  // =========================================================================
  // 7b. FINANCE / BUKU KAS ENDPOINTS (/api/finance/*)
  // =========================================================================
  if (pathname === '/api/finance/summary' && method === 'GET') {
    const range = reqUrl.searchParams.get('range') || '30d';
    const groupBy = reqUrl.searchParams.get('group_by') || 'day';
    try {
      const data = getFinancialSummary(targetGroupId, { range, groupBy });
      return sendJson(res, 200, { ok: true, ...data });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message || 'Gagal memuat rekap keuangan.' });
    }
  }

  if (pathname === '/api/finance/transactions' && method === 'POST') {
    try {
      let receiptUrl = null;
      if (body.receipt_image) {
        receiptUrl = saveReceiptImage(body.receipt_image);
      }

      const tx = addFinancialTransaction(targetGroupId, {
        type: body.type,
        amount: body.amount,
        description: body.description,
        receipt_url: receiptUrl,
        transaction_date: body.transaction_date,
        created_by: session.name || session.phone_number
      });

      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: targetGroupId,
        action: 'FINANCE_ADD_TX',
        details: { tx_id: tx.id, type: tx.type, amount: tx.amount }
      });

      return sendJson(res, 201, {
        ok: true,
        message: 'Transaksi keuangan berhasil dicatat.',
        transaction: tx
      });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message || 'Gagal mencatat transaksi.' });
    }
  }

  const finTxMatch = pathname.match(/^\/api\/finance\/transactions\/(\d+)$/);
  if (finTxMatch && (method === 'PUT' || method === 'PATCH')) {
    const txId = parseInt(finTxMatch[1], 10);
    try {
      let receiptUrl = body.receipt_url;
      if (body.receipt_image) {
        receiptUrl = saveReceiptImage(body.receipt_image);
      }

      const updated = updateFinancialTransaction(targetGroupId, txId, {
        type: body.type,
        amount: body.amount,
        description: body.description,
        receipt_url: receiptUrl,
        transaction_date: body.transaction_date
      });

      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: targetGroupId,
        action: 'FINANCE_UPDATE_TX',
        details: { tx_id: txId, type: updated.type, amount: updated.amount }
      });

      return sendJson(res, 200, {
        ok: true,
        message: 'Transaksi keuangan berhasil diperbarui.',
        transaction: updated
      });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message || 'Gagal memperbarui transaksi.' });
    }
  }

  if (finTxMatch && method === 'DELETE') {
    const txId = parseInt(finTxMatch[1], 10);
    try {
      deleteFinancialTransaction(targetGroupId, txId);

      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: targetGroupId,
        action: 'FINANCE_DELETE_TX',
        details: { tx_id: txId }
      });

      return sendJson(res, 200, {
        ok: true,
        message: 'Transaksi keuangan berhasil dihapus.'
      });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message || 'Gagal menghapus transaksi.' });
    }
  }

  // =========================================================================
  // 8. ASSIGNMENTS / PR ENDPOINTS (/api/assignments)
  // =========================================================================
  if (pathname === '/api/assignments' && method === 'GET') {
    const statusFilter = (reqUrl.searchParams.get('status') || 'all').toLowerCase();
    let sql = 'SELECT * FROM assignments WHERE group_id = ?';
    const params = [targetGroupId];

    if (statusFilter === 'active') {
      sql += ' AND is_completed = 0';
    } else if (statusFilter === 'completed') {
      sql += ' AND is_completed = 1';
    }

    sql += ' ORDER BY is_completed ASC, deadline ASC, id DESC';
    const assignments = db.prepare(sql).all(...params);

    return sendJson(res, 200, {
      ok: true,
      assignments
    });
  }

  if (pathname === '/api/assignments' && method === 'POST') {
    const subject = cleanStr(body.subject, 120);
    const description = cleanStr(body.description, 2000);
    const deadline = cleanStr(body.deadline, 40);
    const createdBy = cleanStr(body.created_by || session.name || session.role, 100);

    if (!subject || !description || !deadline) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Mata pelajaran, deskripsi tugas, dan tenggat waktu (deadline) wajib diisi.'
      });
    }

    const parsedDate = new Date(deadline);
    if (isNaN(parsedDate.getTime())) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Format tanggal deadline tidak valid.'
      });
    }

    const normalizedDeadline = deadline.replace('T', ' ').slice(0, 16);

    const ins = db.prepare(`
      INSERT INTO assignments (group_id, subject, description, deadline, created_by, is_completed)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(targetGroupId, subject, description, normalizedDeadline, createdBy);

    const created = db.prepare('SELECT * FROM assignments WHERE id = ?').get(Number(ins.lastInsertRowid));

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'ASSIGNMENT_CREATE',
      details: { id: created.id, subject }
    });

    return sendJson(res, 201, {
      ok: true,
      message: 'Tugas / PR berhasil ditambahkan.',
      assignment: created
    });
  }

  const assignmentToggleMatch = pathname.match(/^\/api\/assignments\/(\d+)\/toggle$/);
  if (assignmentToggleMatch && (method === 'PATCH' || method === 'POST')) {
    const assignmentId = parseInt(assignmentToggleMatch[1], 10);
    const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);

    if (!existing) {
      return sendJson(res, 404, { ok: false, error: 'Tugas tidak ditemukan.' });
    }
    if (existing.group_id !== targetGroupId) {
      return sendJson(res, 403, { ok: false, error: 'Akses ditolak: Tugas milik kelas lain.' });
    }

    const nextState = existing.is_completed ? 0 : 1;
    db.prepare('UPDATE assignments SET is_completed = ? WHERE id = ? AND group_id = ?')
      .run(nextState, assignmentId, targetGroupId);

    const updated = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'ASSIGNMENT_TOGGLE',
      details: { id: assignmentId, is_completed: Boolean(nextState) }
    });

    return sendJson(res, 200, {
      ok: true,
      message: nextState ? 'Tugas ditandai selesai.' : 'Tugas dibuka kembali.',
      assignment: updated
    });
  }

  const assignmentIdMatch = pathname.match(/^\/api\/assignments\/(\d+)$/);
  if (assignmentIdMatch) {
    const assignmentId = parseInt(assignmentIdMatch[1], 10);
    const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);

    if (!existing) {
      return sendJson(res, 404, { ok: false, error: 'Tugas tidak ditemukan.' });
    }
    if (existing.group_id !== targetGroupId) {
      return sendJson(res, 403, { ok: false, error: 'Akses ditolak: Tugas milik kelas lain.' });
    }

    if (method === 'GET') {
      return sendJson(res, 200, { ok: true, assignment: existing });
    }

    if (method === 'PUT' || method === 'PATCH') {
      const subject = body.subject !== undefined ? cleanStr(body.subject, 120) : existing.subject;
      const description = body.description !== undefined ? cleanStr(body.description, 2000) : existing.description;
      const deadlineRaw = body.deadline !== undefined ? cleanStr(body.deadline, 40) : existing.deadline;
      const deadline = deadlineRaw.replace('T', ' ').slice(0, 16);
      const isCompleted = body.is_completed !== undefined ? (body.is_completed ? 1 : 0) : existing.is_completed;

      if (!subject || !description || !deadline) {
        return sendJson(res, 400, { ok: false, error: 'Data tugas tidak lengkap.' });
      }

      db.prepare(`
        UPDATE assignments
        SET subject = ?, description = ?, deadline = ?, is_completed = ?
        WHERE id = ? AND group_id = ?
      `).run(subject, description, deadline, isCompleted, assignmentId, targetGroupId);

      const updated = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);

      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: targetGroupId,
        action: 'ASSIGNMENT_UPDATE',
        details: { id: assignmentId, subject }
      });

      return sendJson(res, 200, {
        ok: true,
        message: 'Tugas berhasil diperbarui.',
        assignment: updated
      });
    }

    if (method === 'DELETE') {
      db.prepare('DELETE FROM assignments WHERE id = ? AND group_id = ?').run(assignmentId, targetGroupId);
      writeAuditLog({
        user_id: session.user_id,
        phone_number: session.phone_number,
        role: session.role,
        group_id: targetGroupId,
        action: 'ASSIGNMENT_DELETE',
        details: { id: assignmentId, subject: existing.subject }
      });
      return sendJson(res, 200, { ok: true, message: 'Tugas berhasil dihapus.' });
    }
  }

  // =========================================================================
  // 9. ORGANIZATION STRUCTURE ENDPOINTS (/api/structure)
  // =========================================================================
  if (pathname === '/api/structure' && method === 'GET') {
    const structures = db.prepare(`
      SELECT * FROM organization_structures
      WHERE group_id = ?
    `).all(targetGroupId);

    structures.sort((a, b) => {
      const wDiff = getPositionWeight(a.position_name) - getPositionWeight(b.position_name);
      if (wDiff !== 0) return wDiff;
      return a.position_name.localeCompare(b.position_name);
    });

    const roles = db.prepare(`
      SELECT id, group_id, phone_number, role
      FROM class_roles
      WHERE group_id = ?
    `).all(targetGroupId);

    const linkedGroups = db.prepare(`
      SELECT id, group_id, target_group_id, group_label, created_at
      FROM class_groups
      WHERE target_group_id = ?
      ORDER BY created_at ASC
    `).all(targetGroupId);

    const classInfo = db.prepare(`
      SELECT group_id, class_name, academic_year, semester_start_date
      FROM classes
      WHERE group_id = ?
    `).get(targetGroupId);

    return sendJson(res, 200, {
      ok: true,
      structures,
      class_roles: roles,
      linked_groups: linkedGroups,
      class_info: classInfo
    });
  }

  if (pathname === '/api/structure' && (method === 'POST' || method === 'PUT')) {
    const positionName = cleanStr(body.position_name, 80).toUpperCase();
    const holderName = cleanStr(body.holder_name, 120);
    const rawPhone = cleanStr(body.phone_number, 50);
    const normPhone = rawPhone ? normalizePhone(rawPhone) : null;
    const jidPhone = normPhone ? `${normPhone}@s.whatsapp.net` : (rawPhone || null);

    if (!positionName || !holderName) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Nama jabatan dan nama pejabat pengurus wajib diisi.'
      });
    }

    db.prepare(`
      INSERT INTO organization_structures (group_id, position_name, holder_name, phone_number)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(group_id, position_name) DO UPDATE SET
        holder_name = excluded.holder_name,
        phone_number = excluded.phone_number
    `).run(targetGroupId, positionName, holderName, jidPhone);

    // Sinkronkan ke class_roles apabila jabatan adalah KETUA, SEKRETARIS, atau BENDAHARA
    if (jidPhone) {
      let mappedRole = null;
      if (positionName.includes('BENDAHARA')) {
        mappedRole = 'BENDAHARA';
      } else if (positionName.includes('SEKRETARIS') || positionName.includes('SEKERTARIS')) {
        mappedRole = 'SEKRETARIS';
      } else if (positionName === 'KETUA' || positionName === 'KETUA KELAS') {
        mappedRole = 'KETUA';
      }

      if (mappedRole) {
        db.prepare(`
          INSERT OR IGNORE INTO class_roles (group_id, phone_number, role)
          VALUES (?, ?, ?)
        `).run(targetGroupId, jidPhone, mappedRole);
      }
    }

    const saved = db.prepare(`
      SELECT * FROM organization_structures
      WHERE group_id = ? AND position_name = ?
    `).get(targetGroupId, positionName);

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'STRUCTURE_UPSERT',
      details: { position_name: positionName, holder_name: holderName }
    });

    return sendJson(res, 200, {
      ok: true,
      message: `Jabatan ${positionName} berhasil disimpan.`,
      structure: saved
    });
  }

  const structureIdMatch = pathname.match(/^\/api\/structure\/(\d+)$/);
  if (structureIdMatch && method === 'DELETE') {
    const structId = parseInt(structureIdMatch[1], 10);
    const existing = db.prepare('SELECT * FROM organization_structures WHERE id = ?').get(structId);

    if (!existing) {
      return sendJson(res, 404, { ok: false, error: 'Jabatan tidak ditemukan.' });
    }
    if (existing.group_id !== targetGroupId) {
      return sendJson(res, 403, { ok: false, error: 'Akses ditolak: Data milik kelas lain.' });
    }

    db.prepare('DELETE FROM organization_structures WHERE id = ? AND group_id = ?').run(structId, targetGroupId);

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroupId,
      action: 'STRUCTURE_DELETE',
      details: { id: structId, position_name: existing.position_name }
    });

    return sendJson(res, 200, {
      ok: true,
      message: `Jabatan ${existing.position_name} berhasil dihapus.`
    });
  }

  // =========================================================================
  // 10. AI & UTILITIES ENDPOINTS (/api/utils)
  // =========================================================================
  if (pathname === '/api/utils/calc' && method === 'POST') {
    const expression = cleanStr(body.expression, 300);
    if (!expression) {
      return sendJson(res, 400, { ok: false, error: 'Masukkan rumus matematika yang ingin dihitung.' });
    }
    try {
      const rawResult = evaluateMathRaw(expression);
      const botOutput = calculateMath(expression);
      return sendJson(res, 200, {
        ok: true,
        expression,
        value: String(rawResult),
        result_text: String(rawResult),
        bot_output: botOutput
      });
    } catch (err) {
      return sendJson(res, 400, {
        ok: false,
        error: `Rumus tidak valid: ${err.message}`
      });
    }
  }

  if (pathname === '/api/utils/ai' && method === 'POST') {
    const prompt = cleanStr(body.prompt, 4000);
    if (!prompt) {
      return sendJson(res, 400, { ok: false, error: 'Pertanyaan / prompt AI tidak boleh kosong.' });
    }
    const reply = await askAiAssistant(prompt);
    return sendJson(res, 200, {
      ok: true,
      prompt,
      reply
    });
  }

  // =========================================================================
  // 11. DEVELOPER SYSTEM CONSOLE ENDPOINTS (/api/system)
  // =========================================================================
  if (pathname === '/api/system/status' && method === 'GET') {
    const startPerf = performance.now();
    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;
    const cpus = os.cpus() || [];

    let diskInfo = null;
    try {
      const dfOut = execSync('df -k /', { timeout: 2000 }).toString().trim().split('\n');
      if (dfOut.length >= 2) {
        const parts = dfOut[1].trim().split(/\s+/);
        const totalKb = parseInt(parts[1], 10);
        const usedKb = parseInt(parts[2], 10);
        const availKb = parseInt(parts[3], 10);
        diskInfo = {
          total_gb: Number((totalKb / (1024 * 1024)).toFixed(2)),
          used_gb: Number((usedKb / (1024 * 1024)).toFixed(2)),
          avail_gb: Number((availKb / (1024 * 1024)).toFixed(2)),
          used_percent: Number(((usedKb / totalKb) * 100).toFixed(1))
        };
      }
    } catch {
      // ignore
    }

    const dbStats = {
      classes: Number(db.prepare('SELECT COUNT(*) AS c FROM classes').get()?.c || 0),
      students: Number(db.prepare('SELECT COUNT(*) AS c FROM students').get()?.c || 0),
      schedules: Number(db.prepare('SELECT COUNT(*) AS c FROM schedules').get()?.c || 0),
      assignments: Number(db.prepare('SELECT COUNT(*) AS c FROM assignments').get()?.c || 0),
      cash_payments: Number(db.prepare('SELECT COUNT(*) AS c FROM cash_payments').get()?.c || 0),
      web_users: Number(db.prepare('SELECT COUNT(*) AS c FROM web_users').get()?.c || 0),
      active_sessions: Number(db.prepare('SELECT COUNT(*) AS c FROM web_sessions WHERE expires_at > ?').get(Date.now())?.c || 0)
    };

    const statusText = getSystemStatusInfo(null, startPerf);

    return sendJson(res, 200, {
      ok: true,
      metrics: {
        hostname: os.hostname(),
        platform: `${os.type()} ${os.release()} (${os.arch()})`,
        cpu_model: cpus[0]?.model?.trim() || 'Unknown CPU',
        cpu_cores: cpus.length,
        cpu_speed_mhz: cpus[0]?.speed || 0,
        load_avg: os.loadavg(),
        ram: {
          total_gb: Number((totalRam / (1024 ** 3)).toFixed(2)),
          used_gb: Number((usedRam / (1024 ** 3)).toFixed(2)),
          free_gb: Number((freeRam / (1024 ** 3)).toFixed(2)),
          used_percent: Number(((usedRam / totalRam) * 100).toFixed(1)),
          rss_mb: Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1))
        },
        disk: diskInfo,
        uptime: {
          vps_seconds: Math.floor(os.uptime()),
          process_seconds: Math.floor(process.uptime())
        },
        db_counts: dbStats
      },
      status_text: statusText
    });
  }

  if (pathname === '/api/system/audit-logs' && method === 'GET') {
    const limit = Math.min(200, Math.max(10, parseInt(reqUrl.searchParams.get('limit') || '100', 10)));
    const logs = db.prepare(`
      SELECT * FROM web_audit_logs
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);

    return sendJson(res, 200, {
      ok: true,
      logs
    });
  }

  if (pathname === '/api/system/sticker-limit' && method === 'GET') {
    const summary = getStickerUsageSummary();
    return sendJson(res, 200, {
      ok: true,
      ...summary
    });
  }

  if (pathname === '/api/system/sticker-limit' && (method === 'POST' || method === 'PUT')) {
    const current = getStickerLimitConfig();

    const enabled = body.enabled !== undefined ? Boolean(body.enabled) : current.enabled;
    const maxStickers = body.max_stickers !== undefined ? parseInt(body.max_stickers, 10) : current.max_stickers;
    const windowSeconds = body.window_seconds !== undefined ? parseInt(body.window_seconds, 10) : current.window_seconds;
    const message = body.message !== undefined && String(body.message).trim()
      ? String(body.message).trim()
      : current.message;

    if (!Number.isFinite(maxStickers) || maxStickers < 1 || maxStickers > 100) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Maksimal stiker per grup harus berupa angka antara 1 hingga 100.'
      });
    }

    if (!Number.isFinite(windowSeconds) || windowSeconds < 5 || windowSeconds > 86400) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Durasi jendela waktu (cooldown) harus antara 5 hingga 86400 detik.'
      });
    }

    const updatedConfig = updateStickerLimitConfig({
      enabled,
      max_stickers: maxStickers,
      window_seconds: windowSeconds,
      message
    });

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: 'ALL',
      action: 'STICKER_LIMIT_UPDATE',
      details: `enabled=${updatedConfig.enabled}, max=${updatedConfig.max_stickers}, window=${updatedConfig.window_seconds}s`
    });

    const summary = getStickerUsageSummary();
    return sendJson(res, 200, {
      ok: true,
      message: 'Pengaturan limit pembuatan stiker berhasil diperbarui.',
      ...summary
    });
  }

  if (pathname === '/api/system/sticker-limit/reset' && method === 'POST') {
    const targetGroup = body.group_id ? String(body.group_id).trim() : 'ALL';
    resetStickerRateLimit(targetGroup);

    writeAuditLog({
      user_id: session.user_id,
      phone_number: session.phone_number,
      role: session.role,
      group_id: targetGroup,
      action: 'STICKER_LIMIT_RESET',
      details: `Reset cooldown limit stiker untuk ${targetGroup}`
    });

    const summary = getStickerUsageSummary();
    return sendJson(res, 200, {
      ok: true,
      message: targetGroup === 'ALL'
        ? 'Cooldown limit stiker untuk semua grup berhasil di-reset.'
        : `Cooldown limit stiker untuk grup ${targetGroup} berhasil di-reset.`,
      ...summary
    });
  }

  return sendJson(res, 404, {
    ok: false,
    error: `Endpoint API tidak ditemukan: ${method} ${pathname}`
  });
}
