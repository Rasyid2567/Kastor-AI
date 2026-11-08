import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { db } from '../../database/schema.js';
import { isDeveloper, isClassAdmin, resolveLidToPhone, normalizeIndonesianPhone } from './assignments.js';

/**
 * Handler rahasia /rvo (Read View Once)
 * Mengambil media sekali lihat dari quoted message dan mengirimkannya kembali ke grup sebagai media biasa
 * CATATAN PENTING: Sesuai PRD, perintah ini tersembunyi dan TIDAK BOLEH dicantumkan di /menu.
 */
export async function handleReadViewOnce(sock, msg, groupId) {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) {
    return '⚠️ Balas (*reply*) foto atau video sekali lihat (*View Once*) dengan perintah `/rvo`.';
  }

  // Cek apakah pesan quoted adalah viewOnceMessage atau viewOnceMessageV2
  const viewOnce = quoted.viewOnceMessage || quoted.viewOnceMessageV2 || quoted.viewOnceMessageV2Extension;
  const innerMsg = viewOnce?.message || quoted;

  const isImage = !!innerMsg.imageMessage;
  const isVideo = !!innerMsg.videoMessage;

  if (!isImage && !isVideo) {
    return '⚠️ Pesan yang di-reply bukan media View Once (foto/video).';
  }

  try {
    // Siapkan pesan tiruan untuk didownload Baileys
    const fakeMessage = {
      key: {
        id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
        remoteJid: groupId
      },
      message: innerMsg
    };

    const mediaBuffer = await downloadMediaMessage(fakeMessage, 'buffer', {});

    const originalCaption = innerMsg.imageMessage?.caption || innerMsg.videoMessage?.caption || undefined;

    if (isImage) {
      await sock.sendMessage(groupId, {
        image: mediaBuffer,
        ...(originalCaption ? { caption: originalCaption } : {})
      }, { quoted: msg });
    } else {
      await sock.sendMessage(groupId, {
        video: mediaBuffer,
        ...(originalCaption ? { caption: originalCaption } : {})
      }, { quoted: msg });
    }

    return null; // Pengiriman berhasil langsung via socket
  } catch (err) {
    console.error('Error membaca media View Once:', err.message);
    return `⚠️ Gagal membuka media View Once: ${err.message}`;
  }
}

/**
 * Format durasi detik ke format teks standar pengguna:
 * - 0s   -> "0d"
 * - 45s  -> "45d"
 * - 60s  -> "1m"
 * - 90s  -> "1m 30d"
 * - 120s -> "2m"
 */
