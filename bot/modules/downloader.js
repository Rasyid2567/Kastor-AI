import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Regex deteksi platform media sosial
 */
export const TIKTOK_REGEX = /https?:\/\/(?:(?:www|v[tm]|m)\.)?tiktok\.com\/[^\s<>"]+/i;
export const YOUTUBE_REGEX = /https?:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/(?:watch\?(?:[^\s<>"]*&)?v=[a-zA-Z0-9_-]+|shorts\/[a-zA-Z0-9_-]+|live\/[a-zA-Z0-9_-]+|embed\/[a-zA-Z0-9_-]+|v\/[a-zA-Z0-9_-]+)|youtu\.be\/[a-zA-Z0-9_-]+)[^\s<>"]*/i;
export const INSTAGRAM_REGEX = /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv|stories\/[a-zA-Z0-9._-]+)\/[a-zA-Z0-9_-]+[^\s<>"]*/i;
export const FACEBOOK_REGEX = /https?:\/\/(?:(?:www|web|m)\.)?(?:facebook\.com\/(?:watch\/?\?(?:[^\s<>"]*v=\d+|v=\d+)|reel\/\d+|share\/[vr]\/[a-zA-Z0-9_-]+|[^/\s]+\/videos\/\d+)|fb\.watch\/[a-zA-Z0-9_-]+)[^\s<>"]*/i;
export const GENERAL_URL_REGEX = /https?:\/\/[^\s<>"]+/i;

/**
 * Mencari path executable yt-dlp pada sistem
 */
export function findYtDlpBinary() {
  const candidates = [
    path.join(process.cwd(), 'bin', 'yt-dlp'),
    path.join(os.homedir(), '.local', 'bin', 'yt-dlp'),
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    'yt-dlp'
  ];

  for (const candidate of candidates) {
    if (candidate === 'yt-dlp') {
      return 'yt-dlp'; // Fallback to PATH resolution
    }
    try {
      if (fs.existsSync(candidate)) {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      }
    } catch {}
  }

  return 'yt-dlp';
}

/**
 * Mengekstrak URL dari argumen perintah atau pesan yang di-reply (quoted message)
 */
export function extractUrl(args = '', quotedText = '') {
  const textToCheck = `${args || ''} ${quotedText || ''}`.trim();
  const match = textToCheck.match(GENERAL_URL_REGEX);
  return match ? match[0] : null;
}

/**
 * Mendeteksi platform dari URL
 */
export function detectPlatform(url = '') {
  if (!url) return 'unknown';
  if (TIKTOK_REGEX.test(url)) return 'tiktok';
  if (YOUTUBE_REGEX.test(url)) return 'youtube';
  if (INSTAGRAM_REGEX.test(url)) return 'instagram';
  if (FACEBOOK_REGEX.test(url)) return 'facebook';
  return 'unknown';
}

/**
 * Format durasi detik ke format teks (misal: 01:25 atau 45 detik)
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '-';
  const sec = Math.floor(Number(seconds));
  if (sec < 60) return `${sec} detik`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Format bytes ke MB / KB
 */
export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '-';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

/**
 * Unduh TikTok menggunakan TikWM API (Utama)
 */
export async function downloadTikTokTikWM(url) {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`TikWM API HTTP error: ${res.status}`);
    }

    const data = await res.json();
    if (data.code !== 0 || !data.data) {
      throw new Error(data.msg || 'Gagal memproses link TikTok');
    }

    const videoUrl = data.data.hdplay || data.data.play;
    if (!videoUrl) {
      throw new Error('URL video tidak ditemukan pada respon TikWM');
    }

    // Unduh stream buffer video
    const videoRes = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tiktok.com/'
      }
    });

    if (!videoRes.ok) {
      throw new Error(`Gagal mengunduh file video dari TikWM: ${videoRes.status}`);
    }

    const arrayBuf = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    return {
      buffer,
      title: data.data.title || 'TikTok Video',
      author: data.data.author?.nickname || data.data.author?.unique_id || 'TikTok User',
      duration: data.data.duration || 0,
      size: buffer.length
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Unduh video menggunakan yt-dlp (untuk YouTube, Instagram, Facebook, dan fallback TikTok)
 */
export async function downloadViaYtDlp(url, options = {}) {
  const binary = findYtDlpBinary();
  const tempPrefix = path.join(os.tmpdir(), `kastor-dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const outputTemplate = `${tempPrefix}.%(ext)s`;

  // Format: Utamakan MP4 720p atau di bawahnya agar cepat & hemat memori WA
  const formatArg = options.format || 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[ext=mp4]/best';
  const maxFilesize = options.maxFilesize || '75M';

  const args = [
    '--no-playlist',
    '--no-warnings',
    '--max-filesize', maxFilesize,
    '-f', formatArg,
    '--merge-output-format', 'mp4',
    '--print-json',
    '-o', outputTemplate,
    url
  ];

  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';

    const proc = spawn(binary, args, { timeout: 60000 });

    proc.stdout.on('data', (d) => {
      stdoutData += d.toString();
    });

    proc.stderr.on('data', (d) => {
      stderrData += d.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`Gagal menjalankan engine yt-dlp: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // Bersihkan jika ada file tersisa
        try {
          const files = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith(path.basename(tempPrefix)));
          for (const f of files) fs.unlinkSync(path.join(os.tmpdir(), f));
        } catch {}

        if (stderrData.includes('File is larger than max-filesize')) {
          return reject(new Error('Ukuran video melebihi batas maksimal WhatsApp (75 MB).'));
        }
        return reject(new Error(stderrData.trim() || `Proses unduh gagal dengan kode exit ${code}`));
      }

      try {
        let meta = {};
        try {
          const lines = stdoutData.trim().split('\n');
          // JSON metadata biasanya di baris output yt-dlp
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().startsWith('{') && lines[i].trim().endsWith('}')) {
              meta = JSON.parse(lines[i].trim());
              break;
            }
          }
        } catch {}

        // Cari file hasil unduhan yang berawalan tempPrefix
        const baseName = path.basename(tempPrefix);
        const matchedFiles = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith(baseName));
        if (matchedFiles.length === 0) {
          return reject(new Error('File hasil unduhan tidak ditemukan di disk.'));
        }

        const downloadedFilePath = path.join(os.tmpdir(), matchedFiles[0]);
        const fileStat = fs.statSync(downloadedFilePath);
        const buffer = fs.readFileSync(downloadedFilePath);

        // Hapus file dari temp setelah dibaca ke buffer
        try {
          fs.unlinkSync(downloadedFilePath);
        } catch {}

        resolve({
          buffer,
          title: meta.title || path.basename(url),
          author: meta.uploader || meta.channel || meta.uploader_id || '-',
          duration: meta.duration || 0,
          size: fileStat.size
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Peta teks dan bantuan per command
 */
export const PLATFORM_INFO = {
  '/tt': {
    name: 'TikTok',
    sample: 'https://vt.tiktok.com/ZSxxxx/',
    guide: 'Ketik `/tt [link tiktok]` atau balas (*reply*) pesan yang berisi link TikTok dengan `/tt`.'
  },
  '/yt': {
    name: 'YouTube',
    sample: 'https://youtu.be/xxxx atau https://youtube.com/shorts/xxxx',
    guide: 'Ketik `/yt [link youtube]` atau balas (*reply*) pesan yang berisi link YouTube dengan `/yt`.'
  },
  '/ig': {
    name: 'Instagram',
    sample: 'https://www.instagram.com/reel/xxxx/',
    guide: 'Ketik `/ig [link instagram]` atau balas (*reply*) pesan yang berisi link Instagram dengan `/ig`.'
  },
  '/fb': {
    name: 'Facebook',
    sample: 'https://fb.watch/xxxx/ atau https://facebook.com/reel/xxxx',
    guide: 'Ketik `/fb [link facebook]` atau balas (*reply*) pesan yang berisi link Facebook dengan `/fb`.'
  }
};

// Track download aktif untuk mencegah spam multi-unduh berlebihan per chat
const activeDownloads = new Set();

/**
 * Mengirim reaksi emoji ke pesan secara aman (tanpa melempar error)
 */
export async function safeReact(sock, remoteJid, key, emoji) {
  if (!sock || !key) return;
  try {
    await sock.sendMessage(remoteJid, {
      react: {
        text: emoji,
        key: key
      }
    });
  } catch (err) {
    console.warn(`Gagal mengirim reaction "${emoji}":`, err.message);
  }
}

/**
 * Handler utama untuk perintah /tt, /yt, /ig, /fb
 */
export async function handleDownloadCommand(sock, msg, cmd, args, remoteJid, quotedText = '') {
  const normCmd = cmd.toLowerCase();
  const info = PLATFORM_INFO[normCmd] || { name: 'Media', sample: 'https://...', guide: 'Ketik command disertai tautan.' };

  const url = extractUrl(args, quotedText);

  // Jika tidak ada URL
  if (!url) {
    await sock.sendMessage(remoteJid, {
      text: `ℹ️ *PANDUAN DOWNLOAD ${info.name.toUpperCase()}*\n\n` +
        `• ${info.guide}\n` +
        `• *Contoh:* \`${normCmd} ${info.sample}\``
    }, { quoted: msg });
    return;
  }

  // Cek apakah chat sedang memproses unduhan lain
  const lockKey = `${remoteJid}:${normCmd}`;
  if (activeDownloads.has(lockKey)) {
    await safeReact(sock, remoteJid, msg.key, '⏳');
    await sock.sendMessage(remoteJid, {
      text: `⏳ Sedang ada proses unduhan ${info.name} yang sedang berjalan di chat ini. Mohon tunggu sejenak.`
    }, { quoted: msg });
    return;
  }

  activeDownloads.add(lockKey);

  // Berikan reaksi jam pasir ⏳ pada pesan pengguna sebagai tanda proses dimulai
  await safeReact(sock, remoteJid, msg.key, '⏳');

  try {
    let result = null;

    if (normCmd === '/tt') {
      // 1. Coba TikWM API (Cepat & No Watermark)
      try {
        result = await downloadTikTokTikWM(url);
      } catch (err) {
        console.warn('TikWM API gagal, mencoba fallback ke yt-dlp:', err.message);
        result = await downloadViaYtDlp(url);
      }
    } else {
      // 2. YouTube, Instagram, Facebook via yt-dlp
      result = await downloadViaYtDlp(url);
    }

    if (!result || !result.buffer || result.buffer.length === 0) {
      throw new Error('Hasil unduhan kosong atau tidak valid.');
    }

    const caption = `🎥 *${info.name.toUpperCase()} DOWNLOADER*\n` +
      `────────────────────────────\n` +
      `📝 *Judul:* ${result.title}\n` +
      `👤 *Kreator:* ${result.author}\n` +
      `⏱️ *Durasi:* ${formatDuration(result.duration)}\n` +
      `💾 *Ukuran:* ${formatBytes(result.size)}\n` +
      `────────────────────────────\n` +
      `_Diunduh via Kastor AI_`;

    const MAX_DIRECT_VIDEO_SIZE = 64 * 1024 * 1024; // 64 MB
    const MAX_DOC_SIZE = 100 * 1024 * 1024; // 100 MB

    if (result.size <= MAX_DIRECT_VIDEO_SIZE) {
      // Kirim sebagai video inline WA
      await sock.sendMessage(remoteJid, {
        video: result.buffer,
        caption,
        mimetype: 'video/mp4'
      }, { quoted: msg });
    } else if (result.size <= MAX_DOC_SIZE) {
      // Kirim sebagai dokumen file MP4 jika ukuran 65MB - 100MB
      const safeTitle = (result.title || 'video').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 50);
      await sock.sendMessage(remoteJid, {
        document: result.buffer,
        mimetype: 'video/mp4',
        fileName: `${safeTitle}.mp4`,
        caption: `${caption}\n\n⚠️ _Ukuran video > 64MB, dikirim sebagai dokumen agar tidak terpotong._`
      }, { quoted: msg });
    } else {
      throw new Error(`Ukuran video (${formatBytes(result.size)}) melebihi batas pengiriman WhatsApp (100 MB).`);
    }

    // Perbarui reaksi menjadi centang hijau ✅ sebagai tanda unduhan selesai & terkirim
    await safeReact(sock, remoteJid, msg.key, '✅');
  } catch (err) {
    // Perbarui reaksi menjadi silang merah ❌ sebagai tanda unduhan gagal
    await safeReact(sock, remoteJid, msg.key, '❌');

    const errorMsg = `⚠️ *Gagal Mengunduh ${info.name}*\n` +
      `Keterangan: ${err.message || 'Terjadi kesalahan sistem'}\n\n` +
      `💡 _Pastikan link video bersifat publik, tidak diprivat, dan masih aktif._`;

    await sock.sendMessage(remoteJid, { text: errorMsg }, { quoted: msg });
  } finally {
    activeDownloads.delete(lockKey);
  }
}
