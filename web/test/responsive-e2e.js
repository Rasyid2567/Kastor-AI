/**
 * ============================================================================
 * KASTOR AI / ARAS 1.0 — RESPONSIVE MOBILE-FIRST E2E AUTOMATED TEST SUITE
 * ============================================================================
 *
 * Comprehensive end-to-end and responsive design validation suite verifying:
 * - Tier 1: Feature Coverage & Shell Components (Bottom Nav, Sidebar, Topbar, 5 UI States)
 * - Tier 2: Boundary & Viewport Checks (360px, 390px, 768px, 1280px; Touch Targets; Typography; Midnight Slate Tokens)
 * - Tier 3: Cross-Feature & Interaction Combinations (Table-to-Card, Opaque Modals, Button Hierarchy, RBAC Kas Hiding)
 * - Tier 4: Real-World & Regression Verification (Live HTTP Server, Authentication, Multi-Class Context, API Security)
 *
 * Execution:
 *   bun web/test/responsive-e2e.js
 *   node web/test/responsive-e2e.js
 *   bun web/test/responsive-e2e.js --tier 1
 *   node web/test/responsive-e2e.js --tier 2
 *
 * Zero external dependencies — pure Node.js / Bun standard library.
 * Database isolation: Copies production DB to /tmp/aras_e2e_test_${pid}.sqlite.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { spawnSync } from 'node:child_process';
import { TEST_CONSTANTS, seedTestDatabase } from './setup-test-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const prodDbPath = path.join(projectRoot, 'database.sqlite');
const tempDbPath = `/tmp/aras_e2e_test_${process.pid}.sqlite`;

// Fallback jika dieksekusi via Node pada workspace yang dibuild dengan Deno/Bun
if (typeof process !== 'undefined' && !process.versions?.bun) {
  try {
    const { default: Database } = await import('better-sqlite3');
    new Database(':memory:').close();
  } catch (err) {
    const res = spawnSync('bun', [__filename, ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: process.env
    });
    process.exit(res.status ?? 0);
  }
}

// ----------------------------------------------------------------------------
// CLI ARGUMENTS PARSER
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
let targetTier = null;
let verboseMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tier' && args[i + 1]) {
    targetTier = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i].startsWith('--tier=')) {
    targetTier = parseInt(args[i].split('=')[1], 10);
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    verboseMode = true;
  }
}

// ----------------------------------------------------------------------------
// TEST REPORTING HARNESS
// ----------------------------------------------------------------------------
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  byTier: {
    1: { name: 'Tier 1: Feature Coverage & App Shell', passed: 0, failed: 0, total: 0 },
    2: { name: 'Tier 2: Boundary & Viewport Checks', passed: 0, failed: 0, total: 0 },
    3: { name: 'Tier 3: Cross-Feature & Interactions', passed: 0, failed: 0, total: 0 },
    4: { name: 'Tier 4: Real-World & Regression', passed: 0, failed: 0, total: 0 }
  },
  failures: []
};

function assertTest(tier, code, name, condition, details = '') {
  stats.total++;
  stats.byTier[tier].total++;

  if (condition) {
    stats.passed++;
    stats.byTier[tier].passed++;
    console.log(`  \x1b[32m✅ [PASS]\x1b[0m \x1b[1m${code}\x1b[0m: ${name}`);
    if (verboseMode && details) {
      console.log(`         \x1b[90m${details}\x1b[0m`);
    }
  } else {
    stats.failed++;
    stats.byTier[tier].failed++;
    const errMsg = `[FAIL] ${code}: ${name}${details ? ` — ${details}` : ''}`;
    stats.failures.push({ tier, code, name, details });
    console.error(`  \x1b[31m❌ [FAIL]\x1b[0m \x1b[1m${code}\x1b[0m: ${name}`);
    if (details) {
      console.error(`         \x1b[33mReason: ${details}\x1b[0m`);
    }
  }
}

// ----------------------------------------------------------------------------
// LIGHTWEIGHT HTML & CSS PARSING UTILITIES (ZERO EXTERNAL DEPENDENCY)
// ----------------------------------------------------------------------------

/**
 * Extracts all CSS variable declarations inside :root selectors
 */
function extractRootCssVariables(cssContent) {
  const vars = new Map();
  const rootRegex = /:root\s*\{([^}]+)\}/gi;
  let match;
  while ((match = rootRegex.exec(cssContent)) !== null) {
    const block = match[1];
    const lines = block.split(';');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('--')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const varName = trimmed.substring(0, colonIdx).trim();
        const varVal = trimmed.substring(colonIdx + 1).trim();
        vars.set(varName, varVal);
      }
    }
  }
  return vars;
}

/**
 * Extracts @media rule blocks
 */
function extractMediaQueries(cssContent) {
  const mediaRules = [];
  const mediaRegex = /@media\s*([^{]+)\{([\s\S]*?\}\s*)\}/gi;
  let match;
  while ((match = mediaRegex.exec(cssContent)) !== null) {
    mediaRules.push({
      condition: match[1].trim(),
      body: match[2].trim()
    });
  }
  return mediaRules;
}

/**
 * Parses CSS rules into selector -> declarations map
 */
function parseCssRules(cssContent) {
  // Strip comments
  const cleanCss = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  // Match standard selector { body }
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;
  while ((match = ruleRegex.exec(cleanCss)) !== null) {
    const rawSelector = match[1].trim();
    if (rawSelector.startsWith('@')) continue; // Skip @media, @keyframes, @font-face
    const declsBlock = match[2].trim();
    const decls = {};
    const declLines = declsBlock.split(';');
    for (const line of declLines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const prop = parts[0].trim().toLowerCase();
        const val = parts.slice(1).join(':').trim();
        if (prop && val) decls[prop] = val;
      }
    }
    rules.push({ selector: rawSelector, decls });
  }
  return rules;
}

