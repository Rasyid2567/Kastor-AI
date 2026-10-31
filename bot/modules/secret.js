import { downloadMediaMessage } from '@whiskeysockets/baileys';

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
