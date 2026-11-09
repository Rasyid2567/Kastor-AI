# Project: Kastor AI Web Dashboard Production Redesign (Varian B)

## Architecture
- **Web App Frontend (`web/public/app.js`, `web/public/styles.css`, `web/public/index.html`)**: Single Page Application (SPA) utilizing vanilla JavaScript and modular CSS.
  - Varian B Dark Mint Theme (`#0a0f1c` bg, `#111827` surface, `#34d399` mint accent, `#1f2a3d` border, `#f1f5f9` text).
  - Responsive Shell: Desktop (> 900px) 240px sticky sidebar, Mobile (<= 900px) fixed 5-slot bottom nav + "Lainnya" bottom sheet + floating action buttons (`.fab`) + mobile card engine (`.mc`).
  - Accessibility & Touch: Minimum 44x44px touch targets (`--tap-min`), minimum 16px font-size on form controls to prevent iOS auto-zoom, and 4.5:1 text contrast.
- **Backend API Server (`web/src/routes.js`, `web/src/rbac.js`, `web/server.js`)**: Native Node.js HTTP server exposing 38 REST endpoints backed by SQLite.
  - Full RBAC enforcement: Developer (all), Ketua/Wakil (academic + read-only cash), Bendahara (cash mutations), Sekretaris (academic only, 403 on cash).
  - Real-time role resolution via `resolveAuthoritativeRole(phone_number, group_id)`.
- **Database Engine (`database/schema.js`, `database.sqlite`)**: SQLite in WAL mode.
  - Single Source of Truth (SSOT) architecture: `students` table holds student records; `organization_structures` links `student_id` foreign key (`ON DELETE SET NULL`) while preserving backward-compatible denormalized `holder_name` and `phone_number` for WhatsApp bot commands.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Varian B Design Tokens | Dark theme CSS tokens: mint `#34d399`, surface `#111827`, background `#0a0f1c`, border `#1f2a3d`, text `#f1f5f9`, on-mint `#052e1f`, soft mint `rgba(52,211,153,.12)` | M1 | redesign.md §Token warna |
| 2 | 12 Legacy CSS Tokens | Preserve exact 12 legacy CSS variable declarations in `:root` to satisfy UI-05 test invariant | M1 | web-tests.js UI-05 |
| 3 | Desktop Sticky Sidebar | Sticky 240px sidebar on viewports > 900px with brand, class context, navigation, and user card | M1 | redesign.md §Layout |
| 4 | Mobile 5-Slot Bottom Nav | Fixed 64px bottom bar on viewports <= 900px with 5 items (Dashboard, Siswa, Jadwal, Kas, Lainnya) and bottom padding >= 96px | M1 | redesign.md §Layout |
| 5 | "Lainnya" Bottom Sheet | Slide-up sheet dialog for slot 5 displaying remaining modules (Administrasi, AI, Dev Console, Logout) | M1 | redesign.md §Layout |
| 6 | Touch Targets & iOS Zoom | Touch bounding boxes >= 44x44px; input font-size strictly >= 16px to prevent iOS auto-zoom; no text < 12px | M1 | redesign.md §Tipografi & §Aksesibilitas |
| 7 | Dynamic Slot Flex Distribution | Bottom nav flexbox automatically redistributes remaining 4 slots to 25% width each when Kas slot is hidden for Sekretaris | M1 | challenger-m1-behavioral-stress.js RBAC-02 |
| 8 | Class Roles SSOT DB Migration | Safe `ALTER TABLE organization_structures ADD COLUMN student_id INTEGER REFERENCES students(id) ON DELETE SET NULL` | M2 | redesign.md §Sumber data |
| 9 | Student Search Component | Modal (desktop) and Bottom Sheet (mobile) to search students by name or NIS with instant results | M2 | redesign.md §Sumber data |
| 10 | Single Active Role Constraint | Validate student does not hold multiple roles; display confirmation warning before role transfer | M2 | redesign.md §Sumber data |
| 11 | SSOT Cascade Update on Edit | Updating student in Data Siswa automatically updates linked structure positions and role displays | M2 | redesign.md §Sumber data |
| 12 | Role Clearing on Student Deletion | Deleting student clears their role, flags position as "Perlu diisi ulang", and revokes class role | M2 | redesign.md §Sumber data |
| 13 | Dashboard Redesign | 4 summary cards (1 column on mobile), today's schedule rows, upcoming tasks with deadlines, holiday empty state | M3 | redesign.md §Dashboard |
| 14 | Data Siswa Redesign | Sticky search bar, mobile cards (`.mc`), desktop table, floating add button (`.fab`), mass import in secondary action | M3 | redesign.md §Data Siswa |
| 15 | Jadwal Pelajaran Redesign | Desktop block table, mobile day cards with scrollable day chips (`.chips`), week filter navigation | M3 | redesign.md §Jadwal Pelajaran |
| 16 | Tugas & PR Redesign | Active and History tabs, deadline badges, submission progress indicator ("X dari Y sudah kumpul") | M3 | redesign.md §Tugas & PR |
| 17 | Kas Kelas Redesign | Summary cards (fee, active week, treasurers), student list with Lunas/Menunggak, large mobile toggle button (`.ck`) | M3 | redesign.md §Kas Kelas |
| 18 | Administrasi Kelas Redesign | Role cards with badges, mono WhatsApp announcement preview, mobile tab switcher (Form vs Preview) | M3 | redesign.md §Administrasi Kelas |
| 19 | AI & Utilitas Redesign | Full-height chat container, pinned bottom input, scientific calculator tab panel | M3 | redesign.md §AI & Utilitas |
| 20 | Developer Console Redesign | Developer-only guard, horizontal scrollable tables, big VPS stat cards, zero sensitive credential leaks | M3 | redesign.md §Developer Console |
| 21 | Login & Registrasi Redesign | Centered 400px card, ambient radial gradient `#123c33`, 4-bar password strength meter, password confirm check | M3 | redesign.md §Login dan registrasi |
| 22 | Automated Regression Suite | Pass 100% of `web/test/web-tests.js` (220/220) | M4 | ORIGINAL_REQUEST Acceptance Criteria |
| 23 | Responsive E2E Suite | Pass 100% of `web/test/responsive-e2e.js` across both desktop (> 900px) and mobile (<= 900px) viewports | M4 | ORIGINAL_REQUEST Acceptance Criteria |
| 24 | Challenger Stress Suites | Pass 100% of `web/test/challenger-m1-stress.js` and `web/test/challenger-m1-behavioral-stress.js` | M4 | ORIGINAL_REQUEST Acceptance Criteria |
| 25 | Adversarial Hardening (Tier 5) | Comprehensive adversarial stress testing of edge cases, modal lifecycles, and viewport reflow | M5 | Project Pattern Final Milestone |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Design System & App Shell | Varian B tokens, 12 legacy tokens, sticky sidebar (>900px), bottom nav & sheet (<=900px), touch targets >=44px, inputs >=16px | none | IN_PROGRESS |
| M2 | Class Roles Single Source of Truth | Safe DB migration, student search component, single-role constraint & confirmation, cascade updates & deletion clearing | M1 | PLANNED |
| M3 | Module Redesign Coverage | Redesign all 9 modules (Dashboard, Siswa, Jadwal, Tugas, Kas, Administrasi, AI, Dev Console, Login/Registrasi) | M1, M2 | PLANNED |
| M4 | Automated Verification & E2E Validation | Verify and pass `web-tests.js`, `responsive-e2e.js`, `challenger-m1-stress.js`, `challenger-m1-behavioral-stress.js` | M1, M2, M3 | PLANNED |
| M5 | Adversarial Hardening & Final Gate | White-box adversarial testing, coverage audit, and final acceptance gate | M4 | PLANNED |

