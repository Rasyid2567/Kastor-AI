import os from 'node:os';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Format detik menjadi format Xd Xh Xm Xs
 */
function formatUptime(seconds) {
  const sec = Math.floor(seconds);
  const d = Math.floor(sec / (3600 * 24));
  const h = Math.floor((sec % (3600 * 24)) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

/**
 * Mendapatkan nama distro OS Linux dari /etc/os-release atau os.type()
 */
function getOSName() {
  try {
    if (fs.existsSync('/etc/os-release')) {
      const data = fs.readFileSync('/etc/os-release', 'utf-8');
      const match = data.match(/PRETTY_NAME="?([^"\n]+)"?/);
      if (match) return match[1];
    }
  } catch (_) {}
  return `${os.type()} ${os.release()}`;
}

/**
 * Mendapatkan alamat IP VPS non-internal (prioritas interface jaringan fisik/LAN)
 */
function getServerIP() {
  try {
    const interfaces = os.networkInterfaces();
    let candidate = null;
    for (const [name, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs) {
        if (!addr.internal && addr.family === 'IPv4') {
          if (!candidate) candidate = addr.address;
          if (/^(eth|en|wl|wlan)/i.test(name)) {
            return addr.address;
          }
        }
      }
    }
    return candidate || '127.0.0.1';
  } catch (_) {
    return '127.0.0.1';
  }
}

/**
 * Mendapatkan penggunaan disk partisi root (/)
 */
function getDiskUsage() {
  try {
    const out = execSync('df -k /', { timeout: 3000 }).toString().trim().split('\n');
    if (out.length >= 2) {
      const parts = out[1].trim().split(/\s+/);
      const totalKb = parseInt(parts[1], 10);
      const usedKb = parseInt(parts[2], 10);
      const availKb = parseInt(parts[3], 10);
      const totalGB = (totalKb / (1024 * 1024)).toFixed(1);
      const usedGB = (usedKb / (1024 * 1024)).toFixed(1);
      const availGB = (availKb / (1024 * 1024)).toFixed(1);
      const usedPercent = ((usedKb / totalKb) * 100).toFixed(1);
      const availPercent = ((availKb / totalKb) * 100).toFixed(1);
      return { totalGB, usedGB, availGB, usedPercent, availPercent };
    }
  } catch (_) {}
  return null;
}

/**
 * Mengambil ringkasan status sistem dan performa bot untuk perintah /ping & /status
 * @param {number|object|null} msgTimestamp Timestamp pesan Baileys (detik)
 * @param {number} [startPerf] performance.now() saat command mulai diproses
 * @returns {string} Pesan status terformat ARAS 1.0
 */
export function getSystemStatusInfo(msgTimestamp, startPerf) {
  const line = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  // 1. Latensi
  let latencyStr = '';
  const now = Date.now();
  let tsSec = 0;
  if (typeof msgTimestamp === 'object' && msgTimestamp !== null) {
    tsSec = Number(msgTimestamp.low || msgTimestamp);
  } else if (typeof msgTimestamp === 'number') {
    tsSec = msgTimestamp;
  }

  if (tsSec > 0) {
    const msgMs = tsSec > 1e11 ? tsSec : tsSec * 1000;
    const diff = now - msgMs;
    if (diff >= 0 && diff < 600000) {
      latencyStr = diff < 1000 ? `${diff} ms` : `${(diff / 1000).toFixed(2)} s`;
    }
  }

  if (!latencyStr && startPerf) {
    const delta = performance.now() - startPerf;
    latencyStr = `${delta.toFixed(3)} ms`;
  }

  if (!latencyStr) {
    latencyStr = '1 ms';
  }

  // 2. Server & OS
  const osName = getOSName();
  const serverIp = getServerIP();
  const osType = `${os.type()} ${os.arch()}`;

  // 3. RAM
  const totalRam = os.totalmem();
  const freeRam = os.freemem();
  const usedRam = totalRam - freeRam;
  const totalRamGB = (totalRam / (1024 ** 3)).toFixed(2);
  const usedRamGB = (usedRam / (1024 ** 3)).toFixed(2);
  const freeRamGB = (freeRam / (1024 ** 3)).toFixed(2);
  const ramUsedPct = ((usedRam / totalRam) * 100).toFixed(1);
  const ramFreePct = ((freeRam / totalRam) * 100).toFixed(1);
  const botRssMB = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);

  // 4. Disk Storage
  const disk = getDiskUsage();

  // 5. Runtime
  const vpsUptime = formatUptime(os.uptime());
  const botUptime = formatUptime(process.uptime());

  // 6. CPU
  const cpus = os.cpus() || [];
  const cpuModel = cpus[0]?.model?.trim() || 'Unknown';
  const cpuSpeed = cpus[0]?.speed || 0;
  const cpuCores = cpus.length;

  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
  for (const cpu of cpus) {
    user += cpu.times?.user || 0;
    nice += cpu.times?.nice || 0;
    sys += cpu.times?.sys || 0;
    idle += cpu.times?.idle || 0;
    irq += cpu.times?.irq || 0;
  }
  const totalCpuTime = user + nice + sys + idle + irq || 1;
  const userPct = ((user / totalCpuTime) * 100).toFixed(2);
  const nicePct = ((nice / totalCpuTime) * 100).toFixed(2);
  const sysPct = ((sys / totalCpuTime) * 100).toFixed(2);
  const idlePct = ((idle / totalCpuTime) * 100).toFixed(2);
  const irqPct = ((irq / totalCpuTime) * 100).toFixed(2);

  return `⚡ STATUS BOT & SERVER
ARAS 1.0

${line}

⚡ PING
• Latensi : ${latencyStr}

🖥️ SERVER
• OS : ${osName}
• IP : ${serverIp}
• Tipe OS : ${osType}

💾 RAM
• Total : ${totalRamGB} GB
• Terpakai : ${usedRamGB} GB (${ramUsedPct}%)
• Tersisa : ${freeRamGB} GB (${ramFreePct}%)
• Bot RSS : ${botRssMB} MB

📁 STORAGE
• Total : ${disk ? disk.totalGB + ' GB' : '-'}
• Digunakan : ${disk ? `${disk.usedGB} GB (${disk.usedPercent}%)` : '-'}
• Tersisa : ${disk ? `${disk.availGB} GB (${disk.availPercent}%)` : '-'}

⏳ RUNTIME
• VPS : ${vpsUptime}
• Bot : ${botUptime}

⚙️ CPU (${cpuCores} Core)
• Model : ${cpuModel}
• Speed : ${cpuSpeed} MHz
• user : ${userPct}%
• nice : ${nicePct}%
• sys : ${sysPct}%
• idle : ${idlePct}%
• irq : ${irqPct}%

${line}
✨ Bot berjalan normal & stabil`;
}