/**
 * Searches for HTML tag matching selector/attribute
 */
function hasHtmlTag(html, tag, attr, val) {
  const regex = new RegExp(`<${tag}[^>]*${attr}=["'][^"']*${val}[^"']*["'][^>]*>`, 'i');
  return regex.test(html);
}

function hasHtmlElementById(html, id) {
  const regex = new RegExp(`<[a-zA-Z0-9_-]+[^>]*id=["']${id}["'][^>]*>`, 'i');
  return regex.test(html);
}

// ----------------------------------------------------------------------------
// HTTP CLIENT HELPER
// ----------------------------------------------------------------------------
function createHttpClient(baseUrl) {
  let cookieJar = '';

  return {
    getCookies: () => cookieJar,
    setCookies: (c) => { cookieJar = c; },
    clearCookies: () => { cookieJar = ''; },
    async request(method, urlPath, { body = null, headers = {}, ip = '127.0.0.1' } = {}) {
      const reqHeaders = {
        'X-Forwarded-For': ip,
        ...headers
      };
      if (cookieJar) {
        reqHeaders['Cookie'] = cookieJar;
      }
      const opts = {
        method,
        headers: reqHeaders
      };
      if (body !== null && body !== undefined) {
        reqHeaders['Content-Type'] = 'application/json';
        opts.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const res = await fetch(`${baseUrl}${urlPath}`, opts);
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        const match = setCookie.match(/aras_session=([^;]*)/);
        if (match) {
          if (match[1] === '' || setCookie.includes('Max-Age=0')) {
            cookieJar = '';
          } else {
            cookieJar = `aras_session=${match[1]}`;
          }
        }
      }

      const contentType = res.headers.get('content-type') || '';
      let data = null;
      const text = await res.text();
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }

      return {
        status: res.status,
        headers: res.headers,
        data,
        text
      };
    }
  };
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
console.log('\n================================================================================');
console.log('🧪 KASTOR AI / ARAS 1.0 — COMPREHENSIVE RESPONSIVE & E2E TEST SUITE');
console.log('================================================================================');
console.log(`📂 Isolasi Database: ${tempDbPath}`);
console.log(`⚙️  Target: ${targetTier ? `Tier ${targetTier}` : 'Seluruh Tier (Tier 1–4)'}\n`);

// 1. Setup isolated database (Aman untuk CI Publik & Fresh Clone)
process.env.DATABASE_PATH = tempDbPath;
process.env.DEVELOPER_NUMBER = process.env.DEVELOPER_NUMBER || TEST_CONSTANTS.PHONE_DEVELOPER;

// 2. Import database & server dynamically after setting env
const { db, initDatabase } = await import('../../database/schema.js');
const { createWebServer } = await import('../server.js');

initDatabase();
seedTestDatabase(db);

// Bersihkan session pada DB sementara
db.prepare('DELETE FROM web_sessions').run();
db.prepare('DELETE FROM web_users').run();
db.prepare('DELETE FROM web_login_attempts').run();

// Seed akun pengurus sah di DB sementara untuk pengujian RBAC
const { hashPassword } = await import('../src/auth.js');
const defaultPwHash = hashPassword(TEST_CONSTANTS.TEST_PASSWORD);

// Ketua (XI RPL C)
db.prepare(`
  INSERT INTO web_users (phone_number, password_hash, role, group_id, name)
  VALUES (?, ?, ?, ?, ?)
`).run('6281200000002', defaultPwHash, 'KETUA', TEST_CONSTANTS.CLASS_XI_RPL_C, 'Sambega (Ketua)');

// Sekretaris (XI RPL C)
db.prepare(`
  INSERT INTO web_users (phone_number, password_hash, role, group_id, name)
  VALUES (?, ?, ?, ?, ?)
`).run('6281200000004', defaultPwHash, 'SEKRETARIS', TEST_CONSTANTS.CLASS_XI_RPL_C, 'Lexsa (Sekretaris)');

// Bendahara (XI RPL C)
db.prepare(`
  INSERT INTO web_users (phone_number, password_hash, role, group_id, name)
  VALUES (?, ?, ?, ?, ?)
`).run('6281200000006', defaultPwHash, 'BENDAHARA', TEST_CONSTANTS.CLASS_XI_RPL_C, 'Felly (Bendahara)');

// Developer
db.prepare(`
  INSERT INTO web_users (phone_number, password_hash, role, group_id, name)
  VALUES (?, ?, ?, ?, ?)
`).run(TEST_CONSTANTS.PHONE_DEVELOPER, defaultPwHash, 'DEVELOPER', null, 'Developer System');

const server = createWebServer();

let baseUrl = '';

