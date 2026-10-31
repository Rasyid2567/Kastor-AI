import 'dotenv/config';
import { initDatabase } from '../database/schema.js';
import { startWhatsAppSocket } from './connection.js';

console.log('>>> Memulai sistem Multi-Group WhatsApp Classroom Management Bot (ARAS 1.0)...');

// Inisialisasi basis data SQLite (tanpa data dummy otomatis)
initDatabase();

// Nyalakan socket koneksi Baileys
startWhatsAppSocket().catch(err => {
  console.error('[FATAL] Gagal menyalakan bot:', err);
});
