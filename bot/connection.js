import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import { routeMessage, extractMessageText } from './router.js';
import { setupAssignmentCron } from './modules/assignments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authPath = path.resolve(__dirname, '../auth_info_baileys');

export async function startWhatsAppSocket() {
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1043857760], isLatest: true }));

  console.log(`[SOCKET] Menghubungkan ke WhatsApp Web versi ${version.join('.')} (Latest: ${isLatest})...`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    browser: ['Ubuntu', 'Chrome', '22.04.4']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n============================================================');
      console.log('📌 SCAN QR CODE DI BAWAH INI UNTUK MENGHUBUNGKAN BOT WHATSAPP:');
      console.log('============================================================\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== DisconnectReason.connectionReplaced;
      console.log(`[SOCKET] Koneksi terputus (Status: ${statusCode || 'unknown'}). Mencoba menghubungkan kembali? ${shouldReconnect}`);
      try {
        sock.ws?.close();
      } catch {}
      if (shouldReconnect) {
        setTimeout(() => {
          startWhatsAppSocket();
        }, 3000); // Berikan jeda 3 detik agar tidak reconnect loop instan
      }
    } else if (connection === 'open') {
      console.log('\n============================================================');
      console.log('✅ BOT WHATSAPP KELAS (ARAS 1.0) BERHASIL TERHUBUNG & AKTIF!');
      console.log(`🤖 ID Bot: ${sock.user?.id}`);
      console.log('============================================================\n');

      // Aktifkan scheduler cron pengingat PR (berjalan otomatis jika ada PR yang diinput)
      setupAssignmentCron(sock);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      if (!msg.message) continue;

      // Jika pesan dari diri sendiri (fromMe), hanya izinkan jika merupakan perintah '/'
      if (msg.key.fromMe) {
        const text = extractMessageText(msg);
        if (!text || !text.startsWith('/')) continue;
      }

      try {
        await routeMessage(sock, msg);
      } catch (err) {
        console.error('[ROUTER ERROR]:', err);
      }
    }
  });

  return sock;
}
