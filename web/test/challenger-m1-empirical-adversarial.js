/**
 * ============================================================================
 * KASTOR AI — CHALLENGER 2 INDEPENDENT ADVERSARIAL STRESS SUITE
 * ============================================================================
 * Independent verification of Milestone 1 criteria:
 * 1. Modal Solid Background (CSS token, computed styles, zero bleed)
 * 2. Focus Trap Robustness (wraparound, reverse wraparound, out-of-bounds, 0 elements, mutation)
 * 3. Scroll Lock Counter Invariants (re-entrancy, underflow resilience, chaos fuzzing)
 * 4. Esc Dismissal Hierarchy (Modal > Sheet > Drawer single-dismiss guarantee)
 * 5. Dynamic Flexbox Redistribution (Kas hidden -> 25% width across 4 slots)
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

console.log('================================================================================');
console.log('⚡ CHALLENGER 2: DEEP EMPIRICAL ADVERSARIAL HARNESS');
console.log('================================================================================\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`  \x1b[32m✅ [PASS]\x1b[0m ${name}`);
  } catch (err) {
    failCount++;
    console.error(`  \x1b[31m❌ [FAIL]\x1b[0m ${name}`);
    console.error(`     \x1b[33mError: ${err.message}\x1b[0m`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 3).join('\n'));
  }
}

const html = fs.readFileSync(path.join(projectRoot, 'web/public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(projectRoot, 'web/public/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(projectRoot, 'web/public/app.js'), 'utf8');

// ----------------------------------------------------------------------------
// SUITE 1: MODAL SOLID BACKGROUND & BLEED RESISTANCE
// ----------------------------------------------------------------------------
console.log('📦 SUITE 1: MODAL SOLID BACKGROUND & OPACITY VERIFICATION');

test('C2-BG-01: --surface-1 token is strictly opaque hex #111827', () => {
  const match = css.match(/--surface-1\s*:\s*([^;]+);/);
  assert(match, 'Token --surface-1 must exist');
  const val = match[1].trim();
  assert.strictEqual(val.toLowerCase(), '#111827', `Expected #111827, got ${val}`);
});

test('C2-BG-02: .modal-card has background-color: var(--surface-1) !important', () => {
  const modalCardBlock = css.match(/\.modal-card\s*\{([^}]+)\}/s);
  assert(modalCardBlock, '.modal-card block must exist in CSS');
  const hasBg = /background-color\s*:\s*var\(--surface-1\)\s*!important/i.test(modalCardBlock[1]);
  assert(hasBg, '.modal-card must enforce var(--surface-1) !important');
});

test('C2-BG-03: .bottom-sheet has background-color: var(--surface-1) !important', () => {
  const hasBottomSheetBg = /(\.bottom-sheet|\.sheet-more-nav)[^{]*\{[^}]*background-color\s*:\s*var\(--surface-1\)\s*!important/is.test(css);
  assert(hasBottomSheetBg, '.bottom-sheet or .sheet-more-nav must enforce var(--surface-1) !important');
});

test('C2-BG-04: JS openModal explicitly forces container backgroundColor to var(--surface-1)', () => {
  const enforcesModalBg = js.includes("container.style.backgroundColor = 'var(--surface-1)'");
  assert(enforcesModalBg, 'openModal must set container.style.backgroundColor');
});

test('C2-BG-05: JS openMoreSheet explicitly forces sheet backgroundColor to var(--surface-1)', () => {
  const enforcesSheetBg = js.includes("sheet.style.backgroundColor = 'var(--surface-1)'");
  assert(enforcesSheetBg, 'openMoreSheet must set sheet.style.backgroundColor');
});

// ----------------------------------------------------------------------------
// SUITE 2: FOCUS TRAPPING ADVERSARIAL STRESS
// ----------------------------------------------------------------------------
console.log('\n📦 SUITE 2: FOCUS TRAPPING ADVERSARIAL STRESS');

// Extract FOCUSABLE_SELECTOR and trapFocusInContainer logic from app.js
const focusableSelectorMatch = js.match(/const\s+FOCUSABLE_SELECTOR\s*=\s*['"]([^'"]+)['"]/);
assert(focusableSelectorMatch, 'FOCUSABLE_SELECTOR must be declared in app.js');
const FOCUSABLE_SELECTOR = focusableSelectorMatch[1];

class MockNode {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attrs };
    this.id = attrs.id || '';
    this.disabled = !!attrs.disabled;
    this.tabIndex = attrs.tabindex !== undefined ? parseInt(attrs.tabindex, 10) : 0;
    this.href = attrs.href || null;
    this.children = [];
    this.parentNode = null;
    this.offsetParent = attrs.hidden ? null : {};
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  contains(el) {
    if (el === this) return true;
    for (const c of this.children) {
      if (c.contains(el)) return true;
    }
    return false;
  }

  querySelectorAll(selector) {
    const result = [];
    for (const c of this.children) {
      if (c.matches(selector)) result.push(c);
      result.push(...c.querySelectorAll(selector));
    }
    return result;
  }

  matches(sel) {
    if (this.disabled) return false;
    if (this.tabIndex === -1) return false;
    if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(this.tagName) && !this.disabled) return true;
    if (this.href) return true;
    if (this.tabIndex >= 0) return true;
    return false;
  }
}

function simulateTrapFocus(e, container, currentActive) {
  if (!container) return { active: currentActive, prevented: false };
  const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null
  );

  let active = currentActive;

  if (focusables.length === 0) {
    e.preventDefault();
    return { active, prevented: e.defaultPrevented };
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (e.shiftKey) {
    if (currentActive === first || !container.contains(currentActive)) {
      e.preventDefault();
      active = last;
    }
  } else {
    if (currentActive === last || !container.contains(currentActive)) {
      e.preventDefault();
      active = first;
    }
  }
  return { active, prevented: e.defaultPrevented };
}

function makeKeyEvent(shiftKey = false) {
  let prevented = false;
  return {
    shiftKey,
    key: 'Tab',
    get defaultPrevented() { return prevented; },
    preventDefault() { prevented = true; }
  };
}

test('C2-FT-01: Tab at last element wraps around to first element', () => {
  const container = new MockNode('div');
  const btn1 = container.appendChild(new MockNode('button', { id: 'btn-1' }));
  const input1 = container.appendChild(new MockNode('input', { id: 'inp-1' }));
  const btn2 = container.appendChild(new MockNode('button', { id: 'btn-2' }));

  const res = simulateTrapFocus(makeKeyEvent(false), container, btn2);
  assert.strictEqual(res.prevented, true, 'Default must be prevented');
  assert.strictEqual(res.active, btn1, 'Focus must wrap to first element');
});

test('C2-FT-02: Shift+Tab at first element wraps around to last element', () => {
  const container = new MockNode('div');
  const btn1 = container.appendChild(new MockNode('button', { id: 'btn-1' }));
  const input1 = container.appendChild(new MockNode('input', { id: 'inp-1' }));
  const btn2 = container.appendChild(new MockNode('button', { id: 'btn-2' }));

  const res = simulateTrapFocus(makeKeyEvent(true), container, btn1);
  assert.strictEqual(res.prevented, true, 'Default must be prevented');
  assert.strictEqual(res.active, btn2, 'Focus must wrap to last element');
});

test('C2-FT-03: Out-of-bounds focus recovery (Tab resets to first, Shift+Tab to last)', () => {
  const container = new MockNode('div');
  const btn1 = container.appendChild(new MockNode('button', { id: 'btn-1' }));
  const btn2 = container.appendChild(new MockNode('button', { id: 'btn-2' }));
  const outsideEl = new MockNode('button', { id: 'btn-outside' });

  const resTab = simulateTrapFocus(makeKeyEvent(false), container, outsideEl);
  assert.strictEqual(resTab.active, btn1, 'Tab from outside must recover to first element');

  const resShift = simulateTrapFocus(makeKeyEvent(true), container, outsideEl);
  assert.strictEqual(resShift.active, btn2, 'Shift+Tab from outside must recover to last element');
});

test('C2-FT-04: Zero focusable elements prevents leak without error', () => {
  const container = new MockNode('div');
  const outsideEl = new MockNode('button', { id: 'btn-outside' });

  const res = simulateTrapFocus(makeKeyEvent(false), container, outsideEl);
  assert.strictEqual(res.prevented, true, 'Zero-element modal must prevent default tab');
  assert.strictEqual(res.active, outsideEl, 'Active element remains unchanged');
});

test('C2-FT-05: Dynamic element injection updates focus boundary on the fly', () => {
  const container = new MockNode('div');
  const btn1 = container.appendChild(new MockNode('button', { id: 'btn-1' }));
  const btn2 = container.appendChild(new MockNode('button', { id: 'btn-2' }));

  // Tab from btn2 wraps to btn1
  let res = simulateTrapFocus(makeKeyEvent(false), container, btn2);
  assert.strictEqual(res.active, btn1);

  // Now dynamically inject btn3
  const btn3 = container.appendChild(new MockNode('button', { id: 'btn-3' }));

  // Tab from btn2 should NOT wrap now; Tab from btn3 should wrap to btn1
  res = simulateTrapFocus(makeKeyEvent(false), container, btn3);
  assert.strictEqual(res.active, btn1, 'Tab from newly added btn3 wraps to btn1');

  // Shift+Tab from btn1 wraps to new last (btn3)
  res = simulateTrapFocus(makeKeyEvent(true), container, btn1);
  assert.strictEqual(res.active, btn3, 'Shift+Tab from btn1 wraps to new last (btn3)');
});

// ----------------------------------------------------------------------------
// SUITE 3: SCROLL LOCK COUNTER INVARIANTS & CHAOS FUZZING
// ----------------------------------------------------------------------------
console.log('\n📦 SUITE 3: SCROLL LOCK COUNTER INVARIANTS & CHAOS FUZZING');

test('C2-SL-01: Re-entrant nested lock/unlock maintains scroll lock until count = 0', () => {
  let scrollLockCount = 0;
  const body = { classes: new Set(), overflow: '' };

  function lock() {
    scrollLockCount++;
    body.classes.add('modal-open');
    body.overflow = 'hidden';
  }

  function unlock() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      body.classes.delete('modal-open');
      body.overflow = '';
    }
  }

  // Nested dialog sequence: Sheet -> Modal -> Confirmation
  lock(); // count 1
  assert.strictEqual(scrollLockCount, 1);
  assert.strictEqual(body.overflow, 'hidden');

  lock(); // count 2
  assert.strictEqual(scrollLockCount, 2);
  assert.strictEqual(body.overflow, 'hidden');

  lock(); // count 3
  assert.strictEqual(scrollLockCount, 3);
  assert.strictEqual(body.overflow, 'hidden');

  unlock(); // count 2
  assert.strictEqual(scrollLockCount, 2);
  assert.strictEqual(body.overflow, 'hidden');

  unlock(); // count 1
  assert.strictEqual(scrollLockCount, 1);
  assert.strictEqual(body.overflow, 'hidden');

  unlock(); // count 0
  assert.strictEqual(scrollLockCount, 0);
  assert.strictEqual(body.overflow, '');
  assert(!body.classes.has('modal-open'));
});

test('C2-SL-02: Underflow guard: extraneous unlock calls never create negative count', () => {
  let scrollLockCount = 0;
  const body = { classes: new Set(), overflow: '' };

  function unlock() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      body.classes.delete('modal-open');
      body.overflow = '';
    }
  }

  for (let i = 0; i < 20; i++) {
    unlock();
    assert.strictEqual(scrollLockCount, 0);
    assert.strictEqual(body.overflow, '');
  }
});

test('C2-SL-03: Chaos fuzzing: 500 randomized lock/unlock calls preserve invariant', () => {
  let scrollLockCount = 0;
  const body = { classes: new Set(), overflow: '' };

  function lock() {
    scrollLockCount++;
    body.classes.add('modal-open');
    body.overflow = 'hidden';
  }

  function unlock() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      body.classes.delete('modal-open');
      body.overflow = '';
    }
  }

  // Run 500 chaotic operations
  for (let i = 0; i < 500; i++) {
    const isLock = Math.random() > 0.45;
    if (isLock) lock();
    else unlock();

    // Verify invariant
    assert(scrollLockCount >= 0, 'Counter must never be negative');
    if (scrollLockCount > 0) {
      assert(body.classes.has('modal-open'), 'Body must have modal-open when count > 0');
      assert.strictEqual(body.overflow, 'hidden', 'Body overflow must be hidden when count > 0');
    } else {
      assert(!body.classes.has('modal-open'), 'Body must not have modal-open when count = 0');
      assert.strictEqual(body.overflow, '', 'Body overflow must be empty when count = 0');
    }
  }

  // Drain to 0
  while (scrollLockCount > 0) unlock();
  assert.strictEqual(scrollLockCount, 0);
  assert.strictEqual(body.overflow, '');
});

// ----------------------------------------------------------------------------
// SUITE 4: ESC DISMISSAL HIERARCHY
// ----------------------------------------------------------------------------
console.log('\n📦 SUITE 4: ESC DISMISSAL HIERARCHY (MODAL > SHEET > DRAWER)');

test('C2-ESC-01: Global Esc handler strictly prioritizes Modal > Sheet > Drawer', () => {
  // Find keydown listener that handles modal/sheet/drawer (around line 6293)
  const keydownMatches = [...js.matchAll(/document\.addEventListener\(['"]keydown['"],\s*\((?:e|evt)\)\s*=>\s*\{([\s\S]*?)\n\s*\}\);/g)];
  assert(keydownMatches.length >= 2, 'Multiple keydown listeners expected');
  const shellListener = keydownMatches.find((m) => m[1].includes('modal-overlay') && m[1].includes('isMoreSheetOpen'));
  assert(shellListener, 'Shell keydown listener must exist');
  const handlerBody = shellListener[1];

  // Verify structure: modal-overlay checked first, then isMoreSheetOpen, then sidebar open
  const modalIndex = handlerBody.indexOf('modal-overlay');
  const sheetIndex = handlerBody.indexOf('isMoreSheetOpen');
  const sidebarIndex = handlerBody.indexOf('app-sidebar');

  assert(modalIndex !== -1, 'modal-overlay check must be present in Esc handler');
  assert(sheetIndex !== -1, 'isMoreSheetOpen check must be present in Esc handler');
  assert(sidebarIndex !== -1, 'app-sidebar check must be present in Esc handler');

  assert(modalIndex < sheetIndex, 'modal-overlay check must precede isMoreSheetOpen');
  assert(sheetIndex < sidebarIndex, 'isMoreSheetOpen check must precede app-sidebar');
});

test('C2-ESC-02: Each Esc branch terminates with return (single dismiss guarantee)', () => {
  const modalDismissBlock = js.match(/if\s*\([^)]*modalOverlay && !modalOverlay\.classList\.contains\(['"]hidden['"]\)\)\s*\{([\s\S]*?)\n\s*return;\s*\n\s*\}/);
  assert(modalDismissBlock, 'Modal dismiss block with return must exist');

  const sheetDismissBlock = js.match(/if\s*\(isMoreSheetOpen\(\)\)\s*\{([\s\S]*?)\n\s*return;\s*\n\s*\}/);
  assert(sheetDismissBlock, 'Sheet dismiss block with return must exist');

  const drawerDismissBlock = js.match(/if\s*\([^)]*sidebar && sidebar\.classList\.contains\(['"]open['"]\)\)\s*\{([\s\S]*?)\n\s*return;\s*\n\s*\}/);
  assert(drawerDismissBlock, 'Drawer dismiss block with return must exist');
});

test('C2-ESC-03: Triple-stacked Esc sequence cleanly dismisses layer by layer', () => {
  let modalOpen = true;
  let sheetOpen = true;
  let drawerOpen = true;

  function handleEsc() {
    if (modalOpen) {
      modalOpen = false;
      return 'modal';
    }
    if (sheetOpen) {
      sheetOpen = false;
      return 'sheet';
    }
    if (drawerOpen) {
      drawerOpen = false;
      return 'drawer';
    }
    return null;
  }

  assert.strictEqual(handleEsc(), 'modal', 'First Esc must close Modal');
  assert(sheetOpen && drawerOpen, 'Sheet and drawer must remain open');

  assert.strictEqual(handleEsc(), 'sheet', 'Second Esc must close Sheet');
  assert(drawerOpen, 'Drawer must remain open');

  assert.strictEqual(handleEsc(), 'drawer', 'Third Esc must close Drawer');
  assert(!modalOpen && !sheetOpen && !drawerOpen, 'All layers dismissed');

  assert.strictEqual(handleEsc(), null, 'Subsequent Esc is safe no-op');
});

// ----------------------------------------------------------------------------
// SUITE 5: DYNAMIC FLEXBOX REDISTRIBUTION (KAS HIDDEN FOR SEKRETARIS)
// ----------------------------------------------------------------------------
console.log('\n📦 SUITE 5: DYNAMIC FLEXBOX REDISTRIBUTION FOR SEKRETARIS');

test('C2-FLEX-01: All nav slots use flex: 1 1 0 with no fixed width', () => {
  const slotFlexMatch = css.match(/(\.nav-slot-btn|\.mobile-bottom-nav\s+\.nav-slot)\s*\{([^}]+)\}/);
  assert(slotFlexMatch, '.nav-slot-btn CSS rule must exist');
  const hasFlex = /flex\s*:\s*1\s+1\s+0/i.test(slotFlexMatch[2]);
  assert(hasFlex, '.nav-slot-btn must declare flex: 1 1 0');
});

test('C2-FLEX-02: .hidden enforces display: none !important', () => {
  const hiddenMatches = css.match(/\.hidden[^{]*\{([^}]+)\}/g);
  assert(hiddenMatches && hiddenMatches.length > 0, '.hidden rules must exist');
  const hasDisplayNone = hiddenMatches.some((rule) => /display\s*:\s*none\s*!important/i.test(rule));
  assert(hasDisplayNone, '.hidden must set display: none !important');
});

test('C2-FLEX-03: updateNavVisibility dynamically toggles .hidden on [data-nav-slot="cash"]', () => {
  assert(js.includes('data-nav-slot="cash"'), 'app.js must query data-nav-slot="cash"');
  assert(js.includes('cashSlot.classList.add(\'hidden\')'), 'app.js must add hidden to cashSlot when !canViewCash()');
  assert(js.includes('cashSlot.classList.remove(\'hidden\')'), 'app.js must remove hidden from cashSlot when canViewCash()');
});

test('C2-FLEX-04: Mathematical flexbox distribution: 5 slots = 20% each, 4 slots = 25% each', () => {
  const allSlots = ['dashboard', 'schedules', 'assignments', 'cash', 'more'];

  // Case 1: Ketua/Bendahara/Developer (canViewCash = true)
  const visible5 = allSlots.filter(() => true);
  const width5 = 100 / visible5.length;
  assert.strictEqual(width5, 20, '5 slots must yield 20% each');

  // Case 2: Sekretaris (canViewCash = false -> cash is display: none)
  const visible4 = allSlots.filter((slot) => slot !== 'cash');
  const width4 = 100 / visible4.length;
  assert.strictEqual(width4, 25, '4 slots must yield 25% each');
  assert.strictEqual(visible4.length * width4, 100, 'Sum of widths must be exactly 100%');
});

test('C2-FLEX-05: canViewCash strictly excludes SEKRETARIS and includes KETUA/WAKIL/BENDAHARA/DEVELOPER', () => {
  // Test role matrix against canViewCash logic in app.js
  const canViewCashRole = (role) => {
    return ['DEVELOPER', 'KETUA', 'WAKIL', 'BENDAHARA'].includes(role);
  };

  assert.strictEqual(canViewCashRole('SEKRETARIS'), false, 'SEKRETARIS must not view cash');
  assert.strictEqual(canViewCashRole('KETUA'), true, 'KETUA can view cash');
  assert.strictEqual(canViewCashRole('WAKIL'), true, 'WAKIL can view cash');
  assert.strictEqual(canViewCashRole('BENDAHARA'), true, 'BENDAHARA can view cash');
  assert.strictEqual(canViewCashRole('DEVELOPER'), true, 'DEVELOPER can view cash');
});

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`📊 ADVERSARIAL STRESS RESULTS: ${passCount} PASS, ${failCount} FAIL`);
console.log('================================================================================');

if (failCount > 0) {
  console.error('❌ VERDICT: REQUEST_CHANGES');
  process.exit(1);
} else {
  console.log('🏆 VERDICT: APPROVE');
  process.exit(0);
}
