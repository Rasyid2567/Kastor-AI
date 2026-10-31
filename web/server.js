import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initDatabase } from '../database/schema.js';
import { handleApiRequest, sendJson } from './src/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Muat konfigurasi .env dari root project
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Pastikan seluruh tabel (termasuk web_users, web_sessions, dll) telah diinisialisasi
initDatabase();

const publicDir = path.resolve(__dirname, 'public');
const uploadsDir = path.resolve(__dirname, '../uploads');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

/**
 * Melayani file statis dari direktori `web/public/` dengan proteksi Path Traversal
 */
function serveStaticFile(res, filePath) {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return false;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin'
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Request handler utama untuk HTTP Server maupun pengujian terisolasi
 */
export async function handleRequest(req, res) {
  try {
    const host = req.headers?.host || 'localhost';
    const reqUrl = new URL(req.url || '/', `http://${host}`);
    const pathname = reqUrl.pathname;

    // 1. Endpoint API (/api/*)
    if (pathname.startsWith('/api/') || pathname === '/api') {
      await handleApiRequest(req, res, reqUrl);
      return;
    }

    // 1b. File Uploads (/uploads/*)
    if (pathname.startsWith('/uploads/')) {
      const safeRelative = path.normalize(pathname.replace(/^\/uploads\/?/, '')).replace(/^(\.\.(\/|\\|$))+/, '');
      const candidatePath = path.join(uploadsDir, safeRelative);
      if (candidatePath.startsWith(uploadsDir) && serveStaticFile(res, candidatePath)) {
        return;
      }
      sendJson(res, 404, { ok: false, error: 'Berkas tidak ditemukan.' });
      return;
    }

    // 2. File Statis dari web/public
    const safeRelative = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
    const candidatePath = path.join(publicDir, safeRelative === '/' ? 'index.html' : safeRelative);

    // Pastikan tetap berada di dalam publicDir
    if (candidatePath.startsWith(publicDir)) {
      if (serveStaticFile(res, candidatePath)) {
        return;
      }
    }

    // 3. Fallback SPA ke index.html untuk route frontend
    const indexHtmlPath = path.join(publicDir, 'index.html');
    if (serveStaticFile(res, indexHtmlPath)) {
      return;
    }

    sendJson(res, 404, { ok: false, error: 'Halaman tidak ditemukan.' });
  } catch (err) {
    console.error('[WEB SERVER ERROR]:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { ok: false, error: 'Terjadi kesalahan internal pada server.' });
    }
  }
}

/**
 * Buat instance HTTP server
 */
export function createWebServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res);
  });
}

// Jalankan server secara otomatis jika dieksekusi sebagai entry point utama
const isMain =
  (typeof import.meta.main === 'boolean' && import.meta.main) ||
  (process.argv[1] && path.resolve(process.argv[1]) === __filename && !process.argv[1].includes('$deno$'));

if (isMain) {
  const port = parseInt(process.env.WEB_PORT || process.env.PORT || '3001', 10);
  const rawHost = process.env.WEB_HOST || '::';
  const host = rawHost === '0.0.0.0' ? '::' : rawHost;
  const server = createWebServer();

  server.listen(port, host, () => {
    console.log(`🌐 [ARAS 1.0 WEB DASHBOARD] Server aktif (Dual-Stack IPv4/IPv6) di http://localhost:${port}`);
  });
}
