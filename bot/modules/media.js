import { evaluate } from 'mathjs';
import { createWorker } from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { db } from '../../database/schema.js';

/**
 * Evaluasi rumus matematika menghasilkan nilai numerik mentah
 */
export function evaluateMathRaw(expression) {
  if (!expression || expression.trim() === '') {
    throw new Error('Masukkan rumus matematika yang ingin dihitung.');
  }
  const cleanExpr = expression.replace(/x/gi, '*').replace(/÷/g, '/');
  return evaluate(cleanExpr);
}

/**
 * /calc [rumus]
 * Evaluasi ekspresi matematika terformat untuk WhatsApp bot
 */
export function calculateMath(expression) {
  try {
    const result = evaluateMathRaw(expression);
    return `🧮 *HASIL PERHITUNGAN*\n• *Soal:* \`\`\`${expression}\`\`\`\n• *Hasil:* *${result}*`;
  } catch (err) {
    return `⚠️ Gagal menghitung ekspresi matematika: ${err.message}`;
  }
}

/**
 * /ocr
 * Ekstraksi teks dari buffer foto menggunakan AI Vision (Utama) dengan Fallback Tesseract.js
 */
export async function performOcr(imageBuffer) {
  // 1. Coba AI Vision terlebih dahulu jika ada API Key
  const apiKey = process.env.AI_API_KEY;
  if (apiKey) {
    const base64Image = imageBuffer.toString('base64');
    const visionModels = [
      'nvidia/nemotron-3.5-super-vl:free',
      'google/gemma-4-31b-it:free',
      'dots-studio/dots-3-note-preview:free',
      'google/gemma-4-26b-a4b-it:free'
    ];

    for (const model of visionModels) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/syid/whatsapp-classroom-bot',
            'X-Title': 'ARAS Classroom Bot'
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Tolong transkripsikan seluruh teks dan tulisan tangan yang ada pada gambar/papan tulis ini secara persis baris demi baris. Hanya tuliskan hasil transkripsi teksnya saja tanpa pengantar atau penutup:'
                  },
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          console.warn(`Vision model ${model} HTTP ${response.status}, mencoba model berikutnya...`);
          continue;
        }

        const data = await response.json();
        const aiText = data.choices?.[0]?.message?.content?.trim();
        if (aiText) {
          return `📝 *HASIL OCR (EKSTRAKSI TEKS)*\n────────────────────────────\n${aiText}`;
        }
      } catch (e) {
        console.warn(`Vision model ${model} error (${e.message}), mencoba model berikutnya...`);
      }
    }
  }

  // 2. Fallback: Tesseract.js (Node.js WASM) jika seluruh AI Vision offline
  let worker = null;
  try {
    worker = await createWorker('ind+eng');
    const ret = await worker.recognize(imageBuffer);
    await worker.terminate();

    const text = ret.data.text.trim();
    if (!text) {
      return '🔍 Tidak ada teks yang terdeteksi pada gambar tersebut.';
    }

    return `📝 *HASIL OCR (EKSTRAKSI TEKS)*\n────────────────────────────\n${text}`;
  } catch (err) {
    if (worker) await worker.terminate().catch(() => {});
    return `⚠️ Gagal memproses OCR: ${err.message}`;
  }
}

/**
 * /topdf
 * Menggabungkan satu atau beberapa buffer foto menjadi 1 berkas PDF
 */
