import { getScheduleToday, getScheduleTomorrow, getScheduleByDay, getScheduleFull, getScheduleNow, searchScheduleByTeacher } from './modules/schedule.js';
import { getTreasurerRole, setWeeklyFee, parseChecklistText, parseExcelCash, getCashRecap, getStudentCashBill, setClassTreasurer, getClassTreasurers, removeClassTreasurer } from './modules/cash.js';
import { getFinancialSummary, getFormattedFinanceReport } from './modules/finance.js';
import { isClassAdmin, isDeveloper, getActiveAssignments, getAllAssignments, getAssignmentDetail, addAssignment, completeAssignment, deleteAssignment } from './modules/assignments.js';
import { handleTagAll, handleHideTag, getOrganizationStructure, setOrganizationPosition, deleteOrganizationPosition, handleRemind, isWhatsAppAdmin } from './modules/admin.js';
import { calculateMath, performOcr, createPdfFromImages, convertToSticker, convertStickerToImage, convertStickerToGif, generateBratImage, generateBratVideo, generateStickerMeme, generateEmojiMix, generateQuoteChat, checkStickerRateLimit, recordStickerUsage, removeStickerUsageById } from './modules/media.js';
import { handleReadViewOnce } from './modules/secret.js';
import { askAiAssistant, extractTextFromDocument } from './modules/ai.js';
import { getSystemStatusInfo } from './modules/system.js';
import {
  linkGroupToClass,
  unlinkGroup,
  listLinkedGroups,
  getAvailableClasses,
  parseLinkArguments,
  updateLinkedGroupLabel
} from './modules/classes.js';
import { resolveClassGroupId } from '../database/schema.js';
import { downloadMediaMessage, normalizeMessageContent } from '@whiskeysockets/baileys';

/**
 * Menu bantuan publik
 * CATATAN PENTING: Perintah rahasia /rvo dan /ortu DILARANG dicantumkan di sini
 */
export function getHelpMenu() {
  const line = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  return `📚 PANDUAN BOT KELAS
ARAS 1.0

${line}

⚙️ PENGATURAN
• \`/init [nama_kelas]\`
  ↳ Registrasi kelas (Admin)
• \`/link [nomor/nama]\`
  ↳ Hubungkan grup cabang (Putra/Putri)
• \`/link list\`
  ↳ Daftar grup yang terhubung
• \`/unlink\`
  ↳ Putuskan tautan grup cabang
• \`/siswa\`
  ↳ Daftar siswa
• \`/siswa detail [no/nama]\`
  ↳ Detail biodata siswa
• \`/siswa add [no] [nama]\`
  ↳ Tambah siswa (Admin)
• \`/siswa import [daftar_teks]\`
  ↳ Impor banyak siswa (Admin)
• \`/siswa del [no]\`
  ↳ Hapus siswa (Admin)

${line}

📅 JADWAL PELAJARAN
• \`/jadwal\`
  ↳ Jadwal minggu ini
• \`/jadwal depan\`
  ↳ Jadwal minggu depan
• \`/jadwal lalu\`
  ↳ Jadwal minggu lalu
• \`/jadwal minggu [angka]\`
  ↳ Jadwal minggu tertentu
• \`/jadwal now\`
  ↳ Mapel yang berlangsung
• \`/jadwal cari [nama]\`
  ↳ Cari jadwal guru
• \`/jam [hari]\`
  ↳ Jam pelajaran
• \`/jadwal add [data]\`
  ↳ Tambah jadwal (Admin)
• \`/jadwal edit [data]\`
  ↳ Edit jadwal (Admin)
  Format: \`minggu | hari | TEORI/BENGKEL | mapel | guru | ruang | jam\`

${line}

💰 KAS & KEUANGAN KELAS
• \`/kas\`
  ↳ Tagihan kas pribadi
• \`/kas list\`
  ↳ Rekap tunggakan siswa
• \`/keuangan\` atau \`/saldo\`
  ↳ Laporan saldo kas & buku kas
• \`/kas set [nominal]\`
  ↳ Atur tarif kas (Bendahara/Admin)
• \`/bendahara\`
  ↳ Info bendahara
• \`/bendahara set @tag\`
  ↳ Atur bendahara (Admin)
  Bendahara via PM:
  - Kirim ceklis kas (Contoh: \`1. nama✅\`)
  - Kirim rekap kas \`.xlsx\`

${line}

📝 TUGAS & PR
• \`/pr\`
  ↳ Daftar PR aktif
• \`/pr all\`
  ↳ Riwayat seluruh PR
• \`/pr detail [id]\`
  ↳ Detail tugas
• \`/pr add [mapel] | [deadline] | [ket]\`
  ↳ Tambah PR (Admin)
• \`/pr done [id]\`
  ↳ Tandai selesai (Admin)
• \`/pr del [id]\`
  ↳ Hapus PR (Admin)

${line}

🏛️ ADMINISTRASI
• \`/struktur\`
  ↳ Struktur pengurus kelas
• \`/struktur set [jabatan] [nama] [tag]\`
  ↳ Atur pengurus (Admin)
• \`/struktur del [jabatan]\`
  ↳ Hapus jabatan (Admin)
• \`/tagall [pesan]\`
  ↳ Mention semua anggota (Admin)
• \`/hidetag [pesan]\`
  ↳ Pengumuman tanpa mention (Admin)
• \`/remind [menit] [pesan]\`
  ↳ Pengingat grup

${line}

🎨 MEDIA & UTILITAS
• \`/s\` atau \`/sticker\`
  ↳ Foto/video menjadi stiker
• \`/toimg\`
  ↳ Stiker menjadi foto
• \`/togif\`
  ↳ Stiker animasi menjadi GIF/video
• \`/brat [teks]\`
  ↳ Stiker teks Brat
• \`/bratvid [teks]\`
  ↳ Stiker animasi Brat
• \`/smeme [teks] / [atas]|[bawah]\`
  ↳ Stiker meme (reply foto)
• \`/emojimix [emoji1]+[emoji2]\`
  ↳ Gabungkan dua emoji
• \`/qc [teks]\`
  ↳ Stiker kutipan chat
• \`/ocr\`
  ↳ Ekstrak teks dari foto
• \`/topdf\`
  ↳ Foto dokumen menjadi PDF
• \`/calc [rumus]\`
  ↳ Kalkulator matematika
• \`/ping\`
  ↳ Status & performa bot / server

${line}

🤖 ASISTEN AI
• \`/ai [pertanyaan]\`
• \`/tanya [pertanyaan]\`
  ↳ Tanya materi atau tugas
• \`@Bot\`
  ↳ Bertanya langsung di grup
  Lampiran: PDF, Word, Excel, dan foto (bisa reply dokumen)

${line}
ARAS 1.0 — Asisten Kelas Digital`;
}

/**
 * Ekstraksi contextInfo dari berbagai tipe pesan Baileys (termasuk ephemeral & viewOnce)
 */
function extractContextInfo(msg) {
  const m = normalizeMessageContent(msg?.message) || msg?.message;
  return (
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    m?.documentMessage?.contextInfo ||
    m?.audioMessage?.contextInfo ||
    m?.stickerMessage?.contextInfo ||
    null
  );
}

/**
 * Ekstraksi teks dari pesan yang di-reply (quoted message)
 */
export function extractQuotedText(msg) {
  const contextInfo = extractContextInfo(msg);
  if (!contextInfo?.quotedMessage) return '';
  const qm = normalizeMessageContent(contextInfo.quotedMessage);
  if (!qm) return '';

  return (
    qm.conversation ||
    qm.extendedTextMessage?.text ||
    qm.imageMessage?.caption ||
    qm.videoMessage?.caption ||
    qm.documentMessage?.caption ||
    ''
  ).trim();
}

/**
 * Deteksi berkas media (gambar, video, stiker, dokumen lampiran) baik langsung di pesan maupun di-quote/reply
 */
