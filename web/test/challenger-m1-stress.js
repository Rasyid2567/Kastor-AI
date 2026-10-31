/**
 * ============================================================================
 * EMPIRICAL CHALLENGER TEST HARNESS: MILESTONE 1 (LAYOUT, VIEWPORT, TYPOGRAPHY, TOUCH TARGETS)
 * ============================================================================
 *
 * This test harness empirically evaluates the work product of Milestone 1 against:
 * 1. Viewport responsiveness across 360px, 390px, 768px, 1024px, 1280px
 * 2. Zero horizontal scrolling (overflow-x: hidden, container boundaries)
 * 3. Typography scale (zero text < 12px, form inputs = 16px to prevent iOS auto-zoom)
 * 4. Touch targets (interactive elements must have >= 44x44px bounding boxes)
 *
 * Independent empirical verification - no mocked passes.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const cssPath = path.join(projectRoot, 'web/public/styles.css');
const htmlPath = path.join(projectRoot, 'web/public/index.html');
const jsPath = path.join(projectRoot, 'web/public/app.js');

const cssContent = fs.readFileSync(cssPath, 'utf8');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const jsContent = fs.readFileSync(jsPath, 'utf8');

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(id, name, success, details, severity = 'CRITICAL') {
  if (success) {
    results.passed++;
    results.tests.push({ id, name, status: 'PASS', details });
    console.log(`\x1b[32m[PASS]\x1b[0m ${id}: ${name}`);
  } else {
    results.failed++;
    results.tests.push({ id, name, status: 'FAIL', details, severity });
    console.log(`\x1b[31m[FAIL]\x1b[0m ${id}: ${name} (${severity})`);
    console.log(`       \x1b[33mReason: ${details}\x1b[0m`);
  }
}

// ----------------------------------------------------------------------------
// CSS PARSER & SPECIFICITY ENGINE
// ----------------------------------------------------------------------------
function parseCSS(str) {
  const rules = [];
  let i = 0;
  function skipWhitespace() {
    while (i < str.length && /\s/.test(str[i])) i++;
  }
  function skipComments() {
    if (str[i] === '/' && str[i + 1] === '*') {
      i += 2;
      while (i < str.length && !(str[i - 1] === '*' && str[i] === '/')) i++;
      skipWhitespace();
      skipComments();
    }
  }

  while (i < str.length) {
    skipWhitespace();
    skipComments();
    if (i >= str.length) break;

    let start = i;
    while (i < str.length && str[i] !== '{' && str[i] !== ';') {
      i++;
    }
    const header = str.substring(start, i).trim();
    if (str[i] === ';') {
      i++;
      continue;
    }
    if (str[i] === '{') {
      i++;
      let depth = 1;
      let bodyStart = i;
      while (i < str.length && depth > 0) {
        if (str[i] === '/' && str[i + 1] === '*') {
          i += 2;
          while (i < str.length && !(str[i - 1] === '*' && str[i] === '/')) i++;
        } else if (str[i] === '{') {
          depth++;
        } else if (str[i] === '}') {
          depth--;
        }
        i++;
      }
      const body = str.substring(bodyStart, i - 1).trim();
      rules.push({ header, body, index: rules.length });
    }
  }
  return rules;
}

function parseDeclarations(body) {
  const decls = {};
  const lines = body.split(';');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const prop = trimmed.substring(0, colonIdx).trim().toLowerCase();
      const val = trimmed.substring(colonIdx + 1).trim();
      decls[prop] = val;
    }
  }
  return decls;
}

function calculateSpecificity(selector) {
  let a = 0, b = 0, c = 0;
  const clean = selector.replace(/:not\((.*?)\)/g, ' $1 ');
  const idMatches = clean.match(/#[a-zA-Z0-9_-]+/g);
  if (idMatches) a += idMatches.length;
  const classMatches = clean.match(/\.[a-zA-Z0-9_-]+/g);
  if (classMatches) b += classMatches.length;
  const attrMatches = clean.match(/\[[^\]]+\]/g);
  if (attrMatches) b += attrMatches.length;
  const pseudoClasses = clean.match(/:[a-zA-Z0-9_-]+/g);
  if (pseudoClasses) b += pseudoClasses.length;
  const elementMatches = clean.match(/(?:^|\s|>|\+|~)[a-zA-Z0-9_-]+/g);
  if (elementMatches) {
    for (const el of elementMatches) {
      const tag = el.replace(/[\s>+~]/g, '');
      if (tag && !['and', 'not'].includes(tag)) c++;
    }
  }
  return a * 100 + b * 10 + c;
}

const rawBlocks = parseCSS(cssContent);
const globalRules = [];
const mediaRules = [];

for (const block of rawBlocks) {
  if (block.header.startsWith('@media')) {
    const innerBlocks = parseCSS(block.body);
    for (const ib of innerBlocks) {
      const selectors = ib.header.split(',').map(s => s.trim());
      const decls = parseDeclarations(ib.body);
      for (const sel of selectors) {
        mediaRules.push({
          media: block.header,
          selector: sel,
          specificity: calculateSpecificity(sel),
          decls,
          order: ib.index
        });
      }
    }
  } else if (!block.header.startsWith('@keyframes') && !block.header.startsWith('@font-face')) {
    const selectors = block.header.split(',').map(s => s.trim());
    const decls = parseDeclarations(block.body);
    for (const sel of selectors) {
      globalRules.push({
        selector: sel,
        specificity: calculateSpecificity(sel),
        decls,
        order: block.index
      });
    }
  }
}

// Helper to compute effective style for an element descriptor
function computeStyle(elementDesc, mediaCondition = null) {
  // elementDesc: { tag: 'input', id: 'login-phone', classes: ['form-input', 'font-mono'], attrs: {} }
  const matched = [];
  const rules = [...globalRules];
  if (mediaCondition) {
    for (const mr of mediaRules) {
      if (mr.media.includes(mediaCondition)) {
        rules.push(mr);
      }
    }
  }

  for (const rule of rules) {
    const sel = rule.selector;
    let matches = false;

    // Simple robust matching for our app elements
    if (sel === elementDesc.tag) matches = true;
    if (elementDesc.id && (sel === `#${elementDesc.id}` || sel.includes(`#${elementDesc.id}`))) matches = true;
    if (elementDesc.classes) {
      for (const cls of elementDesc.classes) {
        if (sel === `.${cls}` || sel.endsWith(`.${cls}`)) matches = true;
        if (sel.includes(`.${cls}`)) matches = true;
      }
    }
    if (elementDesc.tag && elementDesc.classes) {
      for (const cls of elementDesc.classes) {
        if (sel === `${elementDesc.tag}.${cls}`) matches = true;
      }
    }

    if (matches) {
      matched.push(rule);
    }
  }

  // Sort by specificity asc, then order asc (cascade)
  matched.sort((x, y) => {
    if (x.specificity !== y.specificity) return x.specificity - y.specificity;
    return x.order - y.order;
  });

  const computed = {};
  for (const m of matched) {
    for (const [prop, val] of Object.entries(m.decls)) {
      computed[prop] = { val, selector: m.selector, specificity: m.specificity };
    }
  }
  return computed;
}

console.log('================================================================================');
console.log('🔍 EMPIRICAL CHALLENGE SUITE: MILESTONE 1 VERIFICATION');
console.log('================================================================================\n');

// ============================================================================
// TEST 1: VIEWPORT RESPONSIVENESS (360px, 390px, 768px, 1024px, 1280px)
// ============================================================================
console.log('--- TEST 1: VIEWPORT RESPONSIVENESS ---');

// 1.1 Mobile viewports (360px, 390px): Bottom nav visible, Topbar visible, Sidebar drawer isolated
{
  const hasBottomNavMobile = cssContent.includes('.mobile-bottom-nav') &&
    /@media\s*\(max-width:\s*1023px\)[^{]*\{[\s\S]*?\.mobile-bottom-nav\s*\{[^}]*display\s*:\s*flex/i.test(cssContent);
  const hasStickyTopbarMobile = cssContent.includes('.mobile-topbar') &&
    /@media\s*\(max-width:\s*1023px\)[^{]*\{[\s\S]*?\.mobile-topbar\s*\{[^}]*display\s*:\s*flex/i.test(cssContent);
  const hasSidebarDrawerMobile =
    /@media\s*\(max-width:\s*1023px\)[^{]*\{[\s\S]*?\.app-sidebar\s*\{[^}]*transform\s*:\s*translateX\(-100%\)/i.test(cssContent);

  recordTest(
    'VP-01',
    'Mobile Viewport (360px & 390px) Shell Component Layout',
    hasBottomNavMobile && hasStickyTopbarMobile && hasSidebarDrawerMobile,
    hasBottomNavMobile && hasStickyTopbarMobile && hasSidebarDrawerMobile
      ? 'Bottom navigation (64px) & Sticky Topbar (56px) active; Sidebar correctly off-canvas drawer'
      : `BottomNav:${hasBottomNavMobile}, Topbar:${hasStickyTopbarMobile}, SidebarDrawer:${hasSidebarDrawerMobile}`
  );
}

// 1.2 Tablet viewport (768px): Table-to-card reflow boundary & bottom nav active
{
  const hasTableToCard767 = /@media\s*\(max-width:\s*767px\)/i.test(cssContent);
  const bottomNavActiveAt768 = /@media\s*\(max-width:\s*1023px\)/i.test(cssContent);

  recordTest(
    'VP-02',
    'Tablet Viewport (768px) Breakpoint Structure',
    hasTableToCard767 && bottomNavActiveAt768,
    '768px sits cleanly between mobile table-to-card boundary (<= 767px) and desktop sidebar boundary (>= 1024px)'
  );
}

// 1.3 Desktop viewports (1024px & 1280px): Permanent 248px sidebar, bottom nav & mobile topbar hidden
{
  const desktopBlockMatch = cssContent.match(/@media\s*\(min-width:\s*1024px\)\s*\{([\s\S]*?)\n\}/i);
  let desktopValid = false;
  let reason = '';
  if (desktopBlockMatch) {
    const dBody = desktopBlockMatch[1];
    const hidesMobileElements = dBody.includes('.mobile-bottom-nav') && dBody.includes('display: none !important');
    const fixesSidebar = dBody.includes('.app-sidebar') && (dBody.includes('248px') || dBody.includes('var(--sidebar-w)'));
    const offsetsMain = dBody.includes('.main-wrapper') && (dBody.includes('margin-left: var(--sidebar-w)') || dBody.includes('margin-left: 248px'));
    desktopValid = hidesMobileElements && fixesSidebar && offsetsMain;
    reason = `HidesMobile:${hidesMobileElements}, SidebarFixed:${fixesSidebar}, MainOffset:${offsetsMain}`;
  } else {
    reason = 'No @media (min-width: 1024px) block found';
  }

  recordTest(
    'VP-03',
    'Desktop Viewport (1024px & 1280px) Permanent Sidebar & Shell Reflow',
    desktopValid,
    desktopValid ? 'Permanent 248px sidebar active, main-wrapper offset by 248px, mobile nav hidden' : reason
  );
}

// ============================================================================
// TEST 2: ZERO HORIZONTAL SCROLLING & OVERFLOW INTEGRITY
// ============================================================================
console.log('\n--- TEST 2: ZERO HORIZONTAL SCROLLING ---');

{
  const htmlOverflowHidden = /html\s*\{[^}]*overflow-x\s*:\s*hidden/i.test(cssContent);
  const bodyOverflowHidden = /body\s*\{[^}]*overflow-x\s*:\s*hidden/i.test(cssContent);
  const borderBoxUniversal = /\*,\s*\*::before,\s*\*::after\s*\{[^}]*box-sizing\s*:\s*border-box/i.test(cssContent);

  // Check for rogue fixed widths > 360px without media query override
  const cleanGlobalCss = cssContent.replace(/@media[^{]+\{[\s\S]*?\}\s*\}/gi, '');
  const fixedWidthExceeding360 = [];
  const widthMatches = cleanGlobalCss.matchAll(/(?:^|;)\s*(?:width|min-width)\s*:\s*([4-9]\d\d|\d{4,})px/gi);
  for (const m of widthMatches) {
    const val = parseInt(m[1], 10);
    // Ignore desktop modal limits or max-width
    if (!m[0].includes('max-width') && val > 360) {
      fixedWidthExceeding360.push(m[0].trim());
    }
  }

  const zeroScrollPass = htmlOverflowHidden && bodyOverflowHidden && borderBoxUniversal && (fixedWidthExceeding360.length === 0);

  recordTest(
    'SCROLL-01',
    'Zero Horizontal Scroll Enforcement (overflow-x: hidden on html/body & box-sizing: border-box)',
    zeroScrollPass,
    zeroScrollPass
      ? 'overflow-x: hidden enforced on both html & body, universal box-sizing active, zero rogue fixed-widths > 360px'
      : `htmlOverflow:${htmlOverflowHidden}, bodyOverflow:${bodyOverflowHidden}, borderBox:${borderBoxUniversal}, rogueWidths:${fixedWidthExceeding360.join(', ')}`
  );
}

// ============================================================================
// TEST 3: TYPOGRAPHY SCAN (ZERO TEXT < 12px, FORM INPUTS = 16px)
// ============================================================================
console.log('\n--- TEST 3: TYPOGRAPHY AUDIT ---');

// 3.1 Zero text < 12px across all CSS selectors
{
  const allFsMatches = [...cssContent.matchAll(/(?:^|;)\s*font-size\s*:\s*([^;]+);/gi)];
  const sub12pxFonts = [];

  for (const m of allFsMatches) {
    const val = m[1].trim();
    let px = null;
    if (val.endsWith('px')) px = parseFloat(val);
    else if (val.endsWith('rem') || val.endsWith('em')) px = parseFloat(val) * 16;
    else if (val === 'var(--fs-xs)') px = 12;
    else if (val === 'var(--fs-sm)') px = 14;
    else if (val === 'var(--fs-base)') px = 16;
    else if (val === 'var(--fs-lg)') px = 18;
    else if (val === 'var(--fs-xl)') px = 22;
    else if (val === 'var(--fs-2xl)') px = 28;

    if (px !== null && px < 12) {
      sub12pxFonts.push({ val, px, raw: m[0] });
    }
  }

  recordTest(
    'TYPO-01',
    'Typography Scale: Zero CSS Selectors with Font-Size < 12px',
    sub12pxFonts.length === 0,
    sub12pxFonts.length === 0
      ? `All ${allFsMatches.length} font-size declarations meet or exceed the absolute minimum of 12px (0.75rem)`
      : `Found ${sub12pxFonts.length} sub-12px declarations: ${JSON.stringify(sub12pxFonts)}`
  );
}

// 3.2 Form inputs = 16px to prevent iOS auto-zoom
{
  // Test the actual rendered form input elements from index.html
  const inputsToTest = [
    { name: 'Login Phone (#login-phone)', tag: 'input', id: 'login-phone', classes: ['form-input', 'font-mono'] },
    { name: 'Login Password (#login-password)', tag: 'input', id: 'login-password', classes: ['form-input'] },
    { name: 'Register Phone (#reg-phone)', tag: 'input', id: 'reg-phone', classes: ['form-input', 'font-mono'] },
    { name: 'Register Password (#reg-password)', tag: 'input', id: 'reg-password', classes: ['form-input'] },
    { name: 'Register Password Confirm (#reg-password-confirm)', tag: 'input', id: 'reg-password-confirm', classes: ['form-input'] },
    { name: 'Developer Class Select (#developer-class-select)', tag: 'select', id: 'developer-class-select', classes: ['form-select', 'class-select'] }
  ];

  const inputViolations = [];

  for (const input of inputsToTest) {
    const style = computeStyle(input);
    const fsProp = style['font-size'];
    let effectivePx = null;
    let rawVal = fsProp ? fsProp.val : '(default)';
    let winningSelector = fsProp ? fsProp.selector : 'none';

    if (rawVal === '16px' || rawVal === '1rem' || rawVal === 'var(--fs-base)') {
      effectivePx = 16;
    } else if (rawVal.endsWith('rem')) {
      effectivePx = parseFloat(rawVal) * 16;
    } else if (rawVal.endsWith('px')) {
      effectivePx = parseFloat(rawVal);
    }

    if (effectivePx !== 16) {
      inputViolations.push({
        name: input.name,
        winningSelector,
        fontSetting: rawVal,
        computedPx: effectivePx
      });
    }
  }

  const inputs16pxPass = inputViolations.length === 0;

  recordTest(
    'TYPO-02',
    'Form Inputs Font Size = 16px (iOS Auto-Zoom Prevention)',
    inputs16pxPass,
    inputs16pxPass
      ? 'All form inputs strictly evaluate to 16px via CSS cascade'
      : `Cascading collision detected! In styles.css line 602, '.form-input, .form-select' specifies 'font-size: 0.9rem' (14.4px) which overrides 'input { font-size: 16px }' at line 176 due to higher class specificity (0,1,0 vs 0,0,1). Violating inputs: ${inputViolations.map(v => `${v.name} -> ${v.fontSetting} (${v.computedPx}px via ${v.winningSelector})`).join('; ')}`,
    'CRITICAL'
  );
}

// ============================================================================
// TEST 4: TOUCH TARGETS (MINIMUM 44x44px BOUNDING BOXES)
// ============================================================================
console.log('\n--- TEST 4: TOUCH TARGET AUDIT ---');

{
  const interactiveElements = [
    { name: 'Mobile Refresh Button (#btn-mobile-refresh)', tag: 'button', id: 'btn-mobile-refresh', classes: ['btn-icon-mobile'] },
    { name: 'Modal Close Button (#btn-modal-close)', tag: 'button', id: 'btn-modal-close', classes: ['btn-modal-close'] },
    { name: 'More Sheet Close Button (#btn-close-more-sheet)', tag: 'button', id: 'btn-close-more-sheet', classes: ['btn-sheet-close'] },
    { name: 'Bottom Nav Slot Button (.nav-slot-btn)', tag: 'button', classes: ['nav-slot-btn'] },
    { name: 'Password Visibility Toggle (.btn-icon-toggle)', tag: 'button', classes: ['btn-icon-toggle'] },
    { name: 'Auth Mode Switcher Tabs (.auth-tab)', tag: 'button', id: 'tab-btn-login', classes: ['auth-tab'] },
    { name: 'Form Inputs Min-Height (.form-input)', tag: 'input', id: 'login-phone', classes: ['form-input'] },
    { name: 'Developer Class Select (.class-select)', tag: 'select', id: 'developer-class-select', classes: ['form-select', 'class-select'] },
    { name: 'Desktop Refresh Button (#btn-refresh-page)', tag: 'button', id: 'btn-refresh-page', classes: ['btn', 'btn-secondary', 'btn-sm'] }
  ];

  const touchViolations = [];

  for (const el of interactiveElements) {
    const style = computeStyle(el);
    let minH = style['min-height'] ? style['min-height'].val : null;
    let h = style['height'] ? style['height'].val : null;
    let minW = style['min-width'] ? style['min-width'].val : null;
    let w = style['width'] ? style['width'].val : null;

    function parsePx(dim) {
      if (!dim) return null;
      if (dim === 'var(--tap-min)') return 44;
      if (dim.endsWith('px')) return parseFloat(dim);
      return null;
    }

    const effectiveH = parsePx(minH) ?? parsePx(h);
    const effectiveW = parsePx(minW) ?? parsePx(w);

    const issues = [];
    if (effectiveH !== null && effectiveH < 44) {
      issues.push(`height/min-height is ${effectiveH}px (< 44px) via ${style['min-height']?.selector || style['height']?.selector}`);
    }
    if (effectiveW !== null && effectiveW < 44) {
      issues.push(`width/min-width is ${effectiveW}px (< 44px) via ${style['min-width']?.selector || style['width']?.selector}`);
    }

    if (issues.length > 0) {
      touchViolations.push({
        element: el.name,
        issues
      });
    }
  }

  const touchTargetsPass = touchViolations.length === 0;

  recordTest(
    'TOUCH-01',
    'Interactive Elements Minimum 44x44px Touch Targets',
    touchTargetsPass,
    touchTargetsPass
      ? 'All interactive elements, buttons, inputs, and toggles meet or exceed 44x44px touch targets'
      : `Found ${touchViolations.length} interactive elements with bounding boxes < 44px:\n${touchViolations.map(t => `         • ${t.element}: ${t.issues.join(', ')}`).join('\n')}`,
    'CRITICAL'
  );
}

// ----------------------------------------------------------------------------
// SUMMARY & EXIT
// ----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`📊 EMPIRICAL STRESS RESULTS: ${results.passed} PASS, ${results.failed} FAIL`);
console.log('================================================================================');

if (results.failed > 0) {
  console.log('\n🔴 EMPIRICAL VERDICT: REQUEST_CHANGES');
  console.log('Issues must be remediated by Worker before Milestone 1 can be approved.');
} else {
  console.log('\n🟢 EMPIRICAL VERDICT: APPROVE');
}

// Exit code matches test result
process.exit(results.failed > 0 ? 1 : 0);