export async function createPdfFromImages(imageBuffers) {
  try {
    const pdfDoc = await PDFDocument.create();

    for (const buf of imageBuffers) {
      let img;
      try {
        img = await pdfDoc.embedJpg(buf);
      } catch {
        img = await pdfDoc.embedPng(buf);
      }

      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, {
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (err) {
    throw new Error(`Gagal membuat PDF: ${err.message}`);
  }
}

/**
 * Konversi media gambar/video pendek menjadi stiker WebP via ffmpeg
 */
export async function convertToSticker(mediaBuffer, isVideo = false) {
  return new Promise((resolve, reject) => {
    const tmpInput = path.join(os.tmpdir(), `input_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    const tmpOutput = path.join(os.tmpdir(), `output_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`);

    fs.writeFileSync(tmpInput, mediaBuffer);

    const args = isVideo
      ? [
          '-y', '-i', tmpInput,
          '-t', '7',
          '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000',
          '-vcodec', 'libwebp',
          '-lossless', '0',
          '-compression_level', '4',
          '-q:v', '50',
          '-loop', '0',
          '-an',
          tmpOutput
        ]
      : [
          '-y', '-i', tmpInput,
          '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000',
          '-vcodec', 'libwebp',
          '-lossless', '0',
          '-compression_level', '4',
          '-q:v', '75',
          '-loop', '0',
          tmpOutput
        ];

    const proc = spawn('ffmpeg', args);

    proc.on('close', (code) => {
      try { fs.unlinkSync(tmpInput); } catch {}

      if (code === 0 && fs.existsSync(tmpOutput)) {
        const outBuf = fs.readFileSync(tmpOutput);
        try { fs.unlinkSync(tmpOutput); } catch {}
        resolve(outBuf);
      } else {
        try { fs.unlinkSync(tmpOutput); } catch {}
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpInput); } catch {}
      try { fs.unlinkSync(tmpOutput); } catch {}
      reject(err);
    });
  });
}

/**
 * Konversi stiker WebP menjadi gambar JPEG via ffmpeg
 */
export async function convertStickerToImage(stickerBuffer) {
  return new Promise((resolve, reject) => {
    const tmpInput = path.join(os.tmpdir(), `sticker_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`);
    const tmpOutput = path.join(os.tmpdir(), `image_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);

    fs.writeFileSync(tmpInput, stickerBuffer);

    const proc = spawn('ffmpeg', ['-y', '-i', tmpInput, '-vframes', '1', tmpOutput]);

    proc.on('close', (code) => {
      try { fs.unlinkSync(tmpInput); } catch {}

      if (code === 0 && fs.existsSync(tmpOutput)) {
        const outBuf = fs.readFileSync(tmpOutput);
        try { fs.unlinkSync(tmpOutput); } catch {}
        resolve(outBuf);
      } else {
        try { fs.unlinkSync(tmpOutput); } catch {}
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpInput); } catch {}
      try { fs.unlinkSync(tmpOutput); } catch {}
      reject(err);
    });
  });
}

/**
 * Konversi stiker animasi WebP menjadi video GIF/MP4 loop via ffmpeg
 */
export async function convertStickerToGif(stickerBuffer) {
  return new Promise((resolve, reject) => {
    const tmpInput = path.join(os.tmpdir(), `sticker_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`);
    const tmpOutput = path.join(os.tmpdir(), `gif_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);

    fs.writeFileSync(tmpInput, stickerBuffer);

    // Konversi WebP animasi ke MP4 kompatibel WhatsApp dengan format yuv420p
    const args = [
      '-y',
      '-i', tmpInput,
      '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,format=yuv420p',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', 'faststart',
      '-an',
      tmpOutput
    ];

    const proc = spawn('ffmpeg', args);

    proc.on('close', (code) => {
      try { fs.unlinkSync(tmpInput); } catch {}

      if (code === 0 && fs.existsSync(tmpOutput)) {
        const outBuf = fs.readFileSync(tmpOutput);
        try { fs.unlinkSync(tmpOutput); } catch {}
        resolve(outBuf);
      } else {
        try { fs.unlinkSync(tmpOutput); } catch {}
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpInput); } catch {}
      try { fs.unlinkSync(tmpOutput); } catch {}
      reject(err);
    });
  });
}

/**
 * /brat [teks]
 * Menghasilkan stiker teks Brat (latar hijau limau dengan teks hitam khas buram)
 */
export async function generateBratImage(text) {
  if (!text || text.trim() === '') {
    throw new Error('Masukkan teks untuk stiker brat. Contoh: `/brat aku sayang kamu`');
  }
  const cleanText = text.trim();

  // 1. Coba via API siputzx
  try {
    const res = await fetch(`https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(cleanText)}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const imgBuf = Buffer.from(await res.arrayBuffer());
      return await convertToSticker(imgBuf, false);
    }
  } catch {}

  // 2. Fallback lokal: generate via FFmpeg drawtext dengan background #8ACE00
  return new Promise((resolve, reject) => {
    const tmpOutput = path.join(os.tmpdir(), `brat_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`);
    const escapedText = cleanText.replace(/\\/g, '\\\\').replace(/'/g, "'\\''").replace(/:/g, '\\:').replace(/%/g, '%%');
    const args = [
      '-y',
      '-f', 'lavfi',
      '-i', 'color=c=0x8ACE00:s=512x512:d=1',
      '-vf', `drawtext=text='${escapedText}':fontcolor=black:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2`,
      '-vframes', '1',
      '-vcodec', 'libwebp',
      '-lossless', '0',
      '-compression_level', '4',
      '-q:v', '75',
      '-loop', '0',
      tmpOutput
    ];
    const proc = spawn('ffmpeg', args);
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(tmpOutput)) {
        const outBuf = fs.readFileSync(tmpOutput);
        try { fs.unlinkSync(tmpOutput); } catch {}
        resolve(outBuf);
      } else {
        try { fs.unlinkSync(tmpOutput); } catch {}
        reject(new Error(`FFmpeg brat fallback exited with code ${code}`));
      }
    });
    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpOutput); } catch {}
      reject(err);
    });
  });
}