function detectMediaMessage(msg) {
  // 1. Cek media langsung pada pesan pengirim
  const m = normalizeMessageContent(msg?.message);
  if (m) {
    if (m.imageMessage) {
      return {
        type: 'image',
        target: { message: m },
        isVideo: false,
        fileName: 'image.jpg',
        mimetype: m.imageMessage.mimetype || 'image/jpeg'
      };
    }
    if (m.videoMessage) {
      return {
        type: 'video',
        target: { message: m },
        isVideo: true,
        fileName: 'video.mp4',
        mimetype: m.videoMessage.mimetype || 'video/mp4'
      };
    }
    if (m.stickerMessage) {
      return {
        type: 'sticker',
        target: { message: m },
        isVideo: !!m.stickerMessage.isAnimated,
        fileName: 'sticker.webp',
        mimetype: 'image/webp'
      };
    }
    if (m.documentMessage) {
      const mime = m.documentMessage.mimetype || 'application/octet-stream';
      if (mime.startsWith('image/')) {
        return {
          type: 'image',
          target: { message: m },
          isVideo: false,
          fileName: m.documentMessage.fileName || 'image.jpg',
          mimetype: mime
        };
      }
      if (mime.startsWith('video/')) {
        return {
          type: 'video',
          target: { message: m },
          isVideo: true,
          fileName: m.documentMessage.fileName || 'video.mp4',
          mimetype: mime
        };
      }
      return {
        type: 'document',
        target: { message: m },
        isVideo: false,
        fileName: m.documentMessage.fileName || 'Dokumen',
        mimetype: mime
      };
    }
  }

  // 2. Cek media pada pesan yang di-quote / di-reply
  const contextInfo = extractContextInfo(msg);
  const quoted = contextInfo?.quotedMessage;
  const qm = normalizeMessageContent(quoted);
  if (qm) {
    if (qm.imageMessage) {
      return {
        type: 'image',
        target: { message: qm },
        isVideo: false,
        fileName: 'image.jpg',
        mimetype: qm.imageMessage.mimetype || 'image/jpeg'
      };
    }
    if (qm.videoMessage) {
      return {
        type: 'video',
        target: { message: qm },
        isVideo: true,
        fileName: 'video.mp4',
        mimetype: qm.videoMessage.mimetype || 'video/mp4'
      };
    }
    if (qm.stickerMessage) {
      return {
        type: 'sticker',
        target: { message: qm },
        isVideo: !!qm.stickerMessage.isAnimated,
        fileName: 'sticker.webp',
        mimetype: 'image/webp'
      };
    }
    if (qm.documentMessage) {
      const mime = qm.documentMessage.mimetype || 'application/octet-stream';
      if (mime.startsWith('image/')) {
        return {
          type: 'image',
          target: { message: qm },
          isVideo: false,
          fileName: qm.documentMessage.fileName || 'image.jpg',
          mimetype: mime
        };
      }
      if (mime.startsWith('video/')) {
        return {
          type: 'video',
          target: { message: qm },
          isVideo: true,
          fileName: qm.documentMessage.fileName || 'video.mp4',
          mimetype: mime
        };
      }
      return {
        type: 'document',
        target: { message: qm },
        isVideo: false,
        fileName: qm.documentMessage.fileName || 'Dokumen',
        mimetype: mime
      };
    }
  }

  return null;
}

/**
 * Kompatibilitas alias untuk fungsi yang sudah ada
 */
function detectAttachedOrQuotedMedia(msg) {
  return detectMediaMessage(msg);
}

/**
 * Cek apakah sebuah JID (nomor atau LID) adalah milik bot ini
 */
function isBotJid(jid, sock) {
  if (!jid) return false;
  const targetClean = jid.split('@')[0].split(':')[0];

  const botPhone = sock?.user?.id ? sock.user.id.split('@')[0].split(':')[0] : '6285174169454';
  if (botPhone && targetClean === botPhone) return true;

  const botLid = sock?.user?.lid ? sock.user.lid.split('@')[0].split(':')[0] : '30400348991501';
  if (botLid && targetClean === botLid) return true;

  return targetClean === '6285174169454' || targetClean === '30400348991501';
}

/**
 * Bersihkan prompt AI dari berbagai bentuk tag mention atau nama bot
 */
function cleanAiPrompt(text, botName = 'Kastor AI') {
  let p = text.trim();
  p = p.replace(/^[\/!\.](?:ai|tanya|bot)\s*/i, '');
  
  if (botName) {
    const escaped = botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    p = p.replace(new RegExp(`@?${escaped}\\s*[:,]?\\s*`, 'gi'), '');
  }

  p = p.replace(/@?(?:bot|kastor(?:\s*ai)?|aras|asisten)\s*[:,]?\s*/gi, '');
  p = p.replace(/^@\S+\s*/, '');
  p = p.replace(/@\d+/g, '');

  return p.trim();
}

/**
 * Ekstraksi teks dari berbagai tipe pesan Baileys (termasuk ephemeral & viewOnce)
 */
export function extractMessageText(msg) {
  const m = msg.message?.ephemeralMessage?.message || 
            msg.message?.viewOnceMessage?.message || 
            msg.message?.viewOnceMessageV2?.message || 
            msg.message;
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.documentMessage?.caption ||
    ''
  ).trim();
}

/**
 * Ekstraksi blok biodata siswa multi-baris (Nama, NIS, TTL, Alamat, dan @Tag di bawah alamat)
 */
export function parseStudentBiodataBlocks(rawText, mentionedJids = []) {
  const normalizedText = rawText.replace(/(\b\d{1,2}[\.\)]?)\s*(Nama\s*:)/gi, '$1\n$2');
  const rawBlocks = normalizedText.split(/(?:^|\n)\s*(?=\d{1,2}[\.\)]?\s*(?:\n|Nama\s*:))/i);
  
  const results = [];
  let mentionIdx = 0;

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const numMatch = trimmed.match(/^(\d{1,2})[\.\)]?/);
    if (!numMatch) continue;
    const studentNumber = parseInt(numMatch[1], 10);

    const nameMatch = trimmed.match(/Nama\s*:\s*([^\n\r]+)/i);
    let name = nameMatch ? nameMatch[1].trim() : '';

    const parentMatch = trimmed.match(/(?:Nama\s+)?(?:Ortu|Orang\s*Tua|Wali)\s*:\s*([^\n\r]+)/i);
    const parentName = parentMatch ? parentMatch[1].trim() : null;

    const nisMatch = trimmed.match(/NIS\s*:\s*([^\n\r]+)/i);
    const nis = nisMatch ? nisMatch[1].trim() : null;

    const ttlMatch = trimmed.match(/TTL\s*:\s*([\s\S]+?)(?=\n\s*(?:Alamat|Ortu|Orang\s*Tua|Wali|NIS|Nama|@)|$)/i);
    let birthInfo = ttlMatch ? ttlMatch[1].replace(/\s*\n\s*/g, ' ').trim() : null;

    let address = null;
    let tag = null;

    const alamatIdx = trimmed.search(/Alamat\s*:\s*/i);
    if (alamatIdx !== -1) {
      const afterAlamat = trimmed.slice(alamatIdx).replace(/^Alamat\s*:\s*/i, '');
      const lines = afterAlamat.split('\n').map(l => l.trim()).filter(Boolean);
      const addrLines = [];
      for (const line of lines) {
        if (line.startsWith('@') || /^(?:0|62|\+62)\d{8,15}/.test(line)) {
          tag = line;
        } else if (/^(?:(?:Nama\s+)?(?:Ortu|Orang\s*Tua|Wali)|NIS|TTL|Nama)\s*:/i.test(line)) {
          continue;
        } else {
          addrLines.push(line);
        }
      }
      address = addrLines.join(', ').replace(/\s*,\s*,/g, ',').trim() || null;
    }

    let phone = null;
    if (tag) {
      const digitMatch = tag.match(/@?((?:0|62)\d{8,15})(?:@s\.whatsapp\.net)?/);
      if (digitMatch) {
        let num = digitMatch[1];
        if (num.startsWith('0')) num = '62' + num.slice(1);
        phone = `${num}@s.whatsapp.net`;
      } else if (mentionIdx < mentionedJids.length) {
        phone = mentionedJids[mentionIdx].replace(/:.*@/, '@');
        mentionIdx++;
      }
    }

    if (!name) name = 'Siswa ' + studentNumber;

    results.push({
      student_number: studentNumber,
      name,
      parent_name: parentName,
      nis,
      birth_info: birthInfo,
      address,
      phone_number: phone
    });
  }
  return results;
}

/**
 * Handler Perintah Rahasia /ortu (Tidak Tercantum di Menu)
 */
async function handleOrtuCommand(sock, groupId, classGroupId, query) {
  const { db } = await import('../database/schema.js');
  if (!query) {
    const students = db.prepare('SELECT student_number, name, parent_name FROM students WHERE group_id = ? ORDER BY student_number ASC').all(classGroupId);
    if (students.length === 0) {
      await sock.sendMessage(groupId, { text: 'ℹ️ Belum ada siswa yang didaftarkan di kelas ini.' });
      return;
    }
    let listText = `👨‍👩‍👧‍👦 *DATA ORANG TUA SISWA*\n────────────────────────────\n`;
    students.forEach(s => {
      listText += `${s.student_number}. ${s.name}\n   ↳ Ortu: ${s.parent_name || 'Belum diisi'}\n`;
    });
    listText += `────────────────────────────\n💡 _Ketik \`/ortu [no_absen/nama]\` untuk melihat data spesifik._`;
    await sock.sendMessage(groupId, { text: listText });
    return;
  }

  let student = null;
  const num = parseInt(query, 10);
  if (!isNaN(num)) {
    student = db.prepare('SELECT * FROM students WHERE group_id = ? AND student_number = ?').get(classGroupId, num);
  }
  if (!student) {
    student = db.prepare('SELECT * FROM students WHERE group_id = ? AND name LIKE ?').get(classGroupId, `%${query}%`);
  }

  if (!student) {
    await sock.sendMessage(groupId, { text: `⚠️ Siswa dengan nomor absen atau nama "${query}" tidak ditemukan di kelas ini.` });
    return;
  }

  const phoneDisplay = student.phone_number ? `@${student.phone_number.split('@')[0]}` : '-';
  const ortuText = `👨‍👩‍👧‍👦 *DATA ORANG TUA SISWA*\n` +
    `────────────────────────────\n` +
    '```\n' +
    `Absen  : ${student.student_number}\n` +
    `Nama   : ${student.name}\n` +
    `Ortu   : ${student.parent_name || 'Belum diisi'}\n` +
    '```\n' +
    `*Kontak Siswa:* ${phoneDisplay}\n` +
    `────────────────────────────`;

  await sock.sendMessage(groupId, {
    text: ortuText,
    mentions: student.phone_number ? [student.phone_number] : []
  });
}