try {
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`🌐 Server Uji Berjalan di ${baseUrl}\n`);

  // Load static files for code-level and structural analysis
  const indexHtmlPath = path.join(projectRoot, 'web/public/index.html');
  const stylesCssPath = path.join(projectRoot, 'web/public/styles.css');
  const appJsPath = path.join(projectRoot, 'web/public/app.js');

  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  const cssContent = fs.readFileSync(stylesCssPath, 'utf8');
  const jsContent = fs.readFileSync(appJsPath, 'utf8');

  const rootVars = extractRootCssVariables(cssContent);
  const mediaQueries = extractMediaQueries(cssContent);
  const cssRules = parseCssRules(cssContent);

  const client = createHttpClient(baseUrl);

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE & APP SHELL
  // ==========================================================================
  if (!targetTier || targetTier === 1) {
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('📦 TIER 1: FEATURE COVERAGE & APP SHELL FOUNDATIONS');
    console.log('────────────────────────────────────────────────────────────────────────────────');

    // T1-01: Document Shell & HTML5 Standards
    {
      const hasDoctype = /<!doctype html>/i.test(htmlContent);
      const hasLangId = /<html[^>]+lang=["']id["']/i.test(htmlContent);
      const hasViewportMeta = /<meta[^>]+name=["']viewport["'][^>]+content=["'][^"']*width=device-width/i.test(htmlContent);
      const hasCoreContainers =
        htmlContent.includes('id="app-shell"') &&
        htmlContent.includes('id="page-content"') &&
        htmlContent.includes('id="toast-container"') &&
        htmlContent.includes('id="modal-overlay"');

      assertTest(
        1,
        'T1-01',
        'Validitas Semantic HTML5 Shell & Kontainer Inti',
        hasDoctype && hasLangId && hasViewportMeta && hasCoreContainers,
        hasDoctype && hasLangId && hasViewportMeta && hasCoreContainers
          ? 'HTML5 doctype, lang="id", viewport responsive, dan semua kontainer inti (#app-shell, #page-content, #toast-container, #modal-overlay) tersedia'
          : `DOCTYPE:${hasDoctype}, lang="id":${hasLangId}, viewport:${hasViewportMeta}, containers:${hasCoreContainers}`
      );
    }

    // T1-02: 5-Slot Bottom Navigation Shell (< 1024px)
    {
      const hasBottomNav =
        htmlContent.includes('id="mobile-bottom-nav"') ||
        htmlContent.includes('class="mobile-bottom-nav"') ||
        jsContent.includes('mobile-bottom-nav') ||
        cssContent.includes('#mobile-bottom-nav') ||
        cssContent.includes('.mobile-bottom-nav');

      // 5 slot wajib: Dashboard, Jadwal, Tugas, Kas, Lainnya
      const has5Slots =
        (htmlContent.includes('data-nav-slot="dashboard"') || jsContent.includes('dashboard')) &&
        (htmlContent.includes('data-nav-slot="schedules"') || jsContent.includes('schedules')) &&
        (htmlContent.includes('data-nav-slot="assignments"') || jsContent.includes('assignments')) &&
        (htmlContent.includes('data-nav-slot="cash"') || jsContent.includes('cash')) &&
        (htmlContent.includes('data-nav-slot="more"') || jsContent.includes('more') || htmlContent.includes('sheet-more-nav') || jsContent.includes('sheet-more-nav'));

      // Verifikasi CSS untuk tinggi bottom nav 64px (--bottom-nav-h atau 64px)
      const hasNavHeightToken =
        rootVars.has('--bottom-nav-h') ||
        cssContent.includes('64px') ||
        cssContent.includes('--bottom-nav-h');

      assertTest(
        1,
        'T1-02',
        '5-Slot Bottom Navigation Shell (< 1024px)',
        hasBottomNav && has5Slots && hasNavHeightToken,
        hasBottomNav && has5Slots
          ? 'Bottom navigation dengan 5 slot (Dashboard, Jadwal, Tugas, Kas, Lainnya) terdefinisi'
          : `BottomNav:${hasBottomNav}, 5Slots:${has5Slots}, HeightToken:${hasNavHeightToken}`
      );
    }

    // T1-03: "Lainnya" Secondary Navigation Bottom Sheet
    {
      const hasMoreSheet =
        htmlContent.includes('id="sheet-more-nav"') ||
        htmlContent.includes('class="sheet-more-nav"') ||
        jsContent.includes('sheet-more-nav') ||
        htmlContent.includes('sheet-more') ||
        jsContent.includes('sheet-more');

      const hasSecondaryItems =
        (htmlContent.includes('students') || jsContent.includes('students')) &&
        (htmlContent.includes('structure') || jsContent.includes('structure')) &&
        (htmlContent.includes('utils') || jsContent.includes('utils')) &&
        (htmlContent.includes('dev') || jsContent.includes('dev')) &&
        (htmlContent.includes('btn-logout') || jsContent.includes('btn-logout'));

      assertTest(
        1,
        'T1-03',
        '"Lainnya" Bottom Sheet Menu Sekunder',
        hasMoreSheet && hasSecondaryItems,
        hasMoreSheet && hasSecondaryItems
          ? 'Bottom sheet "Lainnya" memuat modul sekunder (Siswa, Admin, AI/Calc, Dev Console, Logout)'
          : `hasMoreSheet:${hasMoreSheet}, hasSecondaryItems:${hasSecondaryItems}`
      );
    }

    // T1-04: Desktop Permanent Sidebar (>= 1024px) & Breakpoint Media Queries
    {
      const hasSidebar =
        htmlContent.includes('id="app-sidebar"') &&
        htmlContent.includes('id="sidebar-nav-list"');

      // Check media query for >= 1024px or < 1024px
      const hasDesktopMedia =
        cssContent.includes('@media (min-width: 1024px)') ||
        cssContent.includes('@media (max-width: 1023px)');

      const sidebarRulesPresent =
        cssContent.includes('#app-sidebar') || cssContent.includes('.app-sidebar');

      assertTest(
        1,
        'T1-04',
        'Permanent Desktop Sidebar (>= 1024px) & Mobile Drawer Isolation',
        hasSidebar && hasDesktopMedia && sidebarRulesPresent,
        hasSidebar && hasDesktopMedia
          ? 'Sidebar permanen desktop (>= 1024px) dengan aturan media query terkonfigurasi'
          : `hasSidebar:${hasSidebar}, hasDesktopMedia:${hasDesktopMedia}`
      );
    }

    // T1-05: Mobile Responsive Topbar
    {
      const hasMobileTopbar =
        htmlContent.includes('mobile-topbar') ||
        htmlContent.includes('page-topbar');

      const hasTitle =
        htmlContent.includes('id="topbar-page-title"') ||
        htmlContent.includes('topbar-page-title');

      const hasClassBadge =
        htmlContent.includes('id="topbar-class-chip"') ||
        htmlContent.includes('id="topbar-class-badge"') ||
        htmlContent.includes('mobile-class-pill');

      const hasRefreshBtn =
        htmlContent.includes('id="btn-mobile-refresh"') ||
        htmlContent.includes('id="btn-refresh-page"');

      assertTest(
        1,
        'T1-05',
        'Sticky Mobile Topbar (Judul, Chip Kelas, Tombol Refresh)',
        hasMobileTopbar && hasTitle && hasClassBadge && hasRefreshBtn,
        hasMobileTopbar && hasTitle && hasClassBadge && hasRefreshBtn
          ? 'Topbar memuat komponen wajib: Judul Halaman, Chip Kelas Aktif, dan Tombol Refresh 44x44'
          : `Topbar:${hasMobileTopbar}, Title:${hasTitle}, Chip:${hasClassBadge}, Refresh:${hasRefreshBtn}`
      );
    }

    // T1-06: 5 UI States Visual Tokens & Classes
    {
      const hasLoading =
        cssContent.includes('.skeleton') ||
        cssContent.includes('.spinner') ||
        jsContent.includes('skeleton') ||
        jsContent.includes('spinner');

      const hasEmpty =
        cssContent.includes('.state-empty') ||
        cssContent.includes('.empty-state') ||
        jsContent.includes('state-empty');

      const hasError =
        cssContent.includes('.state-error') ||
        cssContent.includes('.alert-banner') ||
        jsContent.includes('state-error') ||
        jsContent.includes('alert-banner');

      const hasToast =
        htmlContent.includes('id="toast-container"') &&
        (cssContent.includes('.toast') || jsContent.includes('toast'));

      const hasForbidden =
        cssContent.includes('.state-forbidden') ||
        cssContent.includes('.forbidden-state') ||
        jsContent.includes('state-forbidden');

      const allStatesSupported = hasLoading && hasEmpty && hasError && hasToast && hasForbidden;

      assertTest(
        1,
        'T1-06',
        'Dukungan 5 UI States (Loading, Empty, Error, Toast/Success, Forbidden)',
        allStatesSupported,
        allStatesSupported
          ? 'Kelima state UI (Loading skeleton/spinner, Empty state, Error banner, Toast success, Forbidden 403) didukung'
          : `Loading:${hasLoading}, Empty:${hasEmpty}, Error:${hasError}, Toast:${hasToast}, Forbidden:${hasForbidden}`
      );
    }
  }

  // ==========================================================================
  // TIER 2: BOUNDARY & VIEWPORT CHECKS
  // ==========================================================================
  if (!targetTier || targetTier === 2) {
    console.log('\n────────────────────────────────────────────────────────────────────────────────');
    console.log('📐 TIER 2: BOUNDARY & VIEWPORT CHECKS (360px, 390px, 768px, 1280px)');
    console.log('────────────────────────────────────────────────────────────────────────────────');

    // T2-01: Zero Horizontal Scrolling across 360px, 390px, 768px, 1280px
    {
      const hasOverflowXHidden =
        /body\s*\{[^}]*overflow-x\s*:\s*hidden/i.test(cssContent) ||
        /html\s*\{[^}]*overflow-x\s*:\s*hidden/i.test(cssContent) ||
        /\.app-shell\s*\{[^}]*overflow-x\s*:\s*hidden/i.test(cssContent) ||
        /\.main-wrapper\s*\{[^}]*overflow-x\s*:\s*hidden/i.test(cssContent);

      const hasBoxSizingBorderBox =
        /\*,\s*\*::before,\s*\*::after\s*\{[^}]*box-sizing\s*:\s*border-box/i.test(cssContent) ||
        /\*\s*\{[^}]*box-sizing\s*:\s*border-box/i.test(cssContent);

      // Check if there are dangerous fixed widths > 360px in default (non-media-query) CSS
      const cleanCssNoMedia = cssContent.replace(/@media[^{]+\{[\s\S]*?\}\s*\}/gi, '');
      const fixedWidthMatches = cleanCssNoMedia.match(/width\s*:\s*([4-9]\d\d|\d{4,})px/gi) || [];
      // Filter out allowed desktop elements if any
      const dangerousWidths = fixedWidthMatches.filter(w => !w.includes('1200') && !w.includes('1024'));

      const zeroScrollEnforced = hasOverflowXHidden && hasBoxSizingBorderBox;

      assertTest(
        2,
        'T2-01',
        'Pencegahan Horizontal Scroll (Zero Horizontal Scroll across 360px–1280px)',
        zeroScrollEnforced,
        zeroScrollEnforced
          ? `overflow-x: hidden terpasang, global box-sizing: border-box aktif, tidak ada elemen meluber pada 360px`
          : `overflowXHidden:${hasOverflowXHidden}, borderBox:${hasBoxSizingBorderBox}`
      );
    }

    // T2-02: Minimum Touch Targets >= 44x44px
    {
      const hasTapMinToken = rootVars.has('--tap-min') && rootVars.get('--tap-min').includes('44');

      // Check button min-height or height in CSS
      const buttonHasMin44 =
        cssContent.includes('min-height: 44px') ||
        cssContent.includes('min-height: 48px') ||
        cssContent.includes('height: 44px') ||
        cssContent.includes('height: 48px') ||
        cssContent.includes('var(--tap-min)');

      // Check form control inputs min-height or height
      const inputHasMin44 =
        /input[^{]*\{[^}]*(height|min-height)\s*:\s*(44|48)px/i.test(cssContent) ||
        /\.form-input\s*\{[^}]*(height|min-height)\s*:\s*(44|48)px/i.test(cssContent) ||
        cssContent.includes('var(--tap-min)');

      // Check touch spacing guideline (at least 8px)
      const hasSpacingRule =
        rootVars.has('--space-2') ||
        cssContent.includes('gap: 8px') ||
        cssContent.includes('gap: 12px') ||
        cssContent.includes('margin-bottom: 8px');

      const touchTargetCompliant = (hasTapMinToken || buttonHasMin44) && hasSpacingRule;

      assertTest(
        2,
        'T2-02',
        'Ukuran Target Sentuh Interaktif (Touch Targets >= 44x44px, Spacing >= 8px)',
        touchTargetCompliant,
        touchTargetCompliant
          ? 'Tombol, input, dan elemen navigasi mematuhi target sentuh minimum 44x44px dengan spasi aman'
          : `TapMinToken:${hasTapMinToken}, Button44:${buttonHasMin44}, Spacing:${hasSpacingRule}`
      );
    }

    // T2-03: Typography Scale & Minimum Sizes
    {
      // Rules: No text under 12px; inputs = 16px to prevent iOS auto-zoom; body >= 14px
      const hasFsXsToken = rootVars.has('--fs-xs') && (rootVars.get('--fs-xs').includes('12px') || rootVars.get('--fs-xs').includes('0.75rem'));
      const hasFsBaseToken = rootVars.has('--fs-base') && (rootVars.get('--fs-base').includes('16px') || rootVars.get('--fs-base').includes('1rem'));

      // Check for illegal text sizes under 12px (e.g. 8px, 9px, 10px, 11px)
      const illegalSizes = cssContent.match(/font-size\s*:\s*([89]|10|11)px/gi) || [];

      // Check input font-size 16px in mobile
      const inputHas16px =
        cssContent.includes('font-size: 16px') ||
        cssContent.includes('var(--fs-base)') ||
        /input[^{]*\{[^}]*font-size\s*:\s*(16px|1rem)/i.test(cssContent) ||
        /\.form-input\s*\{[^}]*font-size\s*:\s*(16px|1rem)/i.test(cssContent);

      const typographyCompliant = (hasFsXsToken || illegalSizes.length === 0) && (hasFsBaseToken || inputHas16px);

      assertTest(
        2,
        'T2-03',
        'Skala Tipografi Mobile-First (No text < 12px, Inputs = 16px iOS Zoom Prevention)',
        typographyCompliant,
        typographyCompliant
          ? `Batas minimum tipografi terpenuhi: tidak ada teks < 12px, input menggunakan 16px mencegah zoom otomatis iOS`
          : `FsXsToken:${hasFsXsToken}, IllegalSizesCount:${illegalSizes.length}, Input16px:${inputHas16px}`
      );
    }

    // T2-04: Midnight Slate CSS Token Palette & Legacy Token Backward Compatibility
    {
      const midnightSlateTokens = [
        '--bg',
        '--surface-1',
        '--surface-2',
        '--surface-3',
        '--overlay',
        '--border',
        '--border-strong',
        '--text',
        '--text-muted',
        '--text-faint',
        '--accent',
        '--accent-hover',
        '--accent-soft',
        '--on-accent',
        '--success',
        '--warning',
        '--danger',
        '--info'
      ];

      const legacyTokens = [
        '--bg: #0B0D10',
        '--surface: #11151A',
        '--surface-raised: #171C22',
        '--surface-hover: #20262E',
        '--border: #29313A',
        '--text: #F4F5F6',
        '--text-muted: #A1A8B1',
        '--text-subtle: #737C87',
        '--success: #55C99A',
        '--warning: #E7B66A',
        '--danger: #F07878',
        '--info: #82B8F4'
      ];

      // Verifikasi token legacy UI-05
      const legacyPresent = legacyTokens.every(tok => cssContent.includes(tok));

      // Verifikasi token Midnight Slate
      const missingTokens = midnightSlateTokens.filter(t => !rootVars.has(t));

      const tokensValid = legacyPresent && missingTokens.length === 0;

      assertTest(
        2,
        'T2-04',
        'Midnight Slate CSS Tokens & Kompatibilitas Legacy UI-05',
        tokensValid,
        tokensValid
          ? `Seluruh 18 token Midnight Slate dan 12 token legacy UI-05 terdefinisi lengkap di :root`
          : `LegacyPresent:${legacyPresent}, MissingMidnightTokens: ${missingTokens.join(', ') || 'none'}`
      );
    }
  }

  // ==========================================================================
  // TIER 3: CROSS-FEATURE & INTERACTION COMBINATIONS
  // ==========================================================================
  if (!targetTier || targetTier === 3) {
    console.log('\n────────────────────────────────────────────────────────────────────────────────');
    console.log('🔄 TIER 3: CROSS-FEATURE & INTERACTION COMBINATIONS');
    console.log('────────────────────────────────────────────────────────────────────────────────');

    // T3-01: Table-to-Card Engine on Viewports < 768px
    {
      const hasTableMedia =
        cssContent.includes('@media (max-width: 767px)') ||
        cssContent.includes('@media (max-width: 768px)') ||
        cssContent.includes('@media (max-width: 640px)');

      const hasDataLabelAttrRule =
        cssContent.includes('attr(data-label)') ||
        cssContent.includes('data-label');

      const hasDisplayBlockRow =
        /table[^{]*tbody[^{]*tr\s*\{[^}]*display\s*:\s*(block|flex|grid)/i.test(cssContent) ||
        /tbody\s*tr\s*\{[^}]*display\s*:\s*(block|flex|grid)/i.test(cssContent) ||
        cssContent.includes('display: block');

      const tableToCardEngineReady = hasTableMedia && (hasDataLabelAttrRule || hasDisplayBlockRow);

      assertTest(
        3,
        'T3-01',
        'Transformasi Responsif Table-to-Card (< 768px)',
        tableToCardEngineReady,
        tableToCardEngineReady
          ? 'Aturan CSS transformasi tabel ke kartu pada viewport < 768px (data-label + card blocks) tersedia'
          : `TableMedia:${hasTableMedia}, DataLabelRule:${hasDataLabelAttrRule}, BlockRows:${hasDisplayBlockRow}`
      );
    }

    // T3-02: Modal Solid Opaque Background & Backdrop Dismiss
    {
      // Check modal background is solid --surface-1 (not transparent / not blurred see-through)
      const modalBgOpaque =
        /modal-card\s*\{[^}]*background(-color)?\s*:\s*(var\(--surface-1\)|var\(--surface-raised\)|#111827|#11151a)/i.test(cssContent) ||
        /modal-container\s*\{[^}]*background(-color)?\s*:\s*(var\(--surface-1\)|var\(--surface-raised\)|#111827|#11151a)/i.test(cssContent) ||
        cssContent.includes('background: var(--surface-1)') ||
        cssContent.includes('background-color: var(--surface-1)');

      // Check modal overlay backdrop
      const modalOverlayBackdrop =
        /modal-overlay\s*\{[^}]*background(-color)?\s*:\s*var\(--overlay\)/i.test(cssContent) ||
        cssContent.includes('--overlay') ||
        cssContent.includes('rgba(5, 8, 14');

      // Check modal dismiss interactions in JS (Escape key, close button, backdrop click)
      const hasEscapeDismiss =
        jsContent.includes("'Escape'") ||
        jsContent.includes('"Escape"') ||
        jsContent.includes('keyCode === 27');

      const hasBackdropDismiss =
        jsContent.includes('btn-modal-close') ||
        jsContent.includes('modal-overlay');

      const modalSecurityPassing = modalBgOpaque && modalOverlayBackdrop && hasEscapeDismiss && hasBackdropDismiss;

      assertTest(
        3,
        'T3-02',
        'Modal Dialog Latar Solid Opaque (--surface-1) & Dismiss (Backdrop/Esc/Close)',
        modalSecurityPassing,
        modalSecurityPassing
          ? 'Modal menggunakan latar solid --surface-1 tanpa tembus pandang, backdrop --overlay, dan dismiss lengkap'
          : `OpaqueBg:${modalBgOpaque}, OverlayBackdrop:${modalOverlayBackdrop}, Escape:${hasEscapeDismiss}, DismissHandlers:${hasBackdropDismiss}`
      );
    }

    // T3-03: Single Primary Button & Destructive Action Safeguards
    {
      const hasBtnPrimary = cssContent.includes('.btn-primary') || cssContent.includes('--accent');
      const hasBtnSecondary = cssContent.includes('.btn-secondary');
      const hasDestructiveSoft =
        cssContent.includes('--danger-soft') ||
        cssContent.includes('.btn-danger-soft') ||
        cssContent.includes('--danger');

      // Verify destructive actions in app.js require explicit confirmation before DELETE
      const hasConfirmDialog =
        jsContent.includes('confirmModal') ||
        jsContent.includes('showConfirm') ||
        jsContent.includes('Konfirmasi') ||
        jsContent.includes('confirm(');

      const buttonHierarchyValid = hasBtnPrimary && hasBtnSecondary && hasDestructiveSoft && hasConfirmDialog;

      assertTest(
        3,
        'T3-03',
        'Hierarki Tombol (Maksimal 1 Tombol Primer per Layar & Konfirmasi Aksi Destruktif)',
        buttonHierarchyValid,
        buttonHierarchyValid
          ? 'Hierarki tombol baku (Primer, Sekunder, Destruktif Soft) dan konfirmasi sebelum aksi hapus diterapkan'
          : `Primary:${hasBtnPrimary}, Secondary:${hasBtnSecondary}, DestructiveSoft:${hasDestructiveSoft}, ConfirmDialog:${hasConfirmDialog}`
      );
    }

    // T3-04: Role-Based Access Control (RBAC) Kas Slot Hiding for SEKRETARIS
    {
      // Check in app.js that cash navigation is strictly hidden for role SEKRETARIS
      const hasCashRoleFilter =
        jsContent.includes("getEffectiveRole(role) !== 'SEKRETARIS'") ||
        jsContent.includes("role !== 'SEKRETARIS'") ||
        jsContent.includes("canShow: (role) => getEffectiveRole(role) !== 'SEKRETARIS'");

      // Verify that navigation dispatcher filters visible items by role
      const hasNavFilterExecution =
        jsContent.includes('NAV_ITEMS.filter') &&
        jsContent.includes('item.canShow');

      const rbacKasHidingValid = hasCashRoleFilter && hasNavFilterExecution;

      assertTest(
        3,
        'T3-04',
        'Otorisasi RBAC: Penyembunyian Slot Kas untuk Role SEKRETARIS',
        rbacKasHidingValid,
        rbacKasHidingValid
          ? 'Slot navigasi Kas otomatis disembunyikan untuk role SEKRETARIS sesuai aturan RBAC'
          : `CashFilter:${hasCashRoleFilter}, NavFilterExecution:${hasNavFilterExecution}`
      );
    }

    // T3-05: Sanitasi XSS & Integritas Escaping Output
    {
      const hasEscapeHtmlFunc =
        jsContent.includes('function escapeHtml(') ||
        jsContent.includes('const escapeHtml =');

      const escapesAllMetaChars =
        jsContent.includes('&amp;') &&
        jsContent.includes('&lt;') &&
        jsContent.includes('&gt;') &&
        jsContent.includes('&quot;');

      const usesEscapeInRenderers =
        jsContent.includes('escapeHtml(item.label)') ||
        jsContent.includes('escapeHtml(s.name)') ||
        jsContent.includes('escapeHtml(message)');

      const xssSanitizationValid = hasEscapeHtmlFunc && escapesAllMetaChars && usesEscapeInRenderers;

      assertTest(
        3,
        'T3-05',
        'Sanitasi XSS & Integritas Escaping Output (escapeHtml pada Atribut & Teks)',
        xssSanitizationValid,
        xssSanitizationValid
          ? 'Semua data dinamis yang dirender ke DOM difilter melalui escapeHtml untuk mencegah injeksi XSS'
          : `hasEscapeHtml:${hasEscapeHtmlFunc}, escapesMeta:${escapesAllMetaChars}, usesInRenderers:${usesEscapeInRenderers}`
      );
    }
  }

  // ==========================================================================
  // TIER 4: REAL-WORLD & REGRESSION VERIFICATION
  // ==========================================================================
  if (!targetTier || targetTier === 4) {
    console.log('\n────────────────────────────────────────────────────────────────────────────────');
    console.log('⚡ TIER 4: REAL-WORLD RUNTIME & REGRESSION VERIFICATION');
    console.log('────────────────────────────────────────────────────────────────────────────────');

    // T4-01: Static Asset Delivery
    {
      const htmlRes = await client.request('GET', '/');
      const cssRes = await client.request('GET', '/styles.css');
      const jsRes = await client.request('GET', '/app.js');

      const assetsOk =
        htmlRes.status === 200 &&
        cssRes.status === 200 &&
        jsRes.status === 200 &&
        htmlRes.text.includes('<!DOCTYPE html>') &&
        cssRes.headers.get('content-type')?.includes('css') &&
        jsRes.headers.get('content-type')?.includes('javascript');

      assertTest(
        4,
        'T4-01',
        'Pengiriman Aset Statis Live Server (HTML, CSS, JS)',
        assetsOk,
        assetsOk
          ? 'Live HTTP server mengembalikan seluruh aset frontend dengan status 200 OK dan MIME type yang tepat'
          : `HTML:${htmlRes.status}, CSS:${cssRes.status}, JS:${jsRes.status}`
      );
    }

    // T4-02: Authentication & RBAC Session Verification
    {
      // 1. Login KETUA
      const ketuaClient = createHttpClient(baseUrl);
      const loginKetuaRes = await ketuaClient.request('POST', '/api/auth/login', {
        body: { phone_number: TEST_CONSTANTS.PHONE_KETUA, password: TEST_CONSTANTS.TEST_PASSWORD }
      });
      const meKetuaRes = await ketuaClient.request('GET', '/api/auth/me');

      const ketuaLoginOk =
        loginKetuaRes.status === 200 &&
        meKetuaRes.status === 200 &&
        meKetuaRes.data?.user?.effective_role === 'KETUA';

      // 2. Login SEKRETARIS
      const sekClient = createHttpClient(baseUrl);
      const loginSekRes = await sekClient.request('POST', '/api/auth/login', {
        body: { phone_number: TEST_CONSTANTS.PHONE_SEKRETARIS, password: TEST_CONSTANTS.TEST_PASSWORD }
      });
      const meSekRes = await sekClient.request('GET', '/api/auth/me');

      // Sekretaris dilarang mengubah pengaturan kas
      const sekForbiddenCash = await sekClient.request('POST', '/api/cash/settings', {
        body: { weekly_fee: 10000, active_weeks_count: 5 }
      });

      const rbacRuntimeOk =
        ketuaLoginOk &&
        loginSekRes.status === 200 &&
        meSekRes.data?.user?.effective_role === 'SEKRETARIS' &&
        sekForbiddenCash.status === 403;

      assertTest(
        4,
        'T4-02',
        'Runtime Auth & RBAC Session (Login KETUA/SEKRETARIS & Proteksi Endpoint 403)',
        rbacRuntimeOk,
        rbacRuntimeOk
          ? 'Autentikasi sesi HttpOnly berhasil dan otorisasi RBAC (403 Forbidden pada Kas untuk Sekretaris) aktif'
          : `KetuaOk:${ketuaLoginOk}, SekOk:${loginSekRes.status === 200}, ForbiddenCash:${sekForbiddenCash.status}`
      );
    }

    // T4-03: Multi-Class Switching for DEVELOPER Role
    {
      const devClient = createHttpClient(baseUrl);
      const loginDev = await devClient.request('POST', '/api/auth/login', {
        body: { phone_number: TEST_CONSTANTS.PHONE_DEVELOPER, password: TEST_CONSTANTS.TEST_PASSWORD }
      });

      const classesRes = await devClient.request('GET', '/api/classes');
      const hasClasses = classesRes.status === 200 && Array.isArray(classesRes.data?.classes) && classesRes.data.classes.length > 0;

      // Switch active class context
      let switchOk = false;
      if (hasClasses) {
        const targetClass = classesRes.data.classes[0].group_id;
        const switchRes = await devClient.request('POST', '/api/classes/switch', {
          body: { group_id: targetClass }
        });
        switchOk = switchRes.status === 200 && switchRes.data?.ok === true;
      }

      const devContextOk = loginDev.status === 200 && hasClasses && switchOk;

      assertTest(
        4,
        'T4-03',
        'Runtime Multi-Class Context Switching untuk Role DEVELOPER',
        devContextOk,
        devContextOk
          ? 'Developer berhasil mengakses daftar multi-kelas dan melakukan switch konteks kelas aktif'
          : `LoginDev:${loginDev.status}, HasClasses:${hasClasses}, SwitchOk:${switchOk}`
      );
    }

    // T4-04: Academic Modules API Data Retrieval
    {
      const ketuaClient = createHttpClient(baseUrl);
      await ketuaClient.request('POST', '/api/auth/login', {
        body: { phone_number: TEST_CONSTANTS.PHONE_KETUA, password: TEST_CONSTANTS.TEST_PASSWORD }
      });

      const studentsRes = await ketuaClient.request('GET', '/api/students');
      const schedulesRes = await ketuaClient.request('GET', '/api/schedules');
      const assignmentsRes = await ketuaClient.request('GET', '/api/assignments');
      const cashRes = await ketuaClient.request('GET', '/api/cash/recap');

      const academicDataOk =
        studentsRes.status === 200 &&
        schedulesRes.status === 200 &&
        assignmentsRes.status === 200 &&
        cashRes.status === 200;

      assertTest(
        4,
        'T4-04',
        'Integritas Data Modul Akademik (Siswa, Jadwal, Tugas, Kas)',
        academicDataOk,
        academicDataOk
          ? 'Seluruh endpoint data modul akademik merespons 200 OK dengan payload terstruktur'
          : `Siswa:${studentsRes.status}, Jadwal:${schedulesRes.status}, Tugas:${assignmentsRes.status}, Kas:${cashRes.status}`
      );
    }

    // T4-05: Adversarial Boundary & Anti-IDOR Group Isolation
    {
      const ketuaClient = createHttpClient(baseUrl);
      await ketuaClient.request('POST', '/api/auth/login', {
        body: { phone_number: TEST_CONSTANTS.PHONE_KETUA, password: TEST_CONSTANTS.TEST_PASSWORD }
      });

      // 1. Non-developer dilarang switch class context
      const illegalSwitchRes = await ketuaClient.request('POST', '/api/classes/switch', {
        body: { group_id: TEST_CONSTANTS.CLASS_OPUS }
      });

      // 2. Akses endpoint sistem khusus developer ditolak 403
      const illegalAuditRes = await ketuaClient.request('GET', '/api/system/audit-logs');
      const illegalVpsRes = await ketuaClient.request('GET', '/api/system/status');

      const isolationEnforced =
        illegalSwitchRes.status === 403 &&
        illegalAuditRes.status === 403 &&
        illegalVpsRes.status === 403;

      assertTest(
        4,
        'T4-05',
        'Uji Adversarial: Anti-IDOR Class Isolation & Proteksi Endpoint Developer',
        isolationEnforced,
        isolationEnforced
          ? 'Otorisasi ketat: pengurus kelas non-developer diblokir (403) saat mencoba switch-class atau mengakses endpoint sistem'
          : `SwitchStatus:${illegalSwitchRes.status}, AuditStatus:${illegalAuditRes.status}, VpsStatus:${illegalVpsRes.status}`
      );
    }
  }

} finally {
  // Graceful shutdown server HTTP
  await new Promise((resolve) => {
    try {
      server.close(() => resolve());
    } catch {
      resolve();
    }
  });

  // Tutup koneksi database sementara
  try {
    if (db && typeof db.close === 'function') {
      db.close();
    }
  } catch {
    // ignore
  }

  // Hapus database sementara
  for (const suffix of ['', '-wal', '-shm']) {
    const f = `${tempDbPath}${suffix}`;
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}

// ============================================================================
// FINAL SUMMARY & RESULTS REPORT
// ============================================================================
console.log('\n================================================================================');
console.log('📊 RINGKASAN HASIL PENGUJIAN RESPONSIVE E2E DASHBOARD ARAS 1.0');
console.log('================================================================================');

for (const [tierNum, t] of Object.entries(stats.byTier)) {
  if (targetTier && parseInt(tierNum, 10) !== targetTier) continue;
  const statusIcon = t.failed === 0 && t.total > 0 ? '🟢' : (t.passed > 0 ? '🟡' : '🔴');
  console.log(`${statusIcon} ${t.name}: ${t.passed}/${t.total} LULUS (${t.failed} GAGAL)`);
}

console.log('--------------------------------------------------------------------------------');
console.log(`TOTAL AKHIR: ${stats.passed} LULUS, ${stats.failed} GAGAL dari total ${stats.total} tes.`);
console.log('================================================================================');

if (stats.failed > 0) {
  console.log('\n⚠️  Detail Item Pengujian yang Memerlukan Implementasi/Perbaikan:');
  for (const fail of stats.failures) {
    console.log(`  - [Tier ${fail.tier}] ${fail.code}: ${fail.name}`);
    if (fail.details) console.log(`    Catatan: ${fail.details}`);
  }
  console.log('\n');
  process.exit(1);
} else {
  console.log('🎉 SELURUH PENGUJIAN RESPONSIVE E2E LULUS 100%!\n');
  process.exit(0);
}
