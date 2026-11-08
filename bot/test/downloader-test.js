import assert from 'assert';
import {
  findYtDlpBinary,
  extractUrl,
  detectPlatform,
  formatDuration,
  formatBytes,
  PLATFORM_INFO,
  safeReact,
  TIKTOK_REGEX,
  YOUTUBE_REGEX,
  INSTAGRAM_REGEX,
  FACEBOOK_REGEX
} from '../modules/downloader.js';

export function runDownloaderTests() {
  console.log('--- TEST 11: Modul Downloader (/tt, /yt, /ig, /fb) ---');

  // 1. Deteksi binary yt-dlp
  const binary = findYtDlpBinary();
  assert(binary && typeof binary === 'string', 'findYtDlpBinary harus mengembalikan string path');
  console.log(`[PASS] findYtDlpBinary: ${binary}`);

  // 2. Ekstraksi URL dari argumen
  const directUrl = extractUrl('https://vt.tiktok.com/ZSxxxx/', '');
  assert.strictEqual(directUrl, 'https://vt.tiktok.com/ZSxxxx/');

  const textWithUrl = extractUrl('coba download dong min https://youtu.be/jNQXAC9IVRw mantap', '');
  assert.strictEqual(textWithUrl, 'https://youtu.be/jNQXAC9IVRw');

  const quotedUrl = extractUrl('', 'nih videonya: https://www.instagram.com/reel/Cxxxx/');
  assert.strictEqual(quotedUrl, 'https://www.instagram.com/reel/Cxxxx/');

  const emptyUrl = extractUrl('', '');
  assert.strictEqual(emptyUrl, null);
  console.log('[PASS] Ekstraksi URL dari teks & quoted chat valid');

  // 3. Deteksi platform
  const ttUrl = 'https://www.tiktok.com/@user/video/7142393816136437018';
  const vtUrl = 'https://vt.tiktok.com/ZSxxxx/';
  assert.strictEqual(detectPlatform(ttUrl), 'tiktok');
  assert.strictEqual(detectPlatform(vtUrl), 'tiktok');

  const ytWatch = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
  const ytShort = 'https://youtube.com/shorts/abcd1234efg';
  const ytBe = 'https://youtu.be/jNQXAC9IVRw';
  assert.strictEqual(detectPlatform(ytWatch), 'youtube');
  assert.strictEqual(detectPlatform(ytShort), 'youtube');
  assert.strictEqual(detectPlatform(ytBe), 'youtube');

  const igReel = 'https://www.instagram.com/reel/DC5Vxxx/';
  const igPost = 'https://www.instagram.com/p/DC5Vxxx/';
  assert.strictEqual(detectPlatform(igReel), 'instagram');
  assert.strictEqual(detectPlatform(igPost), 'instagram');

  const fbWatch = 'https://fb.watch/abcd1234/';
  const fbReel = 'https://www.facebook.com/reel/1234567890';
  assert.strictEqual(detectPlatform(fbWatch), 'facebook');
  assert.strictEqual(detectPlatform(fbReel), 'facebook');

  assert.strictEqual(detectPlatform('https://example.com/video.mp4'), 'unknown');
  console.log('[PASS] Deteksi platform regex (TikTok, YouTube, IG, FB) valid');

  // 4. Formatter
  assert.strictEqual(formatDuration(45), '45 detik');
  assert.strictEqual(formatDuration(125), '2:05');
  assert.strictEqual(formatDuration(0), '-');

  assert.strictEqual(formatBytes(500 * 1024), '500 KB');
  assert.strictEqual(formatBytes(15 * 1024 * 1024), '15.0 MB');
  assert.strictEqual(formatBytes(0), '-');
  console.log('[PASS] Formatter durasi dan ukuran file valid');

  // 5. Verifikasi konfig platform commands
  assert(PLATFORM_INFO['/tt'], '/tt harus terdaftar di PLATFORM_INFO');
  assert(PLATFORM_INFO['/yt'], '/yt harus terdaftar di PLATFORM_INFO');
  assert(PLATFORM_INFO['/ig'], '/ig harus terdaftar di PLATFORM_INFO');
  assert(PLATFORM_INFO['/fb'], '/fb harus terdaftar di PLATFORM_INFO');
  console.log('[PASS] Konfigurasi PLATFORM_INFO (/tt, /yt, /ig, /fb) lengkap');

  // 6. Test safeReact helper (mock sock)
  let capturedReact = null;
  const mockSock = {
    sendMessage: async (jid, content) => {
      capturedReact = { jid, content };
      return { key: { id: 'test' } };
    }
  };
  const mockKey = { remoteJid: 'test@g.us', id: 'msg123' };
  safeReact(mockSock, 'test@g.us', mockKey, '⏳');
  assert(capturedReact && capturedReact.content?.react?.text === '⏳', 'safeReact harus mengirim reaction');
  assert(capturedReact.content?.react?.key === mockKey, 'safeReact harus menyertakan message key');
  console.log('[PASS] safeReact mengirim reaction Baileys dengan benar');
}

// Jalankan jika dieksekusi langsung
if (process.argv[1]?.endsWith('downloader-test.js')) {
  runDownloaderTests();
  console.log('✅ SELURUH PENGUJIAN DOWNLOADER BERHASIL!');
}