/**
 * /bratvid [teks]
 * Menghasilkan stiker video/animasi teks Brat bertahap (word by word)
 */
export async function generateBratVideo(text) {
  if (!text || text.trim() === '') {
    throw new Error('Masukkan teks untuk stiker bratvid. Contoh: `/bratvid aku sayang kamu`');
  }
  const words = text.trim().split(/\s+/).slice(0, 15);
  const frames = [];
  let curr = '';
  for (const w of words) {
    curr = curr ? (curr + ' ' + w) : w;
    frames.push(curr);
  }

  // Ambil buffer gambar untuk setiap tahap kata secara paralel
  const bufs = await Promise.all(frames.map(async (frameText) => {
    try {
      const res = await fetch(`https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(frameText)}`, {
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch {}

    // Fallback frame via FFmpeg drawtext
    return new Promise((resolve) => {
      const tmpOut = path.join(os.tmpdir(), `bframe_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
      const esc = frameText.replace(/\\/g, '\\\\').replace(/'/g, "'\\''").replace(/:/g, '\\:').replace(/%/g, '%%');
      const proc = spawn('ffmpeg', [
        '-y', '-f', 'lavfi', '-i', 'color=c=0x8ACE00:s=512x512:d=1',
        '-vf', `drawtext=text='${esc}':fontcolor=black:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2`,
        '-vframes', '1', tmpOut
      ]);
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(tmpOut)) {
          const b = fs.readFileSync(tmpOut);
          try { fs.unlinkSync(tmpOut); } catch {}
          resolve(b);
        } else {
          resolve(null);
        }
      });
      proc.on('error', () => resolve(null));
    });
  }));

  const validBufs = bufs.filter(Boolean);
  if (validBufs.length === 0) {
    throw new Error('Gagal merender frame bratvid');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bratvid_'));
  try {
    validBufs.forEach((b, i) => {
      fs.writeFileSync(path.join(tmpDir, `frame_${String(i).padStart(3, '0')}.png`), b);
    });
    // Duplikasi frame terakhir 2 kali agar ada jeda baca di akhir
    fs.copyFileSync(
      path.join(tmpDir, `frame_${String(validBufs.length - 1).padStart(3, '0')}.png`),
      path.join(tmpDir, `frame_${String(validBufs.length).padStart(3, '0')}.png`)
    );
    fs.copyFileSync(
      path.join(tmpDir, `frame_${String(validBufs.length - 1).padStart(3, '0')}.png`),
      path.join(tmpDir, `frame_${String(validBufs.length + 1).padStart(3, '0')}.png`)
    );

    const outWebp = path.join(tmpDir, 'output.webp');
    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-y',
        '-framerate', '2',
        '-i', path.join(tmpDir, 'frame_%03d.png'),
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000',
        '-vcodec', 'libwebp',
        '-lossless', '0',
        '-compression_level', '4',
        '-q:v', '55',
        '-loop', '0',
        outWebp
      ]);
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with ${code}`)));
      proc.on('error', reject);
    });

    return fs.readFileSync(outWebp);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

/**
 * /smeme [teks_atas] | [teks_bawah]
 * Membuat stiker meme dengan teks atas dan bawah pada gambar
 */
export async function generateStickerMeme(imageBuffer, topText = '', bottomText = '') {
  return new Promise((resolve, reject) => {
    const tmpInput = path.join(os.tmpdir(), `smeme_in_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
    const tmpOutput = path.join(os.tmpdir(), `smeme_out_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`);

    fs.writeFileSync(tmpInput, imageBuffer);

    // Siapkan filter drawtext untuk teks atas dan bawah
    const filters = [
      'scale=512:512:force_original_aspect_ratio=decrease',
      'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000'
    ];

    const cleanTop = (topText || '').trim();
    const cleanBottom = (bottomText || '').trim();

    if (cleanTop) {
      const escTop = cleanTop.toUpperCase().replace(/\\/g, '\\\\').replace(/'/g, "'\\''").replace(/:/g, '\\:').replace(/%/g, '%%');
      filters.push(`drawtext=text='${escTop}':fontcolor=white:bordercolor=black:borderw=3:fontsize=36:x=(w-text_w)/2:y=20`);
    }

    if (cleanBottom) {
      const escBottom = cleanBottom.toUpperCase().replace(/\\/g, '\\\\').replace(/'/g, "'\\''").replace(/:/g, '\\:').replace(/%/g, '%%');
      filters.push(`drawtext=text='${escBottom}':fontcolor=white:bordercolor=black:borderw=3:fontsize=36:x=(w-text_w)/2:y=h-text_h-20`);
    }

    const args = [
      '-y',
      '-i', tmpInput,
      '-vf', filters.join(','),
      '-vframes', '1',
      '-vcodec', 'libwebp',
      '-lossless', '0',
      '-compression_level', '4',
      '-q:v', '75',
      '-loop', '0',
      tmpOutput
    ];

    const proc = spawn('ffmpeg', args);
    proc.on('close', (code) => {
      try { fs.unlinkSync(tmpInput); } catch {}
      if (code === 0 && fs.existsSync(tmpOutput)) {
        const out = fs.readFileSync(tmpOutput);
        try { fs.unlinkSync(tmpOutput); } catch {}
        resolve(out);
      } else {
        try { fs.unlinkSync(tmpOutput); } catch {}
        reject(new Error(`FFmpeg smeme exited with code ${code}`));
      }
    });
    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpInput); } catch {}
      try { fs.unlinkSync(tmpOutput); } catch {}
      reject(err);
    });
  });
}

/**
 * /emojimix [emoji1]+[emoji2]
 * Menggabungkan dua emoji Google Kitchen menjadi stiker
 */
export async function generateEmojiMix(emoji1, emoji2) {
  if (!emoji1 || !emoji2) {
    throw new Error('Masukkan dua emoji untuk digabungkan. Contoh: `/emojimix 😂+🥰` atau `/emojimix 😭 💀`');
  }

  const clean1 = emoji1.trim();
  const clean2 = emoji2.trim();

  // Coba kombinasi (1_2) lalu (2_1) jika yang pertama gagal
  const attempts = [
    `https://emojik.vercel.app/s/${clean1}_${clean2}?size=512`,
    `https://emojik.vercel.app/s/${clean2}_${clean1}?size=512`
  ];

  for (const url of attempts) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('image')) {
          const imgBuf = Buffer.from(await res.arrayBuffer());
          return await convertToSticker(imgBuf, false);
        }
      }
    } catch {}
  }

  throw new Error(`Kombinasi emoji ${clean1} dan ${clean2} tidak didukung atau belum tersedia di Emoji Kitchen.`);
}

/**
 * /qc [teks]
 * Membuat stiker kutipan obrolan Quotly
 */
export async function generateQuoteChat(text, senderName = 'Pengguna', avatarUrl = null) {
  if (!text || text.trim() === '') {
    throw new Error('Balas pesan dengan `/qc` atau ketik `/qc [teks]` untuk membuat stiker quote.');
  }

  const cleanText = text.trim();
  const photoUrl = avatarUrl || 'https://telegra.ph/file/24fa902ead26340f3df2c.png';

  const payload = {
    type: 'quote',
    format: 'png',
    backgroundColor: '#1b1429',
    width: 512,
    height: 768,
    scale: 2,
    messages: [
      {
        entities: [],
        avatar: true,
        from: {
          id: 1,
          name: senderName || 'Pengguna',
          photo: { url: photoUrl }
        },
        text: cleanText,
        replyMessage: {}
      }
    ]
  };

  const res = await fetch('https://qc.botcahx.eu.org/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    throw new Error(`Layanan QC mengembalikan status ${res.status}`);
  }

  const data = await res.json();
  const base64Img = data?.result?.image;
  if (!base64Img) {
    throw new Error('Gagal mendapatkan gambar dari layanan QC');
  }

  const imgBuf = Buffer.from(base64Img, 'base64');
  return await convertToSticker(imgBuf, false);
}

/**
 * Mengambil konfigurasi Rate Limit Pembuatan Stiker dari tabel bot_settings
 */
export function getStickerLimitConfig() {
  try {
    const rows = db.prepare(`
      SELECT key, value FROM bot_settings
      WHERE key IN ('sticker_limit_enabled', 'sticker_limit_count', 'sticker_limit_window_seconds', 'sticker_limit_message')
    `).all();
    const map = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }

    const enabled = map.sticker_limit_enabled !== undefined ? map.sticker_limit_enabled === '1' : true;
    const maxStickers = Math.max(1, parseInt(map.sticker_limit_count || '1', 10) || 1);
    const windowSeconds = Math.max(1, parseInt(map.sticker_limit_window_seconds || '120', 10) || 120);
    const message =
      (map.sticker_limit_message && map.sticker_limit_message.trim()) ||
      'Pembuatan sticker sedang limit, mohon tunggu sebentar';

    return {
      enabled,
      max_stickers: maxStickers,
      window_seconds: windowSeconds,
      message
    };
  } catch {
    return {
      enabled: true,
      max_stickers: 1,
      window_seconds: 120,
      message: 'Pembuatan sticker sedang limit, mohon tunggu sebentar'
    };
  }
}

/**
 * Memperbarui konfigurasi Rate Limit Pembuatan Stiker di tabel bot_settings
 */
export function updateStickerLimitConfig({ enabled, max_stickers, window_seconds, message }) {
  const current = getStickerLimitConfig();
  const nextEnabled = enabled !== undefined ? Boolean(enabled) : current.enabled;
  const nextMax = max_stickers !== undefined ? Math.max(1, Math.min(100, parseInt(max_stickers, 10) || 1)) : current.max_stickers;
  const nextWindow = window_seconds !== undefined ? Math.max(1, Math.min(86400, parseInt(window_seconds, 10) || 120)) : current.window_seconds;
  const nextMsg =
    message !== undefined && String(message).trim()
      ? String(message).trim().slice(0, 300)
      : current.message;

  const upsert = db.prepare(`
    INSERT INTO bot_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  db.exec('BEGIN');
  try {
    upsert.run('sticker_limit_enabled', nextEnabled ? '1' : '0');
    upsert.run('sticker_limit_count', String(nextMax));
    upsert.run('sticker_limit_window_seconds', String(nextWindow));
    upsert.run('sticker_limit_message', nextMsg);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return getStickerLimitConfig();
}

/**
 * Memeriksa apakah grup sedang mencapai batas (limit) pembuatan stiker
 */
export function checkStickerRateLimit(groupId) {
  const config = getStickerLimitConfig();
  if (!config.enabled || !groupId) {
    return { allowed: true, config };
  }

  const now = Date.now();
  const cutoff = now - config.window_seconds * 1000;

  // Bersihkan catatan yang sudah di luar jendela waktu
  db.prepare('DELETE FROM sticker_rate_limits WHERE created_at_ms <= ?').run(cutoff);

  const usageRows = db.prepare(`
    SELECT id, created_at_ms FROM sticker_rate_limits
    WHERE group_id = ? AND created_at_ms > ?
    ORDER BY created_at_ms ASC
  `).all(groupId, cutoff);

  if (usageRows.length >= config.max_stickers) {
    const oldestMs = Number(usageRows[0].created_at_ms);
    const remainingSeconds = Math.max(1, Math.ceil((oldestMs + config.window_seconds * 1000 - now) / 1000));
    return {
      allowed: false,
      message: config.message,
      remaining_seconds: remainingSeconds,
      used_count: usageRows.length,
      config
    };
  }

  return {
    allowed: true,
    used_count: usageRows.length,
    config
  };
}

/**
 * Mencatat penggunaan kuota stiker untuk sebuah grup
 */
export function recordStickerUsage(groupId, senderJid = null, command = '/s') {
  if (!groupId) return null;
  const res = db.prepare(`
    INSERT INTO sticker_rate_limits (group_id, sender_jid, command, created_at_ms)
    VALUES (?, ?, ?, ?)
  `).run(groupId, senderJid, command, Date.now());
  return Number(res.lastInsertRowid);
}

/**
 * Menghapus catatan kuota stiker berdasarkan ID (jika proses pembuatan stiker gagal karena error teknis)
 */
export function removeStickerUsageById(recordId) {
  if (!recordId) return;
  try {
    db.prepare('DELETE FROM sticker_rate_limits WHERE id = ?').run(recordId);
  } catch {}
}

/**
 * Me-reset cooldown pembuatan stiker untuk grup tertentu atau seluruh grup
 */
export function resetStickerRateLimit(groupId = null) {
  if (groupId && groupId !== 'ALL') {
    const res = db.prepare('DELETE FROM sticker_rate_limits WHERE group_id = ?').run(groupId);
    return Number(res.changes || 0);
  }
  const res = db.prepare('DELETE FROM sticker_rate_limits').run();
  return Number(res.changes || 0);
}

/**
 * Ringkasan status kuota stiker aktif per grup untuk Developer Console
 */
export function getStickerUsageSummary() {
  const config = getStickerLimitConfig();
  const now = Date.now();
  const cutoff = now - config.window_seconds * 1000;

  db.prepare('DELETE FROM sticker_rate_limits WHERE created_at_ms <= ?').run(cutoff);

  const classes = db.prepare('SELECT group_id, class_name FROM classes ORDER BY created_at ASC').all();
  const activeRows = db.prepare(`
    SELECT group_id, COUNT(*) AS used_count, MIN(created_at_ms) AS oldest_ms, MAX(created_at_ms) AS latest_ms
    FROM sticker_rate_limits
    WHERE created_at_ms > ?
    GROUP BY group_id
  `).all(cutoff);

  const activeMap = new Map();
  for (const r of activeRows) {
    activeMap.set(r.group_id, r);
  }

  const classMap = new Map();
  for (const c of classes) {
    classMap.set(c.group_id, c.class_name);
  }

  // Gabungkan seluruh kelas terdaftar dan grup lain yang aktif
  const allGroupIds = new Set([...classes.map(c => c.group_id), ...activeRows.map(r => r.group_id)]);
  const groups = [];

  for (const gid of allGroupIds) {
    const usage = activeMap.get(gid);
    const usedCount = Number(usage?.used_count || 0);
    const isLimited = config.enabled && usedCount >= config.max_stickers;
    const remainingSeconds =
      usage && isLimited
        ? Math.max(0, Math.ceil((Number(usage.oldest_ms) + config.window_seconds * 1000 - now) / 1000))
        : 0;

    groups.push({
      group_id: gid,
      class_name: classMap.get(gid) || gid,
      used_count: usedCount,
      max_stickers: config.max_stickers,
      is_limited: isLimited,
      remaining_seconds: remainingSeconds
    });
  }

  return {
    config,
    groups
  };
}