---

## Interface Contracts
### `web/public/styles.css` ↔ Test Suites
- `:root`:
  - Varian B Tokens: `--ac: #34d399;`, `--acs: rgba(52,211,153,.12);`, `--bg: #0a0f1c;`, `--s1: #111827;`, `--s2: #0b1322;`, `--s3: #151d30;`, `--line: #1f2a3d;`, `--tx: #f1f5f9;`, `--mu: #94a3b8;`, `--wn: #fbbf24;`, `--hi: #f87171;`
  - 12 Legacy Tokens verbatim for `web-tests.js` UI-05: `--bg: #0B0D10;`, `--surface: #11151A;`, `--border: #1E232B;`, `--text: #E5E7EB;`, `--text-muted: #6B7280;`, `--primary: #3B82F6;`, `--primary-hover: #2563EB;`, `--accent: #10B981;`, `--warning: #F59E0B;`, `--danger: #EF4444;`, `--success: #10B981;`, `--radius: 8px;`
- Responsive Breakpoints:
  - `@media (max-width: 900px)` for visual Varian B bottom nav, mobile cards, FAB.
  - `@media (max-width: 1023px)` for legacy test assertion invariant UI-06.
- Typography & Touch:
  - `.form-input, .form-select, .form-textarea, input, select, textarea { font-size: 16px; }`
  - `.btn, .btn-icon-toggle, .auth-tab, .class-select { min-height: 44px; }`

### `database/schema.js` & `web/src/routes.js` ↔ `organization_structures`
- `ALTER TABLE organization_structures ADD COLUMN student_id INTEGER REFERENCES students(id) ON DELETE SET NULL;`
- `GET /api/structure`: Returns structures joined with students (`s.name as student_name, s.nis, s.phone_number as student_phone`).
- `POST /api/structure`: Accepts `{ position_name, student_id }` or `{ position_name, holder_name, phone_number, student_id }`. Synchronizes name and phone from `students` table.
- `PUT /api/students/:id`: Cascades name and phone changes to `organization_structures` and `class_roles`.
- `DELETE /api/students/:id`: Sets `student_id = NULL`, flags position as vacant ("Perlu diisi ulang").

---

## Code Layout
- `web/public/styles.css`: Varian B design tokens, App Shell layout (sidebar, bottom nav, sheet, scrim), component styling (cards, tables, buttons, inputs, pills).
- `web/public/index.html`: Base DOM template, App Shell markup, modal containers, bottom navigation, bottom sheet.
- `web/public/app.js`: Client-side logic for all 9 modules, student search component, role selection, modal controller, RBAC view filters.
- `database/schema.js`: SQLite schema initialization and safe migration for `student_id`.
- `web/src/routes.js`: Backend REST API handlers and SSOT cascade hooks.
- `web/src/rbac.js`: Role-based access control rules.
- `web/test/`: Test runners and suites (`web-tests.js`, `responsive-e2e.js`, `challenger-m1-stress.js`, `challenger-m1-behavioral-stress.js`).