/**
 * Main Message Router
 */
export async function routeMessage(sock, msg) {
  const startPerf = performance.now();
  const remoteJid = msg.key.remoteJid;
  const isGroup = remoteJid.endsWith('@g.us');
  const devNumber = process.env.DEVELOPER_NUMBER || '';
  let senderJid = msg.key.participant || remoteJid;

  // Jika pesan dikirim dari akun bot sendiri (misal via WhatsApp Web), prioritaskan identitas developer
  if (msg.key.fromMe && devNumber) {
    const primaryDev = devNumber.split(',')[0].trim().replace(/[^0-9]/g, '');
    senderJid = `${primaryDev}@s.whatsapp.net`;
  }

  const text = extractMessageText(msg);

  // ==========================================
  // 1. ROUTING PRIVATE CHAT (PM)
  // ==========================================
  if (!isGroup) {
    // Validasi apakah pengirim adalah bendahara
    const treasurer = getTreasurerRole(senderJid);

    // Cek upload dokumen Excel
    const isDoc = !!msg.message?.documentMessage;
    const fileName = msg.message?.documentMessage?.fileName || '';

    if (isDoc && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls'))) {
      if (!treasurer) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Nomor Anda tidak terdaftar sebagai bendahara kelas terotorisasi.' });
        return;
      }
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        const result = parseExcelCash(treasurer.group_id, buffer);
        await sock.sendMessage(remoteJid, { text: result });
      } catch (e) {
        await sock.sendMessage(remoteJid, { text: `⚠️ Gagal membaca file Excel: ${e.message}` });
      }
      return;
    }

    // Jika bukan dokumen Excel, periksa teks
    if (!text) return;

    if (text.startsWith('/kas set')) {
      if (!treasurer) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Nomor Anda tidak terdaftar sebagai bendahara kelas terotorisasi.' });
        return;
      }
      const nominal = text.replace('/kas set', '').trim();
      const res = setWeeklyFee(treasurer.group_id, nominal);
      await sock.sendMessage(remoteJid, { text: res });
      return;
    }

    // Periksa apakah pesan adalah teks ceklis kas (e.g., KAS TANGGAL... atau 1. nama✅)
    if (/^\s*\d+[\.\)]\s*/m.test(text) || /KAS\s+TANGGAL/i.test(text)) {
      if (!treasurer) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Nomor Anda tidak terdaftar sebagai bendahara kelas terotorisasi.' });
        return;
      }
      const res = parseChecklistText(treasurer.group_id, text);
      await sock.sendMessage(remoteJid, { text: res });
      return;
    }

    // Menu PM biasa
    if (text === '/start' || text === '/help') {
      await sock.sendMessage(remoteJid, {
        text: `Halo! Saya adalah sistem bot administrasi kelas.\n${treasurer ? `Anda terdeteksi sebagai *Bendahara Kelas (${treasurer.class_name})*.\nKirimkan rekapan kas via PM ini (format ceklis atau upload file .xlsx), atau ketik \`/keuangan\` untuk melihat saldo.` : 'Untuk interaksi kelas, silakan gunakan bot di dalam grup WhatsApp Anda.'}`
      });
      return;
    }

    if (text === '/keuangan' || text === '/saldo') {
      const targetGid = treasurer ? treasurer.group_id : null;
      if (!targetGid) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Gunakan perintah ini di dalam grup kelas Anda atau pastikan Anda terdaftar sebagai pengurus.' });
        return;
      }
      const res = getFormattedFinanceReport(targetGid);
      await sock.sendMessage(remoteJid, { text: res });
      return;
    }

    // Status Bot & Server via PM
    if (text === '/ping' || text === '/status' || text === '.ping' || text === '.status') {
      const statusText = getSystemStatusInfo(msg.messageTimestamp, startPerf);
      await sock.sendMessage(remoteJid, { text: statusText }, { quoted: msg });
      return;
    }

    // Asisten AI via PM (/ai, /tanya)
    if (text.startsWith('/ai') || text.startsWith('/tanya')) {
      const cleanPrompt = text.replace(/^(\/ai|\/tanya)\s*/i, '').trim();
      const media = detectAttachedOrQuotedMedia(msg);
      let docData = null;

      if (media) {
        try {
          await sock.sendPresenceUpdate('composing', remoteJid);
          const mediaBuf = await downloadMediaMessage(media.target, 'buffer', {});
          const extracted = await extractTextFromDocument(mediaBuf, media.fileName, media.mimetype);
          if (extracted) {
            docData = { fileName: media.fileName, text: extracted };
          }
        } catch (err) {
          console.error('Gagal mengekstrak dokumen PM untuk AI:', err.message);
        }
      }

      const quotedText = extractQuotedText(msg);

      if (!cleanPrompt && !docData && !quotedText) {
        await sock.sendMessage(remoteJid, { text: 'Halo! Silakan masukkan pertanyaan setelah perintah.\nContoh: `/ai apa itu normalisasi database?` atau kirim bersama dokumen/foto tugas.' });
        return;
      }

      try {
        await sock.sendPresenceUpdate('composing', remoteJid);
      } catch {}
      const aiReply = await askAiAssistant(cleanPrompt, docData, quotedText);
      await sock.sendMessage(remoteJid, { text: aiReply }, { quoted: msg });
      return;
    }

    return; // Abaikan pesan PM non-otoritas lainnya
  }

  // ==========================================
  // 2. ROUTING GRUP KELAS
  // ==========================================
  const groupId = remoteJid;

  // Kasus A: Pesan berawalan '/' atau status '.' (Command Handler)
  const isCmd = text.startsWith('/') || /^\.(ping|status)\b/i.test(text);
  if (isCmd) {
    const parts = text.split(' ');
    let cmd = parts[0].toLowerCase();
    if (cmd.startsWith('.')) cmd = '/' + cmd.slice(1);
    const args = parts.slice(1).join(' ').trim();

    // 2.1 Menu Bantuan
    if (cmd === '/menu' || cmd === '/help') {
      await sock.sendMessage(groupId, { text: getHelpMenu() });
      return;
    }

    // 2.1.0 Status Bot & Server (/ping & /status)
    if (cmd === '/ping' || cmd === '/status') {
      const statusText = getSystemStatusInfo(msg.messageTimestamp, startPerf);
      await sock.sendMessage(groupId, { text: statusText }, { quoted: msg });
      return;
    }

    // 2.1.1 Inisialisasi / Registrasi Grup Kelas (/init [nama_kelas])
    if (cmd === '/init') {
      const { db } = await import('../database/schema.js');

      // Proteksi agar /init hanya bisa dilakukan satu kali per grup
      const existingClass = db.prepare('SELECT class_name FROM classes WHERE group_id = ?').get(groupId);
      if (existingClass) {
        await sock.sendMessage(groupId, {
          text: `⚠️ Grup ini sudah pernah diinisialisasi sebelumnya sebagai *${existingClass.class_name}*!\n` +
            `Inisialisasi hanya dapat dilakukan satu kali per grup.\n\n` +
            `• Untuk mengatur struktur pengurus: \`/struktur set [jabatan] [nama]\`\n` +
            `• Untuk melihat daftar perintah: \`/menu\``
        });
        return;
      }

      // Cek apakah grup ini sudah terhubung sebagai grup cabang ke kelas lain
      const existingLink = db.prepare(`
        SELECT cg.*, c.class_name 
        FROM class_groups cg 
        JOIN classes c ON cg.target_group_id = c.group_id 
        WHERE cg.group_id = ?
      `).get(groupId);

      if (existingLink) {
        await sock.sendMessage(groupId, {
          text: `⚠️ Grup ini sudah terhubung ke kelas *${existingLink.class_name}* sebagai grup cabang!\n\n` +
            `• Untuk melihat daftar grup terhubung: \`/link list\`\n` +
            `• Jika ingin membuat kelas mandiri baru di grup ini, putuskan tautan terlebih dahulu dengan: \`/unlink\``
        });
        return;
      }

      let groupMeta = null;
      try {
        groupMeta = await sock.groupMetadata(groupId);
      } catch (e) {
        console.error('Gagal mengambil metadata grup untuk /init:', e.message);
      }

      const isDev = isDeveloper(senderJid, devNumber);
      const isWaAdmin = groupMeta ? isWhatsAppAdmin(groupMeta, senderJid) : false;
      const isClassAdm = isClassAdmin(groupId, senderJid, devNumber);

      if (!isDev && !isWaAdmin && !isClassAdm) {
        await sock.sendMessage(groupId, { text: '⚠️ Perintah `/init` hanya dapat dijalankan oleh Admin Grup WhatsApp atau Developer.' });
        return;
      }

      const className = args || groupMeta?.subject || 'Kelas';

      // Daftarkan grup kelas baru (kosong tanpa siswa dummy dan tanpa ketua otomatis)
      db.prepare(`
        INSERT INTO classes (group_id, class_name, academic_year, semester_start_date)
        VALUES (?, ?, '2026/2027', '2026-07-13')
      `).run(groupId, className);

      await sock.sendMessage(groupId, {
        text: `🎉 *INISIALISASI GRUP KELAS BERHASIL!* 🎉\n` +
          `────────────────────────────\n` +
          `🏫 *Nama Kelas:* ${className}\n` +
          `🆔 *Group ID:* \`\`\`${groupId}\`\`\`\n` +
          `👥 *Data Siswa:* Masih kosong (Gunakan \`/siswa add\` atau \`/siswa import\`)\n` +
          `💰 *Kas Kelas:* Belum diatur (Gunakan \`/kas set [nominal]\`)\n` +
          `🏛️ *Pengurus Kelas:* Atur manual menggunakan \`/struktur set [jabatan] [nama]\`\n\n` +
          `💡 _Ketik \`/menu\` untuk melihat seluruh daftar perintah bot._`
      });
      return;
    }

    // 2.1.1.b Penghubung Grup ke Kelas (/link & /unlink)
    if (cmd === '/link') {
      if (args === 'list' || args === 'daftar') {
        const res = listLinkedGroups(groupId);
        await sock.sendMessage(groupId, { text: res });
        return;
      }

      // Validasi hak akses: Hanya Admin Grup WhatsApp atau Developer
      let groupMeta = null;
      try {
        groupMeta = await sock.groupMetadata(groupId);
      } catch (e) {
        console.error('Gagal mengambil metadata grup untuk /link:', e.message);
      }

      const isDev = isDeveloper(senderJid, devNumber);
      const isWaAdmin = groupMeta ? isWhatsAppAdmin(groupMeta, senderJid) : false;
      const isClassAdm = isClassAdmin(groupId, senderJid, devNumber);

      if (!isDev && !isWaAdmin && !isClassAdm) {
        await sock.sendMessage(groupId, { text: '⚠️ Perintah `/link` hanya dapat dijalankan oleh Admin Grup WhatsApp atau Developer.' });
        return;
      }

      const { db } = await import('../database/schema.js');

      // Cek apakah grup ini sudah terhubung sebagai grup cabang
      const existingLink = db.prepare(`
        SELECT cg.*, c.class_name 
        FROM class_groups cg 
        JOIN classes c ON cg.target_group_id = c.group_id 
        WHERE cg.group_id = ?
      `).get(groupId);

      if (existingLink) {
        // Jika sudah terhubung dan tanpa argumen: berikan status & petunjuk ubah label
        if (!args) {
          await sock.sendMessage(groupId, {
            text: `ℹ️ *STATUS TAUTAN GRUP*\n` +
              `────────────────────────────\n` +
              `🏫 *Kelas Induk:* *${existingLink.class_name}*\n` +
              `🏷️ *Penanda Saat Ini:* *${existingLink.group_label || 'Cabang'}*\n\n` +
              `💡 *Opsi Pengaturan:*\n` +
              `• Untuk mengubah nama penanda grup: \`/link label [nama_penanda_baru]\`\n` +
              `• Untuk memutuskan hubungan: \`/unlink\``
          });
          return;
        }

        // Jika user ingin mengubah label penanda (bisa via /link label X, /link rename X, /link nama X, atau /link X)
        let newLabel = args.replace(/^(label|rename|nama|set-label)\s+/i, '').trim();
        if (!newLabel) newLabel = args.trim();

        const updateRes = updateLinkedGroupLabel(groupId, newLabel);
        await sock.sendMessage(groupId, { text: updateRes.message });
        return;
      }

      // Jika belum terhubung: parsing target kelas dan label penanda secara cerdas
      const { targetIdentifier, groupLabel } = parseLinkArguments(args);
      const res = linkGroupToClass(groupId, targetIdentifier, groupLabel);
      await sock.sendMessage(groupId, { text: res.message });
      return;
    }

    if (cmd === '/unlink') {
      let groupMeta = null;
      try {
        groupMeta = await sock.groupMetadata(groupId);
      } catch (e) {
        console.error('Gagal mengambil metadata grup untuk /unlink:', e.message);
      }

      const isDev = isDeveloper(senderJid, devNumber);
      const isWaAdmin = groupMeta ? isWhatsAppAdmin(groupMeta, senderJid) : false;
      const isClassAdm = isClassAdmin(groupId, senderJid, devNumber);

      if (!isDev && !isWaAdmin && !isClassAdm) {
        await sock.sendMessage(groupId, { text: '⚠️ Perintah `/unlink` hanya dapat dijalankan oleh Admin Grup WhatsApp atau Developer.' });
        return;
      }

      const res = unlinkGroup(groupId);
      await sock.sendMessage(groupId, { text: res.message });
      return;
    }

    // 2.1.2 Manajemen Siswa (/siswa, /siswa add, /siswa del)
    if (cmd === '/siswa') {
      const { db } = await import('../database/schema.js');
      const classGroupId = resolveClassGroupId(groupId);

      if (!args || args === 'list') {
        const students = db.prepare('SELECT student_number, name FROM students WHERE group_id = ? ORDER BY student_number ASC').all(classGroupId);
        if (students.length === 0) {
          await sock.sendMessage(groupId, { text: 'ℹ️ Belum ada siswa yang didaftarkan di kelas ini.\nTambahkan dengan: `/siswa add [no_absen] [nama_siswa]` atau `/siswa import`' });
          return;
        }
        let listText = `📋 *DAFTAR SISWA KELAS*\n────────────────────────────\n`;
        students.forEach(s => {
          listText += `${s.student_number}. ${s.name}\n`;
        });
        listText += `────────────────────────────\n💡 _Ketik \`/siswa detail [no_absen]\` untuk melihat biodata lengkap._`;
        await sock.sendMessage(groupId, { text: listText });
        return;
      }

      // 2.1.2.0 Detail Biodata Siswa (/siswa detail [no/nama])
      if (/^(detail|info)(?:[\s\n]+|$)/i.test(args)) {
        const query = args.replace(/^(detail|info)(?:[\s\n]+|$)/i, '').trim();
        if (!query) {
          await sock.sendMessage(groupId, { text: '⚠️ Masukkan nomor absen atau nama siswa!\nContoh: `/siswa detail 1` atau `/siswa detail Nasywa`' });
          return;
        }

        let student = null;
        const num = parseInt(query, 10);
        if (!isNaN(num)) {
          student = db.prepare('SELECT * FROM students WHERE group_id = ? AND student_number = ?').get(classGroupId, num);
        }
        if (!student) {
          student = db.prepare('SELECT * FROM students WHERE group_id = ? AND name LIKE ?').get(classGroupId, `%${query}%`);
        }

        if (!student) {
          await sock.sendMessage(groupId, { text: `⚠️ Siswa dengan nomor absen atau nama "${query}" tidak ditemukan di kelas ini.` });
          return;
        }

        const phoneDisplay = student.phone_number ? `@${student.phone_number.split('@')[0]}` : '-';
        const detailText = `*DETAIL BIODATA SISWA*\n` +
          `────────────────────────────\n` +
          '```\n' +
          `Absen  : ${student.student_number}\n` +
          `Nama   : ${student.name}\n` +
          `NIS    : ${student.nis || '-'}\n` +
          `TTL    : ${student.birth_info || '-'}\n` +
          `Alamat : ${student.address || '-'}\n` +
          '```\n' +
          `*Kontak:* ${phoneDisplay}\n` +
          `────────────────────────────`;

        await sock.sendMessage(groupId, {
          text: detailText,
          mentions: student.phone_number ? [student.phone_number] : []
        });
        return;
      }

      // 2.1.2.0.1 Data Orang Tua Siswa (/siswa ortu [no/nama])
      if (/^(ortu|orangtua|wali)(?:[\s\n]+|$)/i.test(args)) {
        const query = args.replace(/^(ortu|orangtua|wali)(?:[\s\n]+|$)/i, '').trim();
        await handleOrtuCommand(sock, groupId, classGroupId, query);
        return;
      }

      // 2.1.2.1 Tambah Siswa Tunggal (/siswa add)
      if (args.startsWith('add ') || /^add\n/i.test(args)) {
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin Kelas yang dapat menambah siswa.' });
          return;
        }

        const addText = args.replace(/^add[\s\n]+/i, '').trim();
        const contextInfo = extractContextInfo(msg);
        const mentionedJids = contextInfo?.mentionedJid || [];

        // Cek apakah format biodata lengkap (mengandung 'Nama :')
        if (/Nama\s*:/i.test(addText)) {
          const parsed = parseStudentBiodataBlocks(addText, mentionedJids);
          if (parsed.length === 0) {
            await sock.sendMessage(groupId, {
              text: `⚠️ Format biodata tidak terbaca!\nContoh format biodata:\n\`/siswa add 1\nNama : Nasywa Taqi Sasikirana\nOrtu : Bapak/Ibu\nNIS : 24697/1673.065\nTTL : Ponorogo, 13 Juli 2009\nAlamat : Jln. Raya Ngebel, Tumpuk\n@naswa RPL\``
            });
            return;
          }

          const s = parsed[0];
          db.prepare(`
            INSERT INTO students (group_id, student_number, name, phone_number, nis, birth_info, address, parent_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(group_id, student_number) DO UPDATE SET 
              name = excluded.name,
              phone_number = COALESCE(excluded.phone_number, students.phone_number),
              nis = COALESCE(excluded.nis, students.nis),
              birth_info = COALESCE(excluded.birth_info, students.birth_info),
              address = COALESCE(excluded.address, students.address),
              parent_name = COALESCE(excluded.parent_name, students.parent_name)
          `).run(classGroupId, s.student_number, s.name, s.phone_number, s.nis, s.birth_info, s.address, s.parent_name);

          let confirmMsg = `*Siswa Berhasil Disimpan!*\n` +
            `────────────────────────────\n` +
            '```\n' +
            `Absen  : ${s.student_number}\n` +
            `Nama   : ${s.name}\n` +
            `Ortu   : ${s.parent_name || '-'}\n` +
            `NIS    : ${s.nis || '-'}\n` +
            `TTL    : ${s.birth_info || '-'}\n` +
            `Alamat : ${s.address || '-'}\n` +
            '```\n' +
            `*Kontak:* ${s.phone_number ? `@${s.phone_number.split('@')[0]}` : '-'}\n` +
            `────────────────────────────`;
          await sock.sendMessage(groupId, {
            text: confirmMsg,
            mentions: s.phone_number ? [s.phone_number] : []
          });
          return;
        }

        // Format singkat satu baris: /siswa add [no_absen] [nama] [tag/nomor]
        const [noStr, ...restParts] = addText.split(/\s+/);
        const studentNum = parseInt(noStr, 10);
        const restText = restParts.join(' ').trim();

        if (isNaN(studentNum) || !restText) {
          await sock.sendMessage(groupId, {
            text: '⚠️ Format salah!\n\n*Format Singkat:*\n`/siswa add [no_absen] [nama] [tag/nomor]`\nContoh: `/siswa add 1 Budi Pratama @6281234567890`\n\n*Format Lengkap:*\n`/siswa add\n1.\nNama : Budi Pratama\nNIS : 12345\nTTL : Ponorogo, 1 Jan 2010\nAlamat : Jl. Melati\n@budi`'
          });
          return;
        }

        let targetPhone = null;
        let studentName = restText;

        const phoneMatch = restText.match(/@?((?:0|62)\d{8,15})(?:@s\.whatsapp\.net)?$/);
        if (phoneMatch) {
          let num = phoneMatch[1];
          if (num.startsWith('0')) num = '62' + num.slice(1);
          targetPhone = `${num}@s.whatsapp.net`;
          studentName = restText.replace(phoneMatch[0], '').trim();
        } else if (mentionedJids[0]) {
          targetPhone = mentionedJids[0].replace(/:.*@/, '@');
          const rawNum = targetPhone.split('@')[0];
          studentName = restText.replace(new RegExp(`@?${rawNum}`), '').trim();
        }

        if (!studentName) studentName = 'Siswa ' + studentNum;

        db.prepare(`
          INSERT INTO students (group_id, student_number, name, phone_number)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(group_id, student_number) DO UPDATE SET 
            name = excluded.name,
            phone_number = COALESCE(excluded.phone_number, students.phone_number)
        `).run(classGroupId, studentNum, studentName, targetPhone);

        let confirmMsg = `*Siswa Berhasil Disimpan!*\n` +
          `────────────────────────────\n` +
          '```\n' +
          `Absen  : ${studentNum}\n` +
          `Nama   : ${studentName}\n` +
          '```\n' +
          `*Kontak:* ${targetPhone ? `@${targetPhone.split('@')[0]}` : '-'}\n` +
          `────────────────────────────`;
        await sock.sendMessage(groupId, { text: confirmMsg, mentions: targetPhone ? [targetPhone] : [] });
        return;
      }

      // 2.1.2.2 Import Siswa Sekaligus (/siswa import)
      if (/^(import|bulk)(?:[\s\n]+|$)/i.test(args)) {
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin Kelas yang dapat mengimport siswa.' });
          return;
        }
        const bulkText = args.replace(/^(import|bulk)(?:[\s\n]+|$)/i, '').trim();
        const contextInfo = extractContextInfo(msg);
        const mentionedJids = contextInfo?.mentionedJid || [];
        let successCount = 0;

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

        // Pola A: Format Biodata Lengkap (mengandung 'Nama :')
        if (/Nama\s*:/i.test(bulkText)) {
          const parsedList = parseStudentBiodataBlocks(bulkText, mentionedJids);
          parsedList.forEach(s => {
            upsertStmt.run(classGroupId, s.student_number, s.name, s.phone_number, s.nis, s.birth_info, s.address, s.parent_name);
            successCount++;
          });
        } else {
          // Pola B: Format Daftar Baris Ringkas (1 baris per siswa)
          const lines = bulkText.split('\n');
          let mentionIndex = 0;

          lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // Pola 1: Nomor di depan (contoh: "1. Nasywa Taqi Sasikirana @naswa RPL")
            const frontMatch = trimmed.match(/^(\d+)[\s\.\,\-\)]+\s*(.+)$/);
            if (frontMatch) {
              const no = parseInt(frontMatch[1], 10);
              let fullRest = frontMatch[2].trim();
              let phone = null;
              let name = fullRest;

              const atIdx = fullRest.indexOf('@');
              if (atIdx !== -1) {
                name = fullRest.slice(0, atIdx).trim();
                const tagPart = fullRest.slice(atIdx).trim();
                const digitMatch = tagPart.match(/@?((?:0|62)\d{8,15})(?:@s\.whatsapp\.net)?/);
                if (digitMatch) {
                  let num = digitMatch[1];
                  if (num.startsWith('0')) num = '62' + num.slice(1);
                  phone = `${num}@s.whatsapp.net`;
                } else if (mentionIndex < mentionedJids.length) {
                  phone = mentionedJids[mentionIndex].replace(/:.*@/, '@');
                  mentionIndex++;
                }
              }

              if (!name) name = 'Siswa ' + no;
              if (!isNaN(no) && name) {
                upsertStmt.run(classGroupId, no, name, phone, null, null, null, null);
                successCount++;
                return;
              }
            }

            // Pola 2: Nomor di belakang
            const backMatch = trimmed.match(/^(.+?)[\s\.\,\-\(\[]+(\d+)[\)\]]?$/);
            if (backMatch) {
              let fullRest = backMatch[1].trim();
              const no = parseInt(backMatch[2], 10);
              let phone = null;
              let name = fullRest;

              const atIdx = fullRest.indexOf('@');
              if (atIdx !== -1) {
                name = fullRest.slice(0, atIdx).trim();
                const tagPart = fullRest.slice(atIdx).trim();
                const digitMatch = tagPart.match(/@?((?:0|62)\d{8,15})(?:@s\.whatsapp\.net)?/);
                if (digitMatch) {
                  let num = digitMatch[1];
                  if (num.startsWith('0')) num = '62' + num.slice(1);
                  phone = `${num}@s.whatsapp.net`;
                } else if (mentionIndex < mentionedJids.length) {
                  phone = mentionedJids[mentionIndex].replace(/:.*@/, '@');
                  mentionIndex++;
                }
              }

              if (!name) name = 'Siswa ' + no;
              if (!isNaN(no) && name) {
                upsertStmt.run(classGroupId, no, name, phone, null, null, null, null);
                successCount++;
                return;
              }
            }
          });
        }

        if (successCount === 0) {
          await sock.sendMessage(groupId, {
            text: `⚠️ Format daftar tidak terbaca!\n\n*Format Biodata Lengkap:*\n\`/siswa import\n1.\nNama : Nasywa Taqi\nNIS : 24697\nTTL : Ponorogo, 13 Juli 2009\nAlamat : Jln. Raya Ngebel\n@naswa\n\n2.\nNama : Natasya Amanda\n...\`\n\n*Format Ringkas:*\n\`/siswa import\n1. Aditya Pratama @6285746616454\n2. Citra Dewi @6281234567890\``
          });
          return;
        }

        await sock.sendMessage(groupId, {
          text: `✅ *Berhasil mengimport ${successCount} siswa sekaligus!* Ketik \`/siswa\` untuk melihat daftar lengkap atau \`/siswa detail [no]\` untuk rincian biodata.`
        });
        return;
      }

      if (args.startsWith('del ')) {
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin Kelas yang dapat menghapus siswa.' });
          return;
        }
        const studentNum = parseInt(args.replace('del ', '').trim(), 10);
        if (isNaN(studentNum)) {
          await sock.sendMessage(groupId, { text: '⚠️ Format salah!\nGunakan: `/siswa del [no_absen]`' });
          return;
        }
        db.prepare('DELETE FROM students WHERE group_id = ? AND student_number = ?').run(classGroupId, studentNum);
        await sock.sendMessage(groupId, { text: `🗑️ Siswa absen *${studentNum}* berhasil dihapus.` });
        return;
      }
    }

    // 2.2 Modul Jadwal
    if (cmd === '/jadwal') {
      const { addScheduleItem, deleteScheduleItem } = await import('./modules/schedule.js');
      const lowerArgs = (args || '').toLowerCase().trim();

      if (!args || lowerArgs === 'full') {
        const res = getScheduleFull(groupId);
        await sock.sendMessage(groupId, { text: res });
      } else if (lowerArgs === 'depan' || lowerArgs === 'minggu depan') {
        const res = getScheduleFull(groupId, 'depan');
        await sock.sendMessage(groupId, { text: res });
      } else if (lowerArgs === 'lalu' || lowerArgs === 'minggu lalu') {
        const res = getScheduleFull(groupId, 'lalu');
        await sock.sendMessage(groupId, { text: res });
      } else if (/^(?:minggu\s+)?\d+$/i.test(lowerArgs)) {
        const res = getScheduleFull(groupId, lowerArgs);
        await sock.sendMessage(groupId, { text: res });
      } else if (lowerArgs === 'hari ini' || lowerArgs === 'today') {
        const res = getScheduleToday(groupId);
        await sock.sendMessage(groupId, { text: res });
      } else if (lowerArgs === 'besok') {
        const res = getScheduleTomorrow(groupId);
        await sock.sendMessage(groupId, { text: res });
      } else if (lowerArgs === 'now') {
        const res = getScheduleNow(groupId);
        await sock.sendMessage(groupId, { text: res });
      } else if (args.startsWith('add ')) {
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin yang dapat menambah jadwal.' });
          return;
        }
        const res = addScheduleItem(groupId, args.replace('add ', '').trim());
        await sock.sendMessage(groupId, { text: res });
      } else if (args.startsWith('del ')) {
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin yang dapat menghapus jadwal.' });
          return;
        }
        const res = deleteScheduleItem(groupId, args.replace('del ', '').trim());
        await sock.sendMessage(groupId, { text: res });
      } else if (args.startsWith('edit ')) {
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin yang dapat mengedit jadwal.' });
          return;
        }
        const { editScheduleItem } = await import('./modules/schedule.js');
        const res = editScheduleItem(groupId, args.replace('edit ', '').trim());
        await sock.sendMessage(groupId, { text: res });
      } else if (args.startsWith('cari ')) {
        const teacher = args.replace('cari ', '').trim();
        const res = searchScheduleByTeacher(groupId, teacher);
        await sock.sendMessage(groupId, { text: res });
      } else {
        // Coba nama hari: senin, selasa, dll
        const res = getScheduleByDay(groupId, args);
        await sock.sendMessage(groupId, { text: res });
      }
      return;
    }

    // 2.2.1 Perintah Jam Pelajaran (/jam [hari])
    if (cmd === "/jam") {
      const { getLessonHours } = await import("./modules/schedule.js");
      const res = getLessonHours(groupId, args);
      await sock.sendMessage(groupId, { text: res });
      return;
    }

    // 2.3 Modul Kas Output & Pengaturan
    if (cmd === '/kas') {
      if (args.startsWith('set ')) {
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
        const { db } = await import('../database/schema.js');
        const classGroupId = resolveClassGroupId(groupId);
        const cleanJid = senderJid.replace(/:.*@/, '@');
        const isBendahara = !!db.prepare(`
          SELECT id FROM class_roles 
          WHERE group_id = ? AND (phone_number = ? OR phone_number = ?) AND role = 'BENDAHARA'
        `).get(classGroupId, cleanJid, senderJid);

        if (!isAdmin && !isBendahara) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Bendahara atau Admin Kelas yang dapat mengatur tarif kas.' });
          return;
        }

        const nominal = args.replace('set ', '').trim();
        const res = setWeeklyFee(groupId, nominal);
        await sock.sendMessage(groupId, { text: res });
        return;
      }

      // /kas list atau /kas all -> Rekap seluruh siswa
      if (args === 'list' || args === 'all' || args === 'rekap') {
        const res = getCashRecap(groupId);
        await sock.sendMessage(groupId, { text: res });
        return;
      }

      // /kas (tanpa argumen atau dengan nomor/nama siswa) -> Cek tagihan kas pribadi
      const res = getStudentCashBill(groupId, senderJid, args || null);
      await sock.sendMessage(groupId, { text: res });
      return;
    }

    // Perintah Laporan Keuangan Kelas (/keuangan & /saldo)
    if (cmd === '/keuangan' || cmd === '/saldo' || cmd === '.keuangan' || cmd === '.saldo') {
      const res = getFormattedFinanceReport(groupId);
      await sock.sendMessage(groupId, { text: res });
      return;
    }

    if (cmd === '/bendahara') {
      const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
      if (!args || args === 'list') {
        const res = getClassTreasurers(groupId);
        await sock.sendMessage(groupId, { text: res });
        return;
      }

      if (args.startsWith('set')) {
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin Kelas atau Ketua yang dapat mengatur Bendahara.' });
          return;
        }

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        let targetJid = contextInfo?.mentionedJid?.[0] || contextInfo?.participant;
        let targetName = '';

        if (!targetJid) {
          const rawArg = args.replace('set', '').trim();
          const matchNum = rawArg.match(/(?:0|62)\d{8,15}/);
          if (matchNum) {
            let num = matchNum[0];
            if (num.startsWith('0')) num = '62' + num.slice(1);
            targetJid = num + '@s.whatsapp.net';
            targetName = rawArg.replace(matchNum[0], '').trim();
          }
        }

        if (!targetJid) {
          await sock.sendMessage(groupId, {
            text: '⚠️ Tentukan nomor bendahara!\nContoh:\n• `/bendahara set @nama` (tag orangnya)\n• Reply pesan bendahara dengan `/bendahara set`\n• `/bendahara set 081234567890 [Nama]`'
          });
          return;
        }

        const res = setClassTreasurer(groupId, targetJid, targetName);
        await sock.sendMessage(groupId, { text: res, mentions: [targetJid] });
        return;
      }

      if (args.startsWith('del') || args.startsWith('remove')) {
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin Kelas atau Ketua yang dapat menghapus Bendahara.' });
          return;
        }

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        let targetJid = contextInfo?.mentionedJid?.[0] || contextInfo?.participant;
        if (!targetJid) {
          const rawArg = args.replace(/^(del|remove)/, '').trim();
          const matchNum = rawArg.match(/(?:0|62)\d{8,15}/);
          if (matchNum) {
            let num = matchNum[0];
            if (num.startsWith('0')) num = '62' + num.slice(1);
            targetJid = num + '@s.whatsapp.net';
          }
        }

        if (!targetJid) {
          await sock.sendMessage(groupId, { text: '⚠️ Tentukan nomor bendahara yang akan dihapus via tag atau reply.' });
          return;
        }

        const res = removeClassTreasurer(groupId, targetJid);
        await sock.sendMessage(groupId, { text: res, mentions: [targetJid] });
        return;
      }
      return;
    }

    // 2.4 Modul Tugas & PR
    if (cmd === '/pr') {
      if (!args) {
        const res = getActiveAssignments(groupId);
        await sock.sendMessage(groupId, { text: res });
      } else if (args === 'all') {
        const res = getAllAssignments(groupId);
        await sock.sendMessage(groupId, { text: res });
      } else if (args.startsWith('detail ')) {
        const id = args.replace('detail ', '').trim();
        const res = getAssignmentDetail(groupId, id);
        if (res.imagePath) {
          const fs = await import('fs');
          const imgBuffer = fs.readFileSync(res.imagePath);
          await sock.sendMessage(groupId, {
            image: imgBuffer,
            caption: res.text
          }, { quoted: msg });
        } else {
          await sock.sendMessage(groupId, { text: res.text }, { quoted: msg });
        }
      } else if (args.startsWith('add ')) {
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin (Ketua / Sekretaris / Developer) yang dapat menambah PR.' });
          return;
        }
        const addArgs = args.replace('add ', '').trim();
        const senderName = msg.pushName || senderJid.split('@')[0];

        // Cek apakah ada lampiran gambar pada pesan langsung atau quoted reply
        let imageBuffer = null;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isDirectImage = !!msg.message?.imageMessage;
        const isQuotedImage = !!quoted?.imageMessage;

        if (isDirectImage) {
          try {
            imageBuffer = await downloadMediaMessage(msg, 'buffer', {});
          } catch (e) {
            console.error('Gagal download direct image PR:', e.message);
          }
        } else if (isQuotedImage) {
          try {
            imageBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
          } catch (e) {
            console.error('Gagal download quoted image PR:', e.message);
          }
        }

        const res = addAssignment(groupId, addArgs, senderName, imageBuffer);
        await sock.sendMessage(groupId, { text: res });
      } else if (args.startsWith('done ')) {
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin yang dapat menandai tugas selesai.' });
          return;
        }
        const id = args.replace('done ', '').trim();
        const res = completeAssignment(groupId, id);
        await sock.sendMessage(groupId, { text: res });
      } else if (args.startsWith('del ')) {
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin yang dapat menghapus tugas.' });
          return;
        }
        const id = args.replace('del ', '').trim();
        const res = deleteAssignment(groupId, id);
        await sock.sendMessage(groupId, { text: res });
      }
      return;
    }

    // 2.5 Modul Utilitas Admin
    if (cmd === '/tagall') {
      const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
      if (!isAdmin) {
        await sock.sendMessage(groupId, { text: '⚠️ Perintah ini khusus untuk Admin Kelas.' });
        return;
      }
      const groupMeta = await sock.groupMetadata(groupId);
      await handleTagAll(sock, groupId, groupMeta, args);
      return;
    }

    if (cmd === '/hidetag') {
      const isAdmin = isClassAdmin(groupId, senderJid, devNumber);
      if (!isAdmin) {
        await sock.sendMessage(groupId, { text: '⚠️ Perintah ini khusus untuk Admin Kelas.' });
        return;
      }
      const groupMeta = await sock.groupMetadata(groupId);
      await handleHideTag(sock, groupId, groupMeta, args);
      return;
    }

    if (cmd === '/struktur') {
      if (!args) {
        const res = getOrganizationStructure(groupId);
        const text = typeof res === 'object' ? res.text : res;
        const mentions = typeof res === 'object' ? res.mentions : [];
        await sock.sendMessage(groupId, { text, ...(mentions.length ? { mentions } : {}) });
      } else if (args.startsWith('set ')) {
        let isWaAdmin = false;
        try {
          const groupMeta = await sock.groupMetadata(groupId);
          isWaAdmin = isWhatsAppAdmin(groupMeta, senderJid);
        } catch {}
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber) || isWaAdmin;
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin Kelas atau Admin Grup WhatsApp yang dapat mengatur struktur pengurus.' });
          return;
        }
        const setArgs = args.replace('set ', '').trim();
        const contextInfo = extractContextInfo(msg);
        const mentionedJids = contextInfo?.mentionedJid || [];
        const res = setOrganizationPosition(groupId, setArgs, mentionedJids);

        const text = typeof res === 'object' ? res.text : res;
        const mentions = typeof res === 'object' ? res.mentions : [];
        await sock.sendMessage(groupId, { text, ...(mentions.length ? { mentions } : {}) });
      } else if (args.startsWith('del ')) {
        let isWaAdmin = false;
        try {
          const groupMeta = await sock.groupMetadata(groupId);
          isWaAdmin = isWhatsAppAdmin(groupMeta, senderJid);
        } catch {}
        const isAdmin = isClassAdmin(groupId, senderJid, devNumber) || isWaAdmin;
        if (!isAdmin) {
          await sock.sendMessage(groupId, { text: '⚠️ Hanya Admin Kelas atau Admin Grup WhatsApp yang dapat menghapus struktur pengurus.' });
          return;
        }
        const delPos = args.replace('del ', '').trim();
        const res = deleteOrganizationPosition(groupId, delPos);
        await sock.sendMessage(groupId, { text: res });
      }
      return;
    }

    if (cmd === '/remind') {
      const res = handleRemind(sock, groupId, args);
      await sock.sendMessage(groupId, { text: res });
      return;
    }

    // 2.6 Modul Media
    if (cmd === '/calc') {
      const res = calculateMath(args);
      await sock.sendMessage(groupId, { text: res });
      return;
    }

    if (cmd === '/s' || cmd === '/sticker') {
      const media = detectMediaMessage(msg);
      if (!media || (media.type !== 'image' && media.type !== 'video')) {
        await sock.sendMessage(groupId, { text: 'Balas (*reply*) atau sertakan foto/video pendek untuk dijadikan stiker.' });
        return;
      }

      const limitCheck = checkStickerRateLimit(groupId);
      if (!limitCheck.allowed) {
        await sock.sendMessage(groupId, { text: limitCheck.message }, { quoted: msg });
        return;
      }

      const usageId = recordStickerUsage(groupId, senderJid, cmd);
      try {
        const mediaBuf = await downloadMediaMessage(media.target, 'buffer', {});
        const stickerBuf = await convertToSticker(mediaBuf, media.isVideo);
        await sock.sendMessage(groupId, { sticker: stickerBuf }, { quoted: msg });
      } catch (err) {
        removeStickerUsageById(usageId);
        await sock.sendMessage(groupId, { text: `Gagal membuat stiker: ${err.message}` });
      }
      return;
    }

    if (cmd === '/toimg') {
      const media = detectMediaMessage(msg);
      if (!media || media.type !== 'sticker') {
        await sock.sendMessage(groupId, { text: 'Balas (*reply*) sebuah stiker dengan perintah `/toimg`.' });
        return;
      }
      try {
        const stickerBuf = await downloadMediaMessage(media.target, 'buffer', {});
        const imgBuf = await convertStickerToImage(stickerBuf);
        await sock.sendMessage(groupId, { image: imgBuf, caption: 'Stiker berhasil dikonversi ke gambar.' }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(groupId, { text: `Gagal konversi stiker: ${err.message}` });
      }
      return;
    }

    if (cmd === '/togif') {
      const media = detectMediaMessage(msg);
      if (!media || media.type !== 'sticker') {
        await sock.sendMessage(groupId, { text: 'Balas (*reply*) stiker animasi/bergerak dengan perintah `/togif`.' });
        return;
      }
      try {
        const stickerBuf = await downloadMediaMessage(media.target, 'buffer', {});
        const gifBuf = await convertStickerToGif(stickerBuf);
        await sock.sendMessage(groupId, {
          video: gifBuf,
          gifPlayback: true,
          caption: 'Stiker berhasil dikonversi ke GIF/video.'
        }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(groupId, { text: `Gagal konversi stiker ke GIF: ${err.message}` });
      }
      return;
    }

    if (cmd === '/brat') {
      let bratText = args.trim();
      if (!bratText) {
        const contextInfo = extractContextInfo(msg);
        const quoted = contextInfo?.quotedMessage;
        const qm = normalizeMessageContent(quoted);
        bratText = (qm?.conversation || qm?.extendedTextMessage?.text || '').trim();
      }
      if (!bratText) {
        await sock.sendMessage(groupId, { text: 'Masukkan teks untuk stiker brat. Contoh: `/brat aku sayang kamu`' });
        return;
      }

      const limitCheck = checkStickerRateLimit(groupId);
      if (!limitCheck.allowed) {
        await sock.sendMessage(groupId, { text: limitCheck.message }, { quoted: msg });
        return;
      }

      const usageId = recordStickerUsage(groupId, senderJid, cmd);
      try {
        const stickerBuf = await generateBratImage(bratText);
        await sock.sendMessage(groupId, { sticker: stickerBuf }, { quoted: msg });
      } catch (err) {
        removeStickerUsageById(usageId);
        await sock.sendMessage(groupId, { text: `Gagal membuat stiker brat: ${err.message}` });
      }
      return;
    }

    if (cmd === '/bratvid') {
      let bratText = args.trim();
      if (!bratText) {
        const contextInfo = extractContextInfo(msg);
        const quoted = contextInfo?.quotedMessage;
        const qm = normalizeMessageContent(quoted);
        bratText = (qm?.conversation || qm?.extendedTextMessage?.text || '').trim();
      }
      if (!bratText) {
        await sock.sendMessage(groupId, { text: 'Masukkan teks untuk stiker bratvid. Contoh: `/bratvid aku sayang kamu`' });
        return;
      }

      const limitCheck = checkStickerRateLimit(groupId);
      if (!limitCheck.allowed) {
        await sock.sendMessage(groupId, { text: limitCheck.message }, { quoted: msg });
        return;
      }

      const usageId = recordStickerUsage(groupId, senderJid, cmd);
      try {
        const stickerBuf = await generateBratVideo(bratText);
        await sock.sendMessage(groupId, { sticker: stickerBuf }, { quoted: msg });
      } catch (err) {
        removeStickerUsageById(usageId);
        await sock.sendMessage(groupId, { text: `Gagal membuat stiker bratvid: ${err.message}` });
      }
      return;
    }

    if (cmd === '/smeme') {
      const media = detectMediaMessage(msg);
      if (!media || media.type !== 'image') {
        await sock.sendMessage(groupId, { text: 'Balas (*reply*) foto atau sertakan foto dengan perintah `/smeme [teks]` atau `/smeme [atas] | [bawah]`.' });
        return;
      }

      const limitCheck = checkStickerRateLimit(groupId);
      if (!limitCheck.allowed) {
        await sock.sendMessage(groupId, { text: limitCheck.message }, { quoted: msg });
        return;
      }

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

      const usageId = recordStickerUsage(groupId, senderJid, cmd);
      try {
        const imgBuf = await downloadMediaMessage(media.target, 'buffer', {});
        const stickerBuf = await generateStickerMeme(imgBuf, topText, bottomText);
        await sock.sendMessage(groupId, { sticker: stickerBuf }, { quoted: msg });
      } catch (err) {
        removeStickerUsageById(usageId);
        await sock.sendMessage(groupId, { text: `Gagal membuat stiker meme: ${err.message}` });
      }
      return;
    }

    if (cmd === '/emojimix') {
      let raw = args.trim();
      let e1 = '';
      let e2 = '';

      if (raw.includes('+')) {
        const parts = raw.split('+');
        e1 = parts[0].trim();
        e2 = parts.slice(1).join('+').trim();
      } else if (raw.includes(' ')) {
        const parts = raw.split(/\s+/);
        e1 = parts[0].trim();
        e2 = parts.slice(1).join(' ').trim();
      } else {
        const emojiChars = Array.from(raw);
        if (emojiChars.length >= 2) {
          e1 = emojiChars[0];
          e2 = emojiChars.slice(1).join('');
        }
      }

      if (!e1 || !e2) {
        await sock.sendMessage(groupId, { text: 'Masukkan dua emoji untuk digabungkan. Contoh: `/emojimix 😂+🥰` atau `/emojimix 😭 💀`' });
        return;
      }

      const limitCheck = checkStickerRateLimit(groupId);
      if (!limitCheck.allowed) {
        await sock.sendMessage(groupId, { text: limitCheck.message }, { quoted: msg });
        return;
      }

      const usageId = recordStickerUsage(groupId, senderJid, cmd);
      try {
        const stickerBuf = await generateEmojiMix(e1, e2);
        await sock.sendMessage(groupId, { sticker: stickerBuf }, { quoted: msg });
      } catch (err) {
        removeStickerUsageById(usageId);
        await sock.sendMessage(groupId, { text: `Gagal menggabungkan emoji: ${err.message}` });
      }
      return;
    }

    if (cmd === '/qc') {
      const contextInfo = extractContextInfo(msg);
      const quoted = contextInfo?.quotedMessage;
      const qm = normalizeMessageContent(quoted);

      let textToQuote = '';
      let targetJid = senderJid;
      let targetName = msg.pushName || 'Pengguna';

      if (qm) {
        textToQuote = (qm.conversation || qm.extendedTextMessage?.text || qm.imageMessage?.caption || qm.videoMessage?.caption || '').trim();
        if (contextInfo?.participant) {
          targetJid = contextInfo.participant;
        }
      }

      if (!textToQuote) {
        textToQuote = args.trim();
      }

      if (!textToQuote) {
        await sock.sendMessage(groupId, { text: 'Balas pesan seseorang dengan `/qc` atau ketik `/qc [teks]` untuk membuat stiker quote.' });
        return;
      }

      const limitCheck = checkStickerRateLimit(groupId);
      if (!limitCheck.allowed) {
        await sock.sendMessage(groupId, { text: limitCheck.message }, { quoted: msg });
        return;
      }

      let avatarUrl = null;
      try {
        avatarUrl = await sock.profilePictureUrl(targetJid, 'image');
      } catch {}

      const usageId = recordStickerUsage(groupId, senderJid, cmd);
      try {
        const stickerBuf = await generateQuoteChat(textToQuote, targetName, avatarUrl);
        await sock.sendMessage(groupId, { sticker: stickerBuf }, { quoted: msg });
      } catch (err) {
        removeStickerUsageById(usageId);
        await sock.sendMessage(groupId, { text: `Gagal membuat stiker QC: ${err.message}` });
      }
      return;
    }

    if (cmd === '/ocr') {
      const media = detectAttachedOrQuotedMedia(msg);
      if (!media || (media.type !== 'image' && !media.mimetype.startsWith('image/'))) {
        await sock.sendMessage(groupId, { text: '⚠️ Balas (*reply*) atau sertakan foto dokumen/catatan/papan tulis dengan perintah `/ocr`.' });
        return;
      }
      const waitMsg = await sock.sendMessage(groupId, { text: '⏳ Sedang membaca dan mentranskripsikan tulisan via AI Vision...' });
      try {
        const imgBuf = await downloadMediaMessage(media.target, 'buffer', {});
        const ocrResult = await performOcr(imgBuf);
        try {
          // Edit pesan 'sedang memproses' menjadi hasil agar pesan tunggu langsung berganti
          await sock.sendMessage(groupId, { text: ocrResult, edit: waitMsg.key });
        } catch {
          // Fallback: hapus pesan tunggu lalu kirim hasil baru
          try { await sock.sendMessage(groupId, { delete: waitMsg.key }); } catch {}
          await sock.sendMessage(groupId, { text: ocrResult }, { quoted: msg });
        }
      } catch (err) {
        try {
          await sock.sendMessage(groupId, { text: `⚠️ Gagal OCR: ${err.message}`, edit: waitMsg.key });
        } catch {
          await sock.sendMessage(groupId, { text: `⚠️ Gagal OCR: ${err.message}` });
        }
      }
      return;
    }

    if (cmd === '/topdf') {
      const media = detectMediaMessage(msg);
      if (!media || media.type !== 'image') {
        await sock.sendMessage(groupId, { text: 'Balas (*reply*) atau sertakan foto dokumen dengan perintah `/topdf`.' });
        return;
      }
      try {
        const imgBuf = await downloadMediaMessage(media.target, 'buffer', {});
        const pdfBuf = await createPdfFromImages([imgBuf]);
        await sock.sendMessage(groupId, {
          document: pdfBuf,
          mimetype: 'application/pdf',
          fileName: `Dokumen_${Date.now()}.pdf`,
          caption: 'Berkas PDF berhasil dibuat.'
        }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(groupId, { text: `Gagal membuat PDF: ${err.message}` });
      }
      return;
    }

    // 2.7 Modul Utilitas Rahasia (/rvo)
    if (cmd === '/rvo') {
      const err = await handleReadViewOnce(sock, msg, groupId);
      if (err) {
        await sock.sendMessage(groupId, { text: err });
      }
      return;
    }

    // 2.7.1 Modul Data Orang Tua Siswa (/ortu [no/nama]) - Perintah Rahasia / Tidak Tercantum di Menu
    if (cmd === '/ortu') {
      const classGroupId = resolveClassGroupId(groupId);
      await handleOrtuCommand(sock, groupId, classGroupId, args.trim());
      return;
    }

    // Alias /detail [no/nama] -> Detail Biodata Siswa
    if (cmd === '/detail') {
      const { db } = await import('../database/schema.js');
      const classGroupId = resolveClassGroupId(groupId);
      const query = args.trim();
      if (!query) {
        await sock.sendMessage(groupId, { text: '⚠️ Masukkan nomor absen atau nama siswa!\nContoh: `/detail 1` atau `/detail Nasywa`' });
        return;
      }
      let student = null;
      const num = parseInt(query, 10);
      if (!isNaN(num)) {
        student = db.prepare('SELECT * FROM students WHERE group_id = ? AND student_number = ?').get(classGroupId, num);
      }
      if (!student) {
        student = db.prepare('SELECT * FROM students WHERE group_id = ? AND name LIKE ?').get(classGroupId, `%${query}%`);
      }
      if (!student) {
        await sock.sendMessage(groupId, { text: `⚠️ Siswa dengan nomor absen atau nama "${query}" tidak ditemukan di kelas ini.` });
        return;
      }
      const phoneDisplay = student.phone_number ? `@${student.phone_number.split('@')[0]}` : '-';
      const detailText = `*DETAIL BIODATA SISWA*\n` +
        `────────────────────────────\n` +
        '```\n' +
        `Absen  : ${student.student_number}\n` +
        `Nama   : ${student.name}\n` +
        `NIS    : ${student.nis || '-'}\n` +
        `TTL    : ${student.birth_info || '-'}\n` +
        `Alamat : ${student.address || '-'}\n` +
        '```\n' +
        `*Kontak:* ${phoneDisplay}\n` +
        `────────────────────────────`;
      await sock.sendMessage(groupId, {
        text: detailText,
        mentions: student.phone_number ? [student.phone_number] : []
      });
      return;
    }

    // 2.8 Modul Asisten AI (/ai, /tanya)
    if (cmd === '/ai' || cmd === '/tanya') {
      const cleanPrompt = args.trim();
      const media = detectAttachedOrQuotedMedia(msg);
      let docData = null;

      if (media) {
        try {
          await sock.sendPresenceUpdate('composing', groupId);
          const mediaBuf = await downloadMediaMessage(media.target, 'buffer', {});
          const extracted = await extractTextFromDocument(mediaBuf, media.fileName, media.mimetype);
          if (extracted) {
            docData = { fileName: media.fileName, text: extracted };
          }
        } catch (err) {
          console.error('Gagal mengekstrak dokumen grup untuk AI:', err.message);
        }
      }

      const quotedText = extractQuotedText(msg);

      if (!cleanPrompt && !docData && !quotedText) {
        await sock.sendMessage(groupId, { text: 'Halo! Silakan masukkan pertanyaan setelah perintah.\nContoh: `/ai apa itu normalisasi database?` atau kirim bersama dokumen/foto tugas.' });
        return;
      }

      try {
        await sock.sendPresenceUpdate('composing', groupId);
      } catch {}
      const aiReply = await askAiAssistant(cleanPrompt, docData, quotedText);
      await sock.sendMessage(groupId, { text: aiReply }, { quoted: msg });
      return;
    }

    return;
  }

  // ==========================================
  // Kasus B: Pesan Yang Ngetag Akun Bot (Official WhatsApp Mention)
  // ==========================================
  const contextInfo = extractContextInfo(msg);
  const mentionedJids = contextInfo?.mentionedJid || [];

  // Pemicu AI di grup HANYA jika akun bot di-tag resmi (atau via command /ai di atas).
  // Swipe reply berfungsi sebagai sumber data/rujukan (seperti reply dokumen/teks).
  const isBotMentioned = mentionedJids.length > 0 && mentionedJids.some(j => isBotJid(j, sock));

  if (isBotMentioned) {
    const botName = sock?.user?.name || 'Kastor AI';
    const cleanPrompt = cleanAiPrompt(text, botName);
    const quotedText = extractQuotedText(msg);
    const media = detectAttachedOrQuotedMedia(msg);
    let docData = null;

    if (media) {
      try {
        await sock.sendPresenceUpdate('composing', groupId);
        const mediaBuf = await downloadMediaMessage(media.target, 'buffer', {});
        const extracted = await extractTextFromDocument(mediaBuf, media.fileName, media.mimetype);
        if (extracted) {
          docData = { fileName: media.fileName, text: extracted };
        }
      } catch (err) {
        console.error('Gagal mengekstrak dokumen mention untuk AI:', err.message);
      }
    }

    if (!cleanPrompt && !docData && !quotedText) {
      await sock.sendMessage(groupId, { text: 'Halo! Ada yang bisa saya bantu seputar pelajaran atau tugas hari ini?' });
      return;
    }

    try {
      await sock.sendPresenceUpdate('composing', groupId);
    } catch {}
    const aiReply = await askAiAssistant(cleanPrompt, docData, quotedText);
    await sock.sendMessage(groupId, { text: aiReply }, { quoted: msg });
    return;
  }
}