export function formatLimitDuration(seconds) {
  const sec = Math.max(0, parseInt(seconds, 10) || 0);
  if (sec === 0) return '0d';
  if (sec < 60) return `${sec}d`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}d`;
}

/**
 * Validasi apakah nomor pengirim adalah Developer atau Pengurus Otoritas
 * Memeriksa Developer config, class_roles, dan web_users dengan resolusi JID/LID.
 */
export function isAuthorizedLimitUser(senderJid, groupId = null, devConfig = process.env.DEVELOPER_NUMBER) {
  if (!senderJid) return false;
  if (isDeveloper(senderJid, devConfig)) return true;

  const cleanJid = senderJid.replace(/:.*@/, '@');
  const digits = cleanJid.split('@')[0].replace(/[^0-9]/g, '');
  const isLid = cleanJid.endsWith('@lid');

  let resolvedPhone = null;
  if (isLid) {
    resolvedPhone = resolveLidToPhone(digits);
  }

  const checkNumbers = new Set();
  checkNumbers.add(cleanJid);
  checkNumbers.add(senderJid);
  if (digits) {
    checkNumbers.add(digits);
    checkNumbers.add(`${digits}@s.whatsapp.net`);
    const norm = normalizeIndonesianPhone(digits);
    if (norm) {
      checkNumbers.add(norm);
      checkNumbers.add(`${norm}@s.whatsapp.net`);
      if (norm.startsWith('62')) {
        checkNumbers.add('0' + norm.slice(2));
      }
    }
  }
  if (resolvedPhone) {
    checkNumbers.add(resolvedPhone);
    checkNumbers.add(`${resolvedPhone}@s.whatsapp.net`);
    const normRes = normalizeIndonesianPhone(resolvedPhone);
    if (normRes) {
      checkNumbers.add(normRes);
      checkNumbers.add(`${normRes}@s.whatsapp.net`);
      if (normRes.startsWith('62')) {
        checkNumbers.add('0' + normRes.slice(2));
      }
    }
  }

  const numberList = Array.from(checkNumbers).filter(Boolean);
  if (numberList.length === 0) return false;

  const placeholders = numberList.map(() => '?').join(',');

  try {
    // 1. Cek class_roles (KETUA, SEKRETARIS, BENDAHARA)
    const roleRow = db.prepare(`
      SELECT role FROM class_roles
      WHERE phone_number IN (${placeholders})
         OR phone_number LIKE ?
    `).get(...numberList, `%${digits}%`);
    if (roleRow) return true;

    // 2. Cek web_users (Pengurus Dashboard terdaftar: DEVELOPER, KETUA, WAKIL, SEKRETARIS, BENDAHARA)
    const webUser = db.prepare(`
      SELECT role FROM web_users
      WHERE phone_number IN (${placeholders})
         OR phone_number LIKE ?
    `).get(...numberList, `%${digits}%`);
    if (webUser) return true;

    // 3. Jika groupId tersedia, cek isClassAdmin
    if (groupId && isClassAdmin(groupId, senderJid, devConfig)) {
      return true;
    }
  } catch (err) {
    console.error('Error checking limit authorization:', err.message);
  }

  return false;
}

/**
 * Mengambil konfigurasi rate limit bot (sticker, ai, tt) dari bot_settings
 */
export function getBotLimitConfig() {
  const parseSec = (val, fallback) => {
    const n = parseInt(val, 10);
    return isNaN(n) ? fallback : Math.max(0, n);
  };

  try {
    const rows = db.prepare(`
      SELECT key, value FROM bot_settings
      WHERE key IN (
        'sticker_limit_enabled', 'sticker_limit_window_seconds',
        'ai_limit_enabled', 'ai_limit_window_seconds',
        'tt_limit_enabled', 'tt_limit_window_seconds'
      )
    `).all();
    const map = {};
    for (const r of rows) map[r.key] = r.value;

    return {
      sticker: {
        enabled: map.sticker_limit_enabled !== undefined ? map.sticker_limit_enabled === '1' : true,
        window_seconds: parseSec(map.sticker_limit_window_seconds, 120)
      },
      ai: {
        enabled: map.ai_limit_enabled !== undefined ? map.ai_limit_enabled === '1' : true,
        window_seconds: parseSec(map.ai_limit_window_seconds, 30)
      },
      tt: {
        enabled: map.tt_limit_enabled !== undefined ? map.tt_limit_enabled === '1' : true,
        window_seconds: parseSec(map.tt_limit_window_seconds, 60)
      }
    };
  } catch {
    return {
      sticker: { enabled: true, window_seconds: 120 },
      ai: { enabled: true, window_seconds: 30 },
      tt: { enabled: true, window_seconds: 60 }
    };
  }
}

/**
 * Memperbarui konfigurasi rate limit bot di tabel bot_settings secara transaksional
 */
export function updateBotLimitConfig(type, { enabled, window_seconds } = {}) {
  const validTypes = ['sticker', 'ai', 'tt'];
  if (!validTypes.includes(type)) {
    throw new Error(`Tipe limit '${type}' tidak valid. Pilihan: sticker, ai, tt`);
  }

  const upsert = db.prepare(`
    INSERT INTO bot_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  db.exec('BEGIN');
  try {
    if (enabled !== undefined) {
      upsert.run(`${type}_limit_enabled`, enabled ? '1' : '0');
    }
    if (window_seconds !== undefined) {
      const sec = Math.max(0, parseInt(window_seconds, 10) || 0);
      upsert.run(`${type}_limit_window_seconds`, String(sec));
      if (sec === 0) {
        upsert.run(`${type}_limit_enabled`, '0');
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return getBotLimitConfig();
}

// In-memory tracker cooldown per-user: Map<userId, timestamp_ms>
const userCooldowns = {
  ai: new Map(),
  tt: new Map(),
  sticker: new Map()
};

/**
 * Memeriksa apakah pengguna sedang dalam status cooldown untuk suatu layanan
 */
export function checkUserCooldown(type, userId) {
  if (!userId) return { allowed: true };
  const configs = getBotLimitConfig();
  const config = configs[type];
  if (!config || !config.enabled || config.window_seconds <= 0) {
    return { allowed: true };
  }

  const now = Date.now();
  const lastTime = userCooldowns[type]?.get(userId);
  if (!lastTime) {
    return { allowed: true };
  }

  const elapsedSec = (now - lastTime) / 1000;
  if (elapsedSec < config.window_seconds) {
    const remainingSec = Math.max(1, Math.ceil(config.window_seconds - elapsedSec));
    return {
      allowed: false,
      remaining_seconds: remainingSec,
      formatted_remaining: formatLimitDuration(remainingSec),
      window_seconds: config.window_seconds
    };
  }

  return { allowed: true };
}

/**
 * Mencatat waktu pemanggilan pengguna ke memori cooldown
 */
export function recordUserCooldown(type, userId) {
  if (!userId || !userCooldowns[type]) return;
  userCooldowns[type].set(userId, Date.now());
}

/**
 * Menghapus catatan cooldown pengguna (misal saat request gagal / dibatalkan)
 */
export function clearUserCooldown(type, userId) {
  if (!userId || !userCooldowns[type]) return;
  userCooldowns[type].delete(userId);
}

/**
 * Me-reset seluruh status cooldown dalam memori
 */
export function resetAllUserCooldowns(type = null) {
  if (type && userCooldowns[type]) {
    userCooldowns[type].clear();
  } else {
    for (const key of Object.keys(userCooldowns)) {
      userCooldowns[key].clear();
    }
  }
}

/**
 * Handler utama perintah rahasia /limit
 * Subcommand: sticker, ai, tt, status, off, on, dan input angka detik
 */
export async function handleLimitCommand(sock, msg, remoteJid, senderJid, args, devNumber) {
  const parts = (args || '').trim().split(/\s+/).filter(Boolean);
  const sub = parts[0]?.toLowerCase();
  const param = parts[1]?.toLowerCase();

  const configs = getBotLimitConfig();

  // Kasus 1: /limit atau /limit status -> Tampilkan seluruh status (BISA DIAKSES SEMUA ORANG)
  if (!sub || sub === 'status') {
    const s = configs.sticker;
    const a = configs.ai;
    const t = configs.tt;

    const sStatus = s.enabled && s.window_seconds > 0 ? `Aktif (*${formatLimitDuration(s.window_seconds)}*)` : 'Dinonaktifkan (*0d*)';
    const aStatus = a.enabled && a.window_seconds > 0 ? `Aktif (*${formatLimitDuration(a.window_seconds)}*)` : 'Dinonaktifkan (*0d*)';
    const tStatus = t.enabled && t.window_seconds > 0 ? `Aktif (*${formatLimitDuration(t.window_seconds)}*)` : 'Dinonaktifkan (*0d*)';

    const text = `⚙️ *INFORMASI RATE LIMIT BOT*\n` +
      `────────────────────────────\n` +
      `🎨 *Stiker (/s, /brat, dll):*\n` +
      `   • Status: ${sStatus}\n` +
      `   • Cooldown: ${s.window_seconds} detik\n\n` +
      `🤖 *AI Assistant (/ai, @mention):*\n` +
      `   • Status: ${aStatus}\n` +
      `   • Cooldown: ${a.window_seconds} detik\n\n` +
      `🎥 *Downloader (/tt, /yt, /ig, /fb):*\n` +
      `   • Status: ${tStatus}\n` +
      `   • Cooldown: ${t.window_seconds} detik`;

    await sock.sendMessage(remoteJid, { text }, { quoted: msg });
    return;
  }

  const isAll = sub === 'all' || sub === '*';

  // Kasus 2: Subcommand tidak dikenal
  if (!isAll && !['sticker', 'ai', 'tt'].includes(sub)) {
    await sock.sendMessage(remoteJid, {
      text: `⚠️ Subcommand tidak valid. Pilihan: \`all\`, \`sticker\`, \`ai\`, \`tt\`, atau \`status\`.`
    }, { quoted: msg });
    return;
  }

  const targets = isAll ? ['sticker', 'ai', 'tt'] : [sub];

  const labelMap = {
    sticker: 'Pembuatan Stiker',
    ai: 'AI Assistant',
    tt: 'Downloader Video (/tt, /yt, /ig, /fb)'
  };

  // Kasus 3: /limit [sub] status atau /limit [sub] tanpa param (Status per fitur juga bisa dibaca semua orang)
  if (!param || param === 'status') {
    if (isAll) {
      return handleLimitCommand(sock, msg, remoteJid, senderJid, 'status', devNumber);
    }
    const c = configs[sub];
    const statusStr = c.enabled && c.window_seconds > 0 ? `Aktif (*${formatLimitDuration(c.window_seconds)}*)` : 'Dinonaktifkan (*0d*)';
    const text = `📊 *STATUS LIMIT ${labelMap[sub].toUpperCase()}*\n` +
      `────────────────────────────\n` +
      `• Status: ${statusStr}\n` +
      `• Cooldown: ${c.window_seconds} detik`;
    await sock.sendMessage(remoteJid, { text }, { quoted: msg });
    return;
  }

  // 2. Validasi Otorisasi Pengubahan: HANYA DEVELOPER YANG BERHAK MENGUBAH LIMIT
  if (!isDeveloper(senderJid, devNumber)) {
    await sock.sendMessage(remoteJid, {
      text: '⚠️ Akses ditolak: Hanya Developer yang berhak mengatur batas limit.'
    }, { quoted: msg });
    return;
  }

  // Kasus 4: Nonaktifkan (/limit [sub] off / 0)
  if (param === 'off' || param === '0' || param === 'mati' || param === 'disable') {
    for (const t of targets) {
      updateBotLimitConfig(t, { enabled: false });
    }
    const targetLabel = isAll ? 'Seluruh fitur (*Stiker*, *AI*, *Downloader*)' : `*${labelMap[sub]}*`;
    await sock.sendMessage(remoteJid, {
      text: `✅ Rate limit ${targetLabel} berhasil *dinonaktifkan* (0d).`
    }, { quoted: msg });
    return;
  }

  // Kasus 5: Aktifkan kembali (/limit [sub] on)
  if (param === 'on' || param === 'aktif' || param === 'enable') {
    for (const t of targets) {
      let windowSec = configs[t].window_seconds;
      if (!windowSec || windowSec <= 0) {
        windowSec = t === 'sticker' ? 120 : t === 'ai' ? 30 : 60;
      }
      updateBotLimitConfig(t, { enabled: true, window_seconds: windowSec });
    }
    const targetLabel = isAll ? 'Seluruh fitur (*Stiker*, *AI*, *Downloader*)' : `*${labelMap[sub]}*`;
    await sock.sendMessage(remoteJid, {
      text: `✅ Rate limit ${targetLabel} berhasil *diaktifkan*.`
    }, { quoted: msg });
    return;
  }

  // Kasus 6: Input angka detik (/limit [sub] [angka])
  const seconds = parseInt(param, 10);
  if (isNaN(seconds) || seconds < 0) {
    await sock.sendMessage(remoteJid, {
      text: `⚠️ Masukkan durasi cooldown dalam angka detik (contoh: \`/limit ${sub} 90\`).`
    }, { quoted: msg });
    return;
  }

  if (seconds === 0) {
    for (const t of targets) {
      updateBotLimitConfig(t, { enabled: false, window_seconds: 0 });
    }
    const targetLabel = isAll ? 'Seluruh fitur (*Stiker*, *AI*, *Downloader*)' : `*${labelMap[sub]}*`;
    await sock.sendMessage(remoteJid, {
      text: `✅ Rate limit ${targetLabel} berhasil *dinonaktifkan* (0d).`
    }, { quoted: msg });
    return;
  }

  for (const t of targets) {
    updateBotLimitConfig(t, { enabled: true, window_seconds: seconds });
  }
  const formatted = formatLimitDuration(seconds);
  const targetLabel = isAll ? 'Seluruh fitur (*Stiker*, *AI*, *Downloader*)' : `*${labelMap[sub]}*`;
  await sock.sendMessage(remoteJid, {
    text: `✅ Rate limit ${targetLabel} berhasil diatur ke *${formatted}* (${seconds} detik).`
  }, { quoted: msg });
}
