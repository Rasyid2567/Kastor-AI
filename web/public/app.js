/**
 * ============================================================================
 * KASTOR AI — ARAS 1.0 WEB DASHBOARD FRONTEND CONTROLLER
 * Bahasa: 100% Bahasa Indonesia | Keamanan: XSS-Safe (escapeHtml) + CSRF Token
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. GLOBAL STATE
  // --------------------------------------------------------------------------
  const state = {
    currentUser: null,
    csrfToken: null,
    permissions: null,
    classes: [],
    activeModule: 'dashboard',
    // Students state
    students: [],
    studentSearch: '',
    // Schedules state
    schedules: [],
    scheduleWeek: null,
    activeSchoolWeek: 1,
    scheduleDay: '',
    scheduleTeacher: '',
    // Cash state
    cashSettings: { weekly_fee: 0, active_weeks_count: 0 },
    cashTreasurers: [],
    cashTreasurerNames: [],
    cashActiveSchoolWeek: 1,
    cashWeek: null,
    cashSearch: '',
    cashRecap: [],
    cashFormattedText: '',
    // Assignments state
    assignments: [],
    assignmentFilter: 'active',
    // Structure state
    structures: [],
    classRoles: [],
    linkedGroups: [],
    activeClassInfo: null,
    // Developer Console state
    devTab: 'vps',
    systemData: null,
    auditLogs: [],
    stickerLimitData: null
  };

  const DAY_NAMES = {
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
    6: 'Sabtu',
    0: 'Minggu'
  };

  // Definisi Menu Navigasi sesuai Spesifikasi
  const NAV_ITEMS = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      title: 'Ringkasan Kelas & Aktivitas',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
      canShow: () => true
    },
    {
      id: 'students',
      label: 'Data Siswa',
      title: 'Database & Biodata Siswa',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      canShow: () => true
    },
    {
      id: 'schedules',
      label: 'Jadwal Pelajaran',
      title: 'Jadwal Blok KBM Mingguan',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      canShow: () => true
    },
    {
      id: 'cash',
      label: 'Kas Kelas',
      title: 'Manajemen & Rekapitulasi Kas Kelas',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
      // Disembunyikan dari sidebar untuk SEKRETARIS
      canShow: (role) => getEffectiveRole(role) !== 'SEKRETARIS'
    },
    {
      id: 'finance',
      label: 'Buku Kas & Rekap',
      title: 'Buku Kas & Rekapitulasi Keuangan Kelas',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      // Disembunyikan untuk SEKRETARIS
      canShow: (role) => getEffectiveRole(role) !== 'SEKRETARIS'
    },
    {
      id: 'assignments',
      label: 'Tugas & PR',
      title: 'Daftar Tugas & Pekerjaan Rumah',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      canShow: () => true
    },
    {
      id: 'structure',
      label: 'Administrasi Kelas',
      title: 'Struktur Organisasi & Pengumuman',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
      canShow: () => true
    },
    {
      id: 'utilities',
      label: 'AI & Utilitas',
      title: 'Asisten Belajar AI & Kalkulator Ilmiah',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z"/></svg>',
      canShow: () => true
    },
    {
      id: 'dev-console',
      label: 'Developer Console',
      title: 'Konsol Sistem, Metrik VPS & Audit Log',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
      // Hanya ditampilkan untuk DEVELOPER
      canShow: (role) => getEffectiveRole(role) === 'DEVELOPER'
    }
  ];

  // --------------------------------------------------------------------------
  // 2. SECURITY & FORMATTING HELPERS
  // --------------------------------------------------------------------------

  /**
   * Escape seluruh teks dinamis sebelum dirender ke DOM untuk mencegah XSS
   */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Format angka ke mata uang Rupiah (contoh: Rp5.000)
   */
  function formatRupiah(nominal) {
    const num = Number(nominal || 0);
    if (isNaN(num)) return 'Rp0';
    return 'Rp' + num.toLocaleString('id-ID');
  }

  /**
   * Bersihkan JID WhatsApp untuk tampilan nomor HP yang rapi
   */
  function formatPhoneDisplay(raw) {
    if (!raw) return '—';
    return String(raw).split('@')[0].split(':')[0];
  }

  /**
   * Format detik menjadi durasi hari/jam/menit
   */
  function formatDuration(sec) {
    const s = Math.max(0, Math.floor(Number(sec || 0)));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}h ${h}j ${m}m`;
    if (h > 0) return `${h}j ${m}m`;
    return `${m} menit`;
  }

  /**
   * Pemetaan Role Efektif di sisi UI (otorisasi sesungguhnya tetap di server)
   */
  function getEffectiveRole(role) {
    const r = String(role || '').toUpperCase().trim();
    if (r === 'WAKIL' || r === 'WAKIL KETUA') return 'KETUA';
    return r;
  }

  function canEditAcademic() {
    const eff = getEffectiveRole(state.currentUser?.role);
    return ['DEVELOPER', 'KETUA', 'SEKRETARIS'].includes(eff);
  }

  function canEditCash() {
    const eff = getEffectiveRole(state.currentUser?.role);
    return ['DEVELOPER', 'BENDAHARA'].includes(eff);
  }

  function canViewCash() {
    const eff = getEffectiveRole(state.currentUser?.role);
    return ['DEVELOPER', 'BENDAHARA', 'KETUA'].includes(eff);
  }

  function canEditFinance() {
    const eff = getEffectiveRole(state.currentUser?.role);
    return ['DEVELOPER', 'BENDAHARA'].includes(eff);
  }

  function canViewFinance() {
    const eff = getEffectiveRole(state.currentUser?.role);
    return ['DEVELOPER', 'BENDAHARA', 'KETUA'].includes(eff);
  }

  function isDeveloper() {
    return getEffectiveRole(state.currentUser?.role) === 'DEVELOPER';
  }

  function getRoleBadgeClass(role) {
    const r = String(role || '').toUpperCase();
    if (r === 'DEVELOPER') return 'role-badge role-developer';
    if (r === 'KETUA' || r.includes('WAKIL')) return 'role-badge role-ketua';
    if (r === 'SEKRETARIS') return 'role-badge role-sekretaris';
    if (r === 'BENDAHARA') return 'role-badge role-bendahara';
    return 'role-badge';
  }

  // --------------------------------------------------------------------------
  // 3. API CLIENT DENGAN DUKUNGAN CSRF TOKEN & CREDENTIALS
  // --------------------------------------------------------------------------

  async function apiRequest(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {})
    };

    const csrfToken = state.csrfToken || state.currentUser?.csrf_token;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      headers['Content-Type'] = 'application/json';
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    const fetchConfig = {
      method,
      headers,
      credentials: 'same-origin'
    };

    if (options.body !== undefined) {
      fetchConfig.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const res = await fetch(url, fetchConfig);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (res.status === 401 && !url.includes('/api/auth/me') && !url.includes('/api/auth/login') && !url.includes('/api/auth/register') && !url.includes('/api/auth/logout')) {
      showToast('Sesi Anda telah berakhir. Silakan login kembali.', 'warning');
      showLoginView();
    }

    return {
      ok: res.ok && data.ok !== false,
      status: res.status,
      data
    };
  }

  // --------------------------------------------------------------------------
  // 4. 5 STATE UI HELPERS: LOADING, EMPTY, ERROR, SUCCESS (TOAST), FORBIDDEN (403)
  // --------------------------------------------------------------------------

  /**
   * 4a. Success / Error / Info State: Toast Notifikasi Non-intrusif (otomatis hilang 3 detik)
   */
  function showToast(message, type = 'success', title = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const defaultTitles = {
      success: 'Berhasil',
      error: 'Gagal Memproses',
      warning: 'Perhatian',
      info: 'Informasi'
    };

    const icons = {
      success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${escapeHtml(type)}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title || defaultTitles[type] || 'Notifikasi')}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button type="button" class="toast-close" aria-label="Tutup notifikasi">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => toast.remove());
    }

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3000);
  }

  /**
   * 4b. Loading State: Skeleton shimmer + indikator "Memuat data..."
   */
  function renderLoadingState(label = 'Memuat data...') {
    return `
      <div class="panel">
        <div class="state-loading" role="status" aria-live="polite">
          <div class="loading-indicator-row">
            <span class="spinner" aria-hidden="true"></span>
            <span>${escapeHtml(label)}</span>
          </div>
          <div class="skeleton-line" style="width: 38%;"></div>
          <div class="skeleton-block"></div>
          <div class="skeleton-block"></div>
          <div class="skeleton-line" style="width: 65%;"></div>
        </div>
      </div>
    `;
  }

  /**
   * 4c. Empty State: Ikon minimalis, pesan jelas Bahasa Indonesia, dan tombol aksi opsional
   */
  function renderEmptyState({ title, description, actionLabel, actionId }) {
    return `
      <div class="state-empty">
        <div class="state-empty-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h3 class="state-empty-title">${escapeHtml(title || 'Belum Ada Data')}</h3>
        <p class="state-empty-desc">${escapeHtml(description || 'Belum ada entri yang tercatat untuk kelas ini.')}</p>
        ${
          actionLabel && actionId
            ? `<button type="button" id="${escapeHtml(actionId)}" class="btn btn-primary btn-sm" style="margin-top: 6px;">${escapeHtml(actionLabel)}</button>`
            : ''
        }
      </div>
    `;
  }

  /**
   * 4d. Error State: Banner merah (--danger), pesan jelas, dan tombol "Coba Lagi"
   */
  function renderErrorState(errorMessage, retryCallbackName = 'retryCurrentModule') {
    return `
      <div class="state-error" role="alert">
        <div class="state-error-content">
          <div class="state-error-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <div class="state-error-title">Terjadi Kesalahan Saat Memuat Data</div>
            <div class="state-error-msg">${escapeHtml(errorMessage || 'Tidak dapat terhubung ke server. Periksa koneksi Anda.')}</div>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-action="${escapeHtml(retryCallbackName)}">
          Coba Lagi
        </button>
      </div>
    `;
  }

  /**
   * 4e. Forbidden State (403 — Akses Ditolak): Lengkap dengan nama role aktif & tombol "Kembali ke Dashboard"
   */
  function renderForbiddenState(reasonMessage) {
    const activeRole = state.currentUser?.role || 'PENGGUNA';
    return `
      <div class="state-forbidden" role="alert">
        <span class="forbidden-code">403 — AKSES DITOLAK</span>
        <h2 class="forbidden-title">Anda Tidak Memiliki Izin Akses</h2>
        <p class="forbidden-desc">
          ${escapeHtml(
            reasonMessage ||
              'Maaf, jabatan Anda tidak memiliki kewenangan untuk membuka atau memodifikasi modul ini sesuai kebijakan Role-Based Access Control (RBAC).'
          )}
        </p>
        <div style="margin: 6px 0;">
          <span class="text-subtle" style="font-size: 0.82rem;">Peran Aktif Anda: </span>
          <span class="${getRoleBadgeClass(activeRole)}">${escapeHtml(activeRole)}</span>
        </div>
        <button type="button" class="btn btn-primary" data-navigate="dashboard" style="margin-top: 8px;">
          Kembali ke Dashboard
        </button>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // 4F. SISTEM CUSTOM SELECT / DROPDOWN (MENCEGAH FULLSCREEN PICKER MOBILE OS)
  // --------------------------------------------------------------------------

  function renderCustomSelectHtml({ id, name = '', value, options = [], style = '', className = '', placeholder = 'Pilih...' }) {
    const normOptions = options.map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        return { value: String(opt.value), label: String(opt.label) };
      }
      return { value: String(opt), label: String(opt) };
    });

    const activeOpt = normOptions.find((o) => o.value === String(value)) || normOptions[0] || { value: '', label: placeholder };

    const selectOptionsHtml = normOptions
      .map(
        (opt) => `<option value="${escapeHtml(opt.value)}" ${opt.value === activeOpt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
      )
      .join('');

    const menuOptionsHtml = normOptions
      .map(
        (opt) => `
        <div
          class="custom-select-option ${opt.value === activeOpt.value ? 'selected' : ''}"
          role="option"
          tabindex="0"
          data-value="${escapeHtml(opt.value)}"
        >
          <span class="custom-select-option-text">${escapeHtml(opt.label)}</span>
          <svg class="custom-select-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      `
      )
      .join('');

    return `
      <div class="custom-select ${className}" data-custom-select-for="${id}" style="${style}">
        <select
          id="${id}"
          name="${name || id}"
          class="custom-select-native"
          tabindex="-1"
          aria-hidden="true"
        >${selectOptionsHtml}</select>
        <button
          type="button"
          class="custom-select-trigger"
          aria-haspopup="listbox"
          aria-expanded="false"
        >
          <span class="custom-select-label">${escapeHtml(activeOpt.label)}</span>
          <svg class="custom-select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="custom-select-menu" role="listbox">
          ${menuOptionsHtml}
        </div>
      </div>
    `;
  }

  function syncCustomSelectLabel(selectEl) {
    if (!selectEl) return;
    const wrapper = selectEl.closest('.custom-select');
    if (!wrapper) return;

    const val = String(selectEl.value);
    const labelEl = wrapper.querySelector('.custom-select-label');
    let foundLabel = '';

    wrapper.querySelectorAll('.custom-select-option').forEach((opt) => {
      if (opt.getAttribute('data-value') === val) {
        opt.classList.add('selected');
        const textEl = opt.querySelector('.custom-select-option-text');
        foundLabel = textEl ? textEl.textContent : opt.textContent.trim();
      } else {
        opt.classList.remove('selected');
      }
    });

    if (labelEl && foundLabel) {
      labelEl.textContent = foundLabel;
    }
  }

  function syncCustomSelectWithOptions(selectEl) {
    if (!selectEl) return;
    const wrapper = selectEl.closest('.custom-select');
    if (!wrapper) return;

    const menu = wrapper.querySelector('.custom-select-menu');
    const labelEl = wrapper.querySelector('.custom-select-label');
    if (!menu) return;

    const options = Array.from(selectEl.options);
    const currentVal = String(selectEl.value);
    let selectedLabel = '';

    menu.innerHTML = options
      .map((opt) => {
        const isSel = String(opt.value) === currentVal;
        if (isSel || (!selectedLabel && opt.selected)) {
          selectedLabel = opt.textContent;
        }
        return `
          <div
            class="custom-select-option ${isSel ? 'selected' : ''}"
            role="option"
            tabindex="0"
            data-value="${escapeHtml(opt.value)}"
          >
            <span class="custom-select-option-text">${escapeHtml(opt.textContent)}</span>
            <svg class="custom-select-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        `;
      })
      .join('');

    if (!selectedLabel && options.length > 0) {
      selectedLabel = options[0].textContent;
    }

    if (labelEl && selectedLabel) {
      labelEl.textContent = selectedLabel;
    }
  }

  function hookCustomSelectValueProperty(selectEl) {
    if (!selectEl || selectEl._hasHookedValue) return;
    selectEl._hasHookedValue = true;

    const origDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (origDesc) {
      Object.defineProperty(selectEl, 'value', {
        get() {
          return origDesc.get.call(this);
        },
        set(v) {
          origDesc.set.call(this, v);
          syncCustomSelectLabel(this);
        },
        configurable: true
      });
    }
  }

  function closeAllCustomSelects() {
    document.querySelectorAll('.custom-select.open').forEach((el) => {
      el.classList.remove('open');
      el.classList.remove('open-up');
      el.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
    });
  }

  function enhanceSelectElement(selectEl) {
    if (!selectEl || selectEl.parentElement?.classList.contains('custom-select')) return;

    const cleanClasses = (selectEl.className || '')
      .split(/\s+/)
      .filter((c) => c && !['form-select', 'class-select', 'form-input', 'input'].includes(c))
      .join(' ');

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select' + (cleanClasses ? ' ' + cleanClasses : '');
    if (selectEl.style.cssText) {
      wrapper.style.cssText = selectEl.style.cssText;
    }
    if (selectEl.id) {
      wrapper.setAttribute('data-custom-select-for', selectEl.id);
    }

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);

    selectEl.classList.add('custom-select-native');
    selectEl.tabIndex = -1;
    selectEl.setAttribute('aria-hidden', 'true');

    const currentVal = String(selectEl.value);
    const selectedLabel = selectEl.options[selectEl.selectedIndex]?.textContent || 'Pilih...';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `
      <span class="custom-select-label">${escapeHtml(selectedLabel)}</span>
      <svg class="custom-select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    `;
    wrapper.appendChild(trigger);

    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.innerHTML = Array.from(selectEl.options)
      .map(
        (opt) => `
        <div
          class="custom-select-option ${opt.value === currentVal ? 'selected' : ''}"
          role="option"
          tabindex="0"
          data-value="${escapeHtml(opt.value)}"
        >
          <span class="custom-select-option-text">${escapeHtml(opt.textContent)}</span>
          <svg class="custom-select-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      `
      )
      .join('');
    wrapper.appendChild(menu);

    hookCustomSelectValueProperty(selectEl);

    // Otomatis sinkronkan ulang opsi jika selectEl.innerHTML dimodifikasi
    const observer = new MutationObserver(() => {
      syncCustomSelectWithOptions(selectEl);
    });
    observer.observe(selectEl, { childList: true, subtree: true });
  }

  function enhanceAllSelects(root = document) {
    root.querySelectorAll('select.form-select, select.class-select').forEach((sel) => {
      if (!sel.classList.contains('custom-select-native')) {
        enhanceSelectElement(sel);
      }
    });
  }

  // Global Event Delegation untuk Custom Dropdown
  document.addEventListener('click', (e) => {
    // 1. Klik pada Tombol Pemicu (Trigger)
    const trigger = e.target.closest('.custom-select-trigger');
    if (trigger) {
      const wrapper = trigger.closest('.custom-select');
      if (!wrapper) return;
      e.stopPropagation();

      const wasOpen = wrapper.classList.contains('open');
      closeAllCustomSelects();

      if (!wasOpen) {
        wrapper.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');

        const nativeSelect = wrapper.querySelector('select.custom-select-native') || wrapper.querySelector('select');
        if (nativeSelect) hookCustomSelectValueProperty(nativeSelect);

        const menu = wrapper.querySelector('.custom-select-menu');
        const selected = menu?.querySelector('.custom-select-option.selected');
        if (selected && menu) {
          selected.scrollIntoView({ block: 'nearest' });
        }

        if (menu) {
          const rect = menu.getBoundingClientRect();
          // Cek posisi vertikal agar tidak melewati bawah viewport
          if (rect.bottom > window.innerHeight && rect.top > 220) {
            wrapper.classList.add('open-up');
          } else {
            wrapper.classList.remove('open-up');
          }
          // Cek posisi horizontal agar tidak terpotong tepi layar HP
          if (rect.right > window.innerWidth - 12) {
            menu.style.left = 'auto';
            menu.style.right = '0';
          } else {
            menu.style.left = '0';
            menu.style.right = 'auto';
          }
        }
      }
      return;
    }

    // 2. Klik pada Opsi Pilihan (Option)
    const option = e.target.closest('.custom-select-option');
    if (option) {
      const wrapper = option.closest('.custom-select');
      if (!wrapper) return;
      e.stopPropagation();

      const newValue = option.getAttribute('data-value');
      const nativeSelect = wrapper.querySelector('select.custom-select-native') || wrapper.querySelector('select');
      const labelEl = wrapper.querySelector('.custom-select-label');
      const textEl = option.querySelector('.custom-select-option-text');
      const newLabel = textEl ? textEl.textContent : option.textContent.trim();

      wrapper.querySelectorAll('.custom-select-option').forEach((opt) => {
        if (opt.getAttribute('data-value') === newValue) {
          opt.classList.add('selected');
        } else {
          opt.classList.remove('selected');
        }
      });

      if (labelEl) {
        labelEl.textContent = newLabel;
      }

      wrapper.classList.remove('open');
      wrapper.classList.remove('open-up');
      wrapper.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');

      if (nativeSelect) {
        const prevValue = nativeSelect.value;
        nativeSelect.value = newValue;
        if (prevValue !== newValue) {
          nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      return;
    }

    // 3. Klik di luar menutup seluruh dropdown
    closeAllCustomSelects();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllCustomSelects();
    }
  });

  // --------------------------------------------------------------------------
  // 5. ACCESSIBLE DIALOG & MODAL SYSTEM (SOLID BG, FOCUS TRAP, SCROLL LOCK)
  // --------------------------------------------------------------------------

  let previousActiveElementBeforeModal = null;
  let scrollLockCount = 0;

  function lockBodyScroll() {
    scrollLockCount++;
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
  }

  function unlockBodyScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  }

  function forceUnlockBodyScroll() {
    scrollLockCount = 0;
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  }

  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trapFocusInContainer(e, container) {
    if (!container) return;
    const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null
    );

    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || !container.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function openModal({ title, bodyHtml, footerHtml, onMount }) {
    const overlay = document.getElementById('modal-overlay');
    const container = document.getElementById('modal-container');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');

    if (!overlay || !container || !titleEl || !bodyEl || !footerEl) return;

    previousActiveElementBeforeModal = document.activeElement;

    titleEl.textContent = title || 'Dialog';
    bodyEl.innerHTML = bodyHtml || '';
    footerEl.innerHTML = footerHtml || '';

    // Tingkatkan seluruh native select di dalam modal menjadi custom select
    enhanceAllSelects(bodyEl);

    // Enforce solid surface-1 background on modal container
    container.style.backgroundColor = 'var(--surface-1)';

    overlay.classList.remove('hidden');
    lockBodyScroll();

    if (typeof onMount === 'function') {
      onMount(bodyEl, footerEl);
    }

    // Set initial focus
    requestAnimationFrame(() => {
      const autoFocusEl = container.querySelector('[autofocus]');
      if (autoFocusEl) {
        autoFocusEl.focus();
      } else {
        const firstFocusable = container.querySelector(FOCUSABLE_SELECTOR);
        if (firstFocusable) firstFocusable.focus();
        else container.focus?.();
      }
    });
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;

    overlay.classList.add('hidden');
    unlockBodyScroll();

    if (previousActiveElementBeforeModal && typeof previousActiveElementBeforeModal.focus === 'function') {
      previousActiveElementBeforeModal.focus();
      previousActiveElementBeforeModal = null;
    }
  }

  /**
   * Dialog / Modal Bottom Sheet Pemilih Konteks Kelas (Mobile & Desktop)
   * Terbuka saat chip kelas di topbar atau opsi 'Ganti Konteks Kelas' diklik.
   */
  async function openClassSelectorModal() {
    if (!state.classes || state.classes.length === 0) {
      await loadClassesForContext();
    }

    const isDev = isDeveloper();
    const currentGroupId = state.currentUser?.active_group_id || state.currentUser?.group_id;
    const currentClassName = state.currentUser?.class_name || 'Belum Ada Kelas';

    if (!isDev) {
      // Non-developer view: Info keterikatan kelas
      openModal({
        title: 'Konteks Kelas Aktif',
        bodyHtml: `
          <div class="class-info-modal-content">
            <div class="class-card-featured active">
              <div class="class-card-header">
                <div class="class-card-title-group">
                  <h3 class="class-card-name">${escapeHtml(currentClassName)}</h3>
                  <span class="badge badge-info" style="margin-top: 4px;">Kelas Anda</span>
                </div>
                <span class="class-card-check">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
              </div>
              <div class="class-card-meta">
                <span>Tahun Ajaran: <strong>${escapeHtml(state.currentUser?.academic_year || '2026/2027')}</strong></span>
                <span>Jabatan Anda: <strong>${escapeHtml(state.currentUser?.role || 'Pengurus')}</strong></span>
              </div>
            </div>
            <div class="alert-box-info" style="margin-top: 16px; padding: 12px 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">
              <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Konteks Terkunci</div>
              Akun Anda terikat pada kelas <strong>${escapeHtml(currentClassName)}</strong>. Seluruh data akademik, jadwal, siswa, dan kas dibatasi untuk kelas ini sesuai hak akses resmi.
            </div>
          </div>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary btn-block" data-close-modal>Mengerti</button>
        `
      });
      return;
    }

    // Developer view: Daftar kartu kelas interaktif
    const classes = state.classes || [];
    const classListHtml = classes.length === 0
      ? `<div class="empty-state-card" style="padding: 24px; text-align: center; color: var(--text-muted);">Belum ada data kelas yang terdaftar di database.</div>`
      : `
        <div class="class-picker-list" role="radiogroup" aria-label="Daftar kelas yang tersedia">
          ${classes.map((c) => {
            const isSelected = c.group_id === currentGroupId;
            const studentCount = Number(c.student_count || 0);
            return `
              <div
                class="class-picker-card ${isSelected ? 'active' : ''}"
                role="radio"
                aria-checked="${isSelected}"
                tabindex="0"
                data-switch-class="${escapeHtml(c.group_id)}"
                data-class-name="${escapeHtml(c.class_name)}"
              >
                <div class="class-picker-radio-indicator">
                  <div class="radio-circle ${isSelected ? 'checked' : ''}">
                    ${isSelected ? '<span class="radio-dot"></span>' : ''}
                  </div>
                </div>
                <div class="class-picker-info">
                  <div class="class-picker-header-row">
                    <strong class="class-picker-title">${escapeHtml(c.class_name)}</strong>
                    ${isSelected ? '<span class="badge badge-accent">Aktif Saat Ini</span>' : ''}
                  </div>
                  <div class="class-picker-details">
                    <span>${studentCount} Siswa</span>
                    <span class="dot-sep">•</span>
                    <span>TA ${escapeHtml(c.academic_year || '2026/2027')}</span>
                  </div>
                  <div class="class-item-jid font-mono text-subtle">${escapeHtml(c.group_id)}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

    openModal({
      title: 'Pilih Konteks Kelas',
      bodyHtml: `
        <div class="class-selector-modal-body">
          <p class="modal-description" style="margin-bottom: 14px; font-size: 0.85rem; color: var(--text-muted); line-height: 1.45;">
            Sebagai <strong>Developer</strong>, pilih ruang kelas untuk beralih konteks kerja secara instan:
          </p>
          ${classListHtml}
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary btn-block" data-close-modal>Tutup</button>
      `,
      onMount: (bodyEl) => {
        bodyEl.querySelectorAll('[data-switch-class]').forEach((card) => {
          const handleSelect = async () => {
            const targetGroupId = card.getAttribute('data-switch-class');
            const targetClassName = card.getAttribute('data-class-name') || targetGroupId;

            if (targetGroupId === state.currentUser?.active_group_id) {
              closeModal();
              return;
            }

            card.style.opacity = '0.6';
            card.style.pointerEvents = 'none';

            const res = await apiRequest('/api/classes/switch', {
              method: 'POST',
              body: { group_id: targetGroupId }
            });

            if (!res.ok) {
              card.style.opacity = '1';
              card.style.pointerEvents = 'auto';
              showToast(res.data?.error || 'Gagal berpindah konteks kelas.', 'error');
              return;
            }

            if (state.currentUser) {
              state.currentUser.active_group_id = targetGroupId;
              state.currentUser.class_name = res.data.class_info?.class_name || targetClassName;
            }

            state.scheduleWeek = null;
            state.cashWeek = null;

            renderUserAndClassContext();

            const selectEl = document.getElementById('developer-class-select');
            if (selectEl) selectEl.value = targetGroupId;

            closeModal();
            showToast(`Konteks kelas beralih ke ${targetClassName}`, 'success');

            await navigateToModule(state.activeModule || 'dashboard');
          };

          card.addEventListener('click', handleSelect);
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelect();
            }
          });
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5B. "LAINNYA" (MORE) BOTTOM SHEET & NAVIGATION SYNCHRONIZER
  // --------------------------------------------------------------------------

  let previousActiveElementBeforeSheet = null;

  const PRIMARY_NAV_SLOTS = ['dashboard', 'schedules', 'assignments', 'cash'];

  const MORE_NAV_ITEMS = [
    {
      id: 'students',
      label: 'Data Siswa',
      desc: 'Database & Biodata Siswa',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      canShow: () => true
    },
    {
      id: 'structure',
      label: 'Administrasi Kelas',
      desc: 'Struktur Organisasi & Pengumuman',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
      canShow: () => true
    },
    {
      id: 'finance',
      label: 'Buku Kas & Rekap',
      desc: 'Buku Kas, Pemasukan & Pengeluaran',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      canShow: () => canViewFinance()
    },
    {
      id: 'utilities',
      label: 'AI & Utilitas',
      desc: 'Asisten AI & Kalkulator Ilmiah',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z"/></svg>',
      canShow: () => true
    },
    {
      id: 'dev-console',
      label: 'Developer Console',
      desc: 'Metrik VPS, Konsol & Audit Log',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
      canShow: () => isDeveloper()
    },
    {
      id: 'switch-class',
      label: 'Ganti Konteks Kelas',
      desc: () => `Kelas aktif: ${state.currentUser?.class_name || 'Pilih kelas'}`,
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
      isAction: true,
      action: 'openClassSheet',
      canShow: () => isDeveloper()
    }
  ];

  function renderMoreNavigation() {
    const listEl = document.getElementById('sheet-nav-list');
    const u = state.currentUser;
    if (!listEl || !u) return;

    const visibleItems = MORE_NAV_ITEMS.filter((item) => item.canShow());

    listEl.innerHTML = visibleItems
      .map((item) => {
        const descText = typeof item.desc === 'function' ? item.desc() : item.desc;
        if (item.isAction) {
          return `
            <li>
              <button
                type="button"
                class="sheet-nav-item"
                data-action="${escapeHtml(item.action)}"
              >
                <div class="sheet-nav-icon">${item.icon}</div>
                <div class="sheet-nav-text">
                  <span class="sheet-nav-title">${escapeHtml(item.label)}</span>
                  <span class="sheet-nav-desc">${escapeHtml(descText)}</span>
                </div>
                <svg class="sheet-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </li>
          `;
        }
        return `
          <li>
            <button
              type="button"
              class="sheet-nav-item ${state.activeModule === item.id ? 'active' : ''}"
              data-navigate="${escapeHtml(item.id)}"
            >
              <div class="sheet-nav-icon">${item.icon}</div>
              <div class="sheet-nav-text">
                <span class="sheet-nav-title">${escapeHtml(item.label)}</span>
                <span class="sheet-nav-desc">${escapeHtml(descText)}</span>
              </div>
              <svg class="sheet-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </li>
        `;
      })
      .join('');

    // Update user profile section in sheet if present
    const sheetAvatar = document.getElementById('sheet-user-avatar');
    const sheetName = document.getElementById('sheet-user-name');
    const sheetPhone = document.getElementById('sheet-user-phone');
    const sheetRole = document.getElementById('sheet-user-role');

    const displayName = u.name || u.role || 'Pengurus';
    const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

    if (sheetAvatar) sheetAvatar.textContent = initial;
    if (sheetName) sheetName.textContent = displayName;
    if (sheetPhone) sheetPhone.textContent = formatPhoneDisplay(u.phone_number);
    if (sheetRole) {
      sheetRole.className = getRoleBadgeClass(u.role);
      sheetRole.textContent = u.role;
    }
  }

  function isMoreSheetOpen() {
    const sheet = document.getElementById('sheet-more-nav');
    return sheet && (sheet.classList.contains('open') || !sheet.classList.contains('hidden'));
  }

  function openMoreSheet() {
    const sheet = document.getElementById('sheet-more-nav');
    const backdrop = document.getElementById('backdrop-more-nav') || document.getElementById('sheet-more-backdrop');
    const triggerBtn = document.querySelector('[data-nav-slot="more"]');

    if (!sheet) return;

    previousActiveElementBeforeSheet = document.activeElement;

    sheet.style.backgroundColor = 'var(--surface-1)';

    renderMoreNavigation();

    sheet.classList.remove('hidden');
    sheet.classList.add('open');
    if (backdrop) backdrop.classList.remove('hidden');

    if (triggerBtn) {
      triggerBtn.setAttribute('aria-expanded', 'true');
      triggerBtn.classList.add('active');
    }

    lockBodyScroll();

    requestAnimationFrame(() => {
      const closeBtn = document.getElementById('btn-close-more-sheet') || sheet.querySelector(FOCUSABLE_SELECTOR);
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeMoreSheet() {
    const sheet = document.getElementById('sheet-more-nav');
    const backdrop = document.getElementById('backdrop-more-nav') || document.getElementById('sheet-more-backdrop');
    const triggerBtn = document.querySelector('[data-nav-slot="more"]');

    if (!sheet || sheet.classList.contains('hidden')) return;

    sheet.classList.remove('open');
    sheet.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');

    if (triggerBtn) {
      triggerBtn.setAttribute('aria-expanded', 'false');
    }

    unlockBodyScroll();

    // Re-sync slot 5 active state
    updateActiveNavState(state.activeModule);

    if (previousActiveElementBeforeSheet && typeof previousActiveElementBeforeSheet.focus === 'function') {
      previousActiveElementBeforeSheet.focus();
      previousActiveElementBeforeSheet = null;
    }
  }

  function updateActiveNavState(moduleId) {
    // 1. Desktop sidebar buttons
    const sidebarBtns = document.querySelectorAll('#sidebar-nav-list .nav-btn');
    sidebarBtns.forEach((btn) => {
      const isTarget = btn.getAttribute('data-navigate') === moduleId;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-current', isTarget ? 'page' : 'false');
    });

    // 2. Mobile bottom nav slots
    const isSecondaryModule = !PRIMARY_NAV_SLOTS.includes(moduleId);
    const bottomNavSlots = document.querySelectorAll('#mobile-bottom-nav [data-nav-slot]');

    bottomNavSlots.forEach((slot) => {
      const slotName = slot.getAttribute('data-nav-slot');
      let isActive = false;
      if (slotName === 'more') {
        isActive = isSecondaryModule;
      } else {
        isActive = slotName === moduleId;
      }
      slot.classList.toggle('active', isActive);
      slot.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    // 3. More sheet items
    const sheetNavItems = document.querySelectorAll('#sheet-more-nav [data-navigate]');
    sheetNavItems.forEach((btn) => {
      const isTarget = btn.getAttribute('data-navigate') === moduleId;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-current', isTarget ? 'page' : 'false');
    });
  }

  function updateNavVisibility() {
    const userCanViewCash = canViewCash();

    // 1. Sidebar desktop
    renderSidebarNavigation();

    // 2. Mobile bottom nav - Kas slot dynamic hiding for SEKRETARIS
    const cashSlot = document.querySelector('#mobile-bottom-nav [data-nav-slot="cash"]');
    if (cashSlot) {
      if (userCanViewCash) {
        cashSlot.classList.remove('hidden');
      } else {
        cashSlot.classList.add('hidden');
      }
    }

    // 3. More sheet items
    renderMoreNavigation();
  }

  // --------------------------------------------------------------------------
  // 6. AUTHENTICATION FLOW & SHELL INITIALIZATION
  // --------------------------------------------------------------------------

  function showAuthAlert(message, type = 'danger') {
    const alertEl = document.getElementById('auth-alert');
    if (!alertEl) return;
    if (!message) {
      alertEl.classList.add('hidden');
      alertEl.textContent = '';
      return;
    }
    alertEl.className = `alert-banner ${type === 'success' ? 'alert-success' : ''}`;
    alertEl.innerHTML = `
      <div class="state-error-content">
        <span style="font-size: 0.86rem;">${escapeHtml(message)}</span>
      </div>
    `;
    alertEl.classList.remove('hidden');
  }

  // --------------------------------------------------------------------------
  // LIVE PASSWORD STRENGTH & CONFIRM MATCH FEEDBACK
  // --------------------------------------------------------------------------
  function calculatePasswordStrength(password) {
    if (!password) {
      return { score: 0, label: 'Minimal 8 karakter', state: 'empty' };
    }

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    const variationCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;

    // 4 Kondisi Ketat Sesuai Kebutuhan Pengguna: Lemah, Cukup Kuat, Kuat, Sangat Kuat
    // 1. Lemah: panjang < 8 karakter atau hanya 1 jenis karakter
    if (password.length < 8 || variationCount <= 1) {
      return { score: 1, label: 'Lemah', state: 'weak' };
    }

    // 4. Sangat Kuat: (panjang >= 8 & 4 tipe karakter lengkap) ATAU (panjang >= 10 & minimal 3 tipe karakter)
    if ((password.length >= 8 && variationCount >= 4) || (password.length >= 10 && variationCount >= 3)) {
      return { score: 4, label: 'Sangat Kuat', state: 'very-strong' };
    }

    // 3. Kuat: (panjang >= 8 & 3 tipe karakter) ATAU (panjang >= 10 & minimal 2 tipe karakter)
    if (variationCount >= 3 || password.length >= 10) {
      return { score: 3, label: 'Kuat', state: 'strong' };
    }

    // 2. Cukup Kuat: panjang >= 8 dengan minimal 2 tipe karakter
    return { score: 2, label: 'Cukup Kuat', state: 'medium' };
  }

  function updatePasswordValidationUI() {
    const pwdInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-password-confirm');
    const badgeText = document.getElementById('strength-badge');
    const matchBadge = document.getElementById('reg-password-match-badge');

    const bars = [
      document.getElementById('strength-bar-1'),
      document.getElementById('strength-bar-2'),
      document.getElementById('strength-bar-3'),
      document.getElementById('strength-bar-4')
    ];

    const password = pwdInput ? pwdInput.value : '';
    const confirmPwd = confirmInput ? confirmInput.value : '';

    // 1. Progres Bar & Label Kekuatan Kata Sandi
    if (badgeText && bars[0]) {
      const strength = calculatePasswordStrength(password);
      badgeText.textContent = strength.label;
      badgeText.className = `strength-badge ${strength.state}`;

      const colorClassMap = {
        1: 'strength-weak',
        2: 'strength-medium',
        3: 'strength-strong',
        4: 'strength-very-strong'
      };

      bars.forEach((bar, index) => {
        if (!bar) return;
        bar.className = 'strength-bar';
        if (strength.score > 0 && index < strength.score) {
          bar.classList.add(colorClassMap[strength.score]);
        }
      });
    }

    // 2. Live Feedback Konfirmasi Kata Sandi di Atas Input
    if (matchBadge && confirmInput) {
      if (!confirmPwd) {
        matchBadge.classList.add('hidden');
        matchBadge.textContent = '';
        matchBadge.className = 'password-match-badge hidden';
        confirmInput.classList.remove('is-invalid', 'is-valid');
      } else if (password !== confirmPwd) {
        matchBadge.textContent = 'kata sandi anda tidak cocok';
        matchBadge.className = 'password-match-badge mismatch';
        matchBadge.classList.remove('hidden');
        confirmInput.classList.add('is-invalid');
        confirmInput.classList.remove('is-valid');
      } else {
        matchBadge.textContent = 'kata sandi cocok';
        matchBadge.className = 'password-match-badge matched';
        matchBadge.classList.remove('hidden');
        confirmInput.classList.remove('is-invalid');
        confirmInput.classList.add('is-valid');
      }
    }
  }

  function resetPasswordValidationUI() {
    const pwdInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-password-confirm');
    if (pwdInput) pwdInput.value = '';
    if (confirmInput) confirmInput.value = '';
    updatePasswordValidationUI();
  }

  function switchAuthTab(mode) {
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    showAuthAlert('');
    resetPasswordValidationUI();

    if (mode === 'register') {
      tabLogin?.classList.remove('active');
      tabLogin?.setAttribute('aria-selected', 'false');
      tabRegister?.classList.add('active');
      tabRegister?.setAttribute('aria-selected', 'true');
      formLogin?.classList.add('hidden');
      formRegister?.classList.remove('hidden');
    } else {
      tabRegister?.classList.remove('active');
      tabRegister?.setAttribute('aria-selected', 'false');
      tabLogin?.classList.add('active');
      tabLogin?.setAttribute('aria-selected', 'true');
      formRegister?.classList.add('hidden');
      formLogin?.classList.remove('hidden');
    }
  }

  async function checkInitialSession() {
    const res = await apiRequest('/api/auth/me');
    if (res.ok && res.data.user) {
      applyAuthenticatedUser(res.data);
      await enterAppShell();
    } else {
      showLoginView();
    }
  }

  function applyAuthenticatedUser(payload) {
    state.currentUser = {
      ...payload.user,
      csrf_token: payload.csrf_token
    };
    state.csrfToken = payload.csrf_token || null;
    state.permissions = payload.permissions || {};
  }

  function showLoginView() {
    state.currentUser = null;
    state.csrfToken = null;
    const appShell = document.getElementById('app-shell');
    const authView = document.getElementById('auth-view');
    if (appShell) {
      appShell.classList.add('hidden');
      appShell.style.display = 'none';
    }
    if (authView) {
      authView.classList.remove('hidden');
      authView.style.display = '';
    }
    const pageContent = document.getElementById('page-content');
    if (pageContent) pageContent.innerHTML = '';
    resetPasswordValidationUI();
  }

  async function enterAppShell() {
    const appShell = document.getElementById('app-shell');
    const authView = document.getElementById('auth-view');
    if (authView) {
      authView.classList.add('hidden');
      authView.style.display = 'none';
    }
    if (appShell) {
      appShell.classList.remove('hidden');
      appShell.style.display = '';
    }

    if (state.activeModule === 'cash' && !canViewCash()) {
      state.activeModule = 'dashboard';
    }

    renderUserAndClassContext();
    updateNavVisibility();
    await loadClassesForContext();
    await navigateToModule(state.activeModule || 'dashboard');
  }

  function renderUserAndClassContext() {
    const u = state.currentUser;
    if (!u) return;

    let cleanName = u.name;
    if (!cleanName || cleanName === 'Developer' || /^628\d+$/.test(cleanName)) {
      if (u.role === 'DEVELOPER' || String(u.phone_number).includes('6285155054456')) {
        cleanName = 'Rasyid';
      } else {
        cleanName = u.name || (u.role ? (u.role.charAt(0) + u.role.slice(1).toLowerCase()) : 'Pengurus');
      }
    }

    const displayName = cleanName || u.role || 'Pengurus';
    const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
    const className = u.class_name || 'Belum Ada Kelas';

    const avatarEl = document.getElementById('sidebar-user-avatar');
    const nameEl = document.getElementById('sidebar-user-name');
    const phoneEl = document.getElementById('sidebar-user-phone');
    const roleEl = document.getElementById('sidebar-user-role');

    if (avatarEl) avatarEl.textContent = initial;
    if (nameEl) nameEl.textContent = displayName;
    if (phoneEl) phoneEl.textContent = formatPhoneDisplay(u.phone_number);
    if (roleEl) {
      roleEl.className = getRoleBadgeClass(u.role);
      roleEl.textContent = u.role;
    }

    // Topbar & Mobile Indicators
    const topClassBadge = document.getElementById('topbar-class-badge');
    const topClassBtn = document.getElementById('topbar-class-btn');
    const topRoleBadge = document.getElementById('topbar-role-badge');
    const topPhoneLabel = document.getElementById('topbar-phone-label');
    const mobileClassPill = document.getElementById('mobile-class-pill');
    const mobileRoleBadge = document.getElementById('mobile-role-badge');

    if (topClassBadge) topClassBadge.textContent = className;
    if (topClassBtn) {
      if (isDeveloper()) {
        topClassBtn.classList.add('clickable');
        topClassBtn.title = 'Klik untuk beralih konteks kelas aktif (Developer)';
      } else {
        topClassBtn.classList.remove('clickable');
        topClassBtn.title = `Konteks kelas aktif: ${className}`;
      }
    }
    if (topRoleBadge) {
      topRoleBadge.className = getRoleBadgeClass(u.role);
      topRoleBadge.textContent = u.role;
    }
    // USER REQUIREMENT (Foto 2): Header / topbar kanan atas menampilkan nama pengguna (mis. "Rasyid"), bukan nomor telepon
    if (topPhoneLabel) {
      topPhoneLabel.textContent = displayName;
      topPhoneLabel.title = formatPhoneDisplay(u.phone_number);
    }
    if (mobileClassPill) mobileClassPill.textContent = className;
    if (mobileRoleBadge) {
      mobileRoleBadge.className = getRoleBadgeClass(u.role);
      mobileRoleBadge.textContent = u.role;
    }

    // Sidebar Class Context Panel
    const staticBox = document.getElementById('class-static-display');
    const switcherBox = document.getElementById('class-switcher-container');
    const lockTag = document.getElementById('sidebar-context-lock');
    const sideClassName = document.getElementById('sidebar-class-name');
    const sideGroupId = document.getElementById('sidebar-class-groupid');

    if (sideClassName) sideClassName.textContent = className;
    if (sideGroupId) sideGroupId.textContent = u.active_group_id || u.group_id || '';

    if (isDeveloper()) {
      staticBox?.classList.add('hidden');
      switcherBox?.classList.remove('hidden');
      if (lockTag) {
        lockTag.style.display = 'none';
      }
    } else {
      switcherBox?.classList.add('hidden');
      staticBox?.classList.remove('hidden');
      if (lockTag) {
        lockTag.style.display = 'none';
      }
    }
  }

  async function loadClassesForContext() {
    const res = await apiRequest('/api/classes');
    if (!res.ok) return;

    state.classes = res.data.classes || [];
    let activeGroupId = res.data.active_group_id || state.currentUser?.active_group_id;

    if (!activeGroupId && state.classes.length > 0 && isDeveloper()) {
      activeGroupId = state.classes[0].group_id;
    }

    if (activeGroupId && state.currentUser) {
      state.currentUser.active_group_id = activeGroupId;
      const matched = state.classes.find((c) => c.group_id === activeGroupId);
      if (matched) {
        state.currentUser.class_name = matched.class_name;
      }
    }

    renderUserAndClassContext();

    if (isDeveloper()) {
      const selectEl = document.getElementById('developer-class-select');
      if (selectEl) {
        if (state.classes.length === 0) {
          selectEl.innerHTML = '<option value="">Belum ada kelas terdaftar</option>';
        } else {
          selectEl.innerHTML = state.classes
            .map(
              (c) =>
                `<option value="${escapeHtml(c.group_id)}" ${
                  c.group_id === activeGroupId ? 'selected' : ''
                }>${escapeHtml(c.class_name)} (${Number(c.student_count || 0)} siswa)</option>`
            )
            .join('');
          selectEl.value = activeGroupId || (state.classes[0]?.group_id || '');
        }
        syncCustomSelectWithOptions(selectEl);
      }
    }
  }

  function renderSidebarNavigation() {
    const listEl = document.getElementById('sidebar-nav-list');
    if (!listEl || !state.currentUser) return;

    const userRole = state.currentUser.role;
    const visibleItems = NAV_ITEMS.filter((item) => item.canShow(userRole));

    listEl.innerHTML = visibleItems
      .map(
        (item) => `
        <li>
          <button
            type="button"
            class="nav-btn ${state.activeModule === item.id ? 'active' : ''}"
            data-navigate="${escapeHtml(item.id)}"
          >
            ${item.icon}
            <span>${escapeHtml(item.label)}</span>
          </button>
        </li>
      `
      )
      .join('');
  }

  function closeMobileDrawer() {
    document.getElementById('app-sidebar')?.classList.remove('open');
    document.getElementById('sidebar-backdrop')?.classList.add('hidden');
    document.getElementById('btn-mobile-menu')?.setAttribute('aria-expanded', 'false');
  }

  function openMobileDrawer() {
    document.getElementById('app-sidebar')?.classList.add('open');
    document.getElementById('sidebar-backdrop')?.classList.remove('hidden');
    document.getElementById('btn-mobile-menu')?.setAttribute('aria-expanded', 'true');
  }

  // --------------------------------------------------------------------------
  // 7. ROUTING & MODULE DISPATCHER
  // --------------------------------------------------------------------------

  async function navigateToModule(moduleId) {
    if (moduleId === 'cash' && !canViewCash()) {
      state.activeModule = 'cash';
      closeMobileDrawer();
      closeMoreSheet();
      updateActiveNavState('cash');

      const container = document.getElementById('page-content');
      if (container) {
        container.innerHTML = renderForbiddenState(
          'Sekretaris tidak memiliki izin untuk membuka atau melihat catatan keuangan Kas Kelas.'
        );
      }
      return;
    }

    if (moduleId === 'dev-console' && !isDeveloper()) {
      state.activeModule = 'dev-console';
      closeMobileDrawer();
      closeMoreSheet();
      updateActiveNavState('dev-console');

      const container = document.getElementById('page-content');
      if (container) {
        container.innerHTML = renderForbiddenState(
          'Halaman Developer Console hanya dapat diakses oleh akun dengan otorisasi DEVELOPER.'
        );
      }
      return;
    }

    state.activeModule = moduleId;
    closeMobileDrawer();
    closeMoreSheet();
    updateActiveNavState(moduleId);

    const navMeta =
      NAV_ITEMS.find((n) => n.id === moduleId) ||
      MORE_NAV_ITEMS.find((n) => n.id === moduleId) ||
      NAV_ITEMS[0];

    const moduleLabelEl = document.getElementById('topbar-module-label');
    const pageTitleEl = document.getElementById('topbar-page-title');
    const desktopPageTitleEl = document.getElementById('desktop-page-title');

    const titleText = navMeta.title || navMeta.desc || navMeta.label;
    if (moduleLabelEl) moduleLabelEl.textContent = navMeta.label;
    if (pageTitleEl) pageTitleEl.textContent = navMeta.label; // Mobile: judul ringkas ("Dashboard", "Jadwal", dll) agar tidak sesak
    if (desktopPageTitleEl) desktopPageTitleEl.textContent = titleText; // Desktop: judul lengkap

    const container = document.getElementById('page-content');
    if (!container) return;

    switch (moduleId) {
      case 'dashboard':
        await loadDashboardModule(container);
        break;
      case 'students':
        await loadStudentsModule(container);
        break;
      case 'schedules':
        await loadSchedulesModule(container);
        break;
      case 'cash':
        await loadCashModule(container);
        break;
      case 'finance':
        if (!canViewFinance()) {
          container.innerHTML = renderForbiddenState(
            'Akses ditolak: Sekretaris tidak memiliki hak akses ke modul Keuangan.'
          );
          return;
        }
        await loadFinanceModule(container);
        break;
      case 'assignments':
        await loadAssignmentsModule(container);
        break;
      case 'structure':
        await loadStructureModule(container);
        break;
      case 'utilities':
        renderUtilitiesModule(container);
        break;
      case 'dev-console':
        await loadDevConsoleModule(container);
        break;
      default:
        await loadDashboardModule(container);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // 8. MODULE 1: DASHBOARD (/api/dashboard/stats)
  // --------------------------------------------------------------------------

  async function loadDashboardModule(container) {
    container.innerHTML = renderLoadingState('Memuat ringkasan kelas aktif...');
    const res = await apiRequest('/api/dashboard/stats');

    if (res.status === 403) {
      container.innerHTML = renderForbiddenState(res.data.error);
      return;
    }
    if (!res.ok) {
      container.innerHTML = renderErrorState(res.data.error || 'Gagal memuat statistik dashboard.');
      return;
    }

    const d = res.data;
    const cls = d.class_info;

    if (!cls) {
      container.innerHTML = renderEmptyState({
        title: 'Belum Ada Kelas Terdaftar',
        description: 'Sistem belum memiliki grup kelas yang diinisialisasi di database.'
      });
      return;
    }

    state.activeSchoolWeek = Number(cls.current_week || 1);
    const showCashCard = Boolean(d.cash_summary) && canViewCash();
    const todaySchedules = d.today_schedules || [];
    const activeAssignments = d.active_assignments || [];

    const statsCardsHtml = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Identitas Kelas Aktif</span>
            <span class="stat-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            </span>
          </div>
          <div class="stat-value" style="font-size: 1.15rem;">${escapeHtml(cls.class_name)}</div>
          <div class="stat-footer">
            <span>TA ${escapeHtml(cls.academic_year || '2026/2027')} • Minggu ke-${Number(cls.current_week || 1)}</span>
            <a href="#structure" class="stat-link" data-navigate="structure">Struktur &rarr;</a>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Siswa Terdata</span>
            <span class="stat-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </span>
          </div>
          <div class="stat-value">${Number(d.student_count || 0)} <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">Siswa</span></div>
          <div class="stat-footer">
            <span>${Number(d.structure_count || 0)} jabatan pengurus aktif</span>
            <a href="#students" class="stat-link" data-navigate="students">Data Siswa &rarr;</a>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Tugas &amp; PR Aktif</span>
            <span class="stat-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
          </div>
          <div class="stat-value">${Number(d.active_assignments_count || 0)} <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">PR Aktif</span></div>
          <div class="stat-footer">
            <span>${Number(d.completed_assignments_count || 0)} tugas telah selesai</span>
            <a href="#assignments" class="stat-link" data-navigate="assignments">Kelola PR &rarr;</a>
          </div>
        </div>

        ${
          showCashCard
            ? `
          <div class="stat-card">
            <div class="stat-header">
              <span class="stat-label">Ringkasan Kas Kelas</span>
              <span class="stat-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </span>
            </div>
            <div class="stat-value">${formatRupiah(d.cash_summary.weekly_fee)}<span style="font-size: 0.85rem; font-weight: 500; color: var(--text-muted);">/mgg</span></div>
            <div class="stat-footer">
              <span>Lunas: ${Number(d.cash_summary.lunas_count || 0)} • Menunggak: ${Number(d.cash_summary.menunggak_count || 0)}</span>
              <a href="#cash" class="stat-link" data-navigate="cash">Rekap Kas &rarr;</a>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;

    const scheduleSectionHtml = `
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title-group">
            <h2 class="panel-title">Jadwal KBM Hari Ini (${escapeHtml(DAY_NAMES[cls.day_index] || 'Hari Ini')})</h2>
            <p class="panel-subtitle">Minggu Berjalan ke-${Number(cls.current_week || 1)} • ${escapeHtml(cls.class_name)}</p>
          </div>
          <div class="panel-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-navigate="schedules">Lihat Jadwal Penuh</button>
          </div>
        </div>
        <div class="panel-body ${todaySchedules.length > 0 ? 'no-pad' : ''}">
          ${
            todaySchedules.length === 0
              ? renderEmptyState({
                  title: 'Tidak Ada Jadwal KBM Hari Ini',
                  description:
                    cls.day_index === 0 || cls.day_index === 6
                      ? 'Hari ini adalah akhir pekan (libur KBM). Gunakan halaman Jadwal Pelajaran untuk melihat jadwal minggu depan.'
                      : 'Belum ada mata pelajaran yang dijadwalkan untuk hari ini.'
                })
              : `
              <!-- Timeline Vertikal Mobile (< 768px) -->
              <div class="mobile-card-list" style="padding: 10px;">
                ${todaySchedules
                  .map(
                    (s) => `
                  <div class="mobile-data-card" style="padding: 10px 12px; gap: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                      <span class="font-mono" style="font-size: 0.82rem; font-weight: 600; color: var(--accent);">${escapeHtml(s.time_start)} – ${escapeHtml(s.time_end)}</span>
                      <span class="badge ${s.block_type === 'BENGKEL' ? 'badge-warning' : 'badge-info'}" style="font-size: 0.68rem; padding: 1px 6px;">
                        ${escapeHtml(s.block_type || 'TEORI')}
                      </span>
                    </div>
                    <div style="font-weight: 600; font-size: 0.92rem; color: var(--text);">${escapeHtml(s.subject_name)}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(s.teacher_name)} • ${escapeHtml(s.room_name)}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>

              <!-- Tabel Jadwal Desktop (>= 768px) -->
              <div class="desktop-table-container table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Jam</th>
                      <th>Blok</th>
                      <th>Mata Pelajaran</th>
                      <th>Guru Pengampu</th>
                      <th>Ruang</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${todaySchedules
                      .map(
                        (s) => `
                      <tr>
                        <td class="font-mono">${escapeHtml(s.time_start)} – ${escapeHtml(s.time_end)}</td>
                        <td>
                          <span class="badge ${s.block_type === 'BENGKEL' ? 'badge-warning' : 'badge-info'}">
                            ${escapeHtml(s.block_type || 'TEORI')}
                          </span>
                        </td>
                        <td><strong>${escapeHtml(s.subject_name)}</strong></td>
                        <td>${escapeHtml(s.teacher_name)}</td>
                        <td>${escapeHtml(s.room_name)}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
          }
        </div>
      </section>
    `;

    const prSectionHtml = `
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title-group">
            <h2 class="panel-title">Daftar Tugas &amp; PR Aktif</h2>
            <p class="panel-subtitle">Diurutkan berdasarkan tenggat waktu terdekat</p>
          </div>
          <div class="panel-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-navigate="assignments">Semua PR</button>
          </div>
        </div>
        <div class="panel-body">
          ${
            activeAssignments.length === 0
              ? renderEmptyState({
                  title: 'Tidak Ada PR Aktif',
                  description: 'Semua tugas kelas saat ini telah selesai dikerjakan.'
                })
              : `
              <div class="assignment-list">
                ${activeAssignments
                  .slice(0, 5)
                  .map(
                    (a) => `
                  <div class="assignment-card">
                    <div class="assignment-main">
                      <div class="assignment-meta-top">
                        <span class="badge badge-warning">Aktif</span>
                        <span class="assignment-subject">${escapeHtml(a.subject)}</span>
                      </div>
                      <p class="assignment-desc">${escapeHtml(a.description)}</p>
                      <div class="assignment-footer-meta">
                        <span class="font-mono">Tenggat: ${escapeHtml(a.deadline)}</span>
                        <span>Oleh: ${escapeHtml(a.created_by)}</span>
                      </div>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            `
          }
        </div>
      </section>
    `;

    container.innerHTML = `
      ${statsCardsHtml}
      <div class="dashboard-split">
        ${scheduleSectionHtml}
        ${prSectionHtml}
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // 9. MODULE 2: DATA SISWA (/api/students)
  // --------------------------------------------------------------------------

  async function loadStudentsModule(container) {
    container.innerHTML = renderLoadingState('Memuat daftar siswa kelas...');
    const query = state.studentSearch ? `?search=${encodeURIComponent(state.studentSearch)}` : '';
    const res = await apiRequest(`/api/students${query}`);

    if (res.status === 403) {
      container.innerHTML = renderForbiddenState(res.data.error);
      return;
    }
    if (!res.ok) {
      container.innerHTML = renderErrorState(res.data.error || 'Gagal memuat data siswa.');
      return;
    }

    state.students = res.data.students || [];
    renderStudentsView(container);
  }

  function renderStudentsView(container) {
    const canWrite = canEditAcademic();
    const list = state.students;

    container.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-group">
          <div class="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="search"
              id="student-search-input"
              class="form-input"
              placeholder="Cari nama siswa, NIS, nomor HP, atau alamat..."
              value="${escapeHtml(state.studentSearch)}"
            />
          </div>
          <span class="badge badge-neutral">${list.length} Siswa Ditampilkan</span>
        </div>
        ${
          canWrite
            ? `
          <div class="panel-actions">
            <button type="button" id="btn-open-import-students" class="btn btn-secondary btn-sm">
              Impor Massal
            </button>
            <button type="button" id="btn-open-add-student" class="btn btn-primary btn-sm hide-mobile">
              + Tambah Siswa
            </button>
          </div>
        `
            : `<span class="badge badge-neutral">Mode Baca Saja (${escapeHtml(state.currentUser?.role)})</span>`
        }
      </div>

      <section class="panel">
        <div class="panel-body ${list.length > 0 ? 'no-pad' : ''}">
          ${
            list.length === 0
              ? renderEmptyState({
                  title: state.studentSearch ? 'Siswa Tidak Ditemukan' : 'Belum Ada Data Siswa',
                  description: state.studentSearch
                    ? `Tidak ditemukan siswa yang cocok dengan kata kunci "${state.studentSearch}".`
                    : 'Belum ada siswa yang terdaftar pada kelas ini.',
                  actionLabel: canWrite && !state.studentSearch ? '+ Tambah Siswa Pertama' : '',
                  actionId: canWrite && !state.studentSearch ? 'btn-empty-add-student' : ''
                })
              : `
              <!-- Daftar Kartu Siswa Mobile (< 768px) -->
              <div class="mobile-card-list">
                ${list
                  .map(
                    (s) => `
                  <div class="mobile-data-card">
                    <div class="mobile-card-top">
                      <div class="mobile-card-identity">
                        <span class="student-circle-num">#${Number(s.student_number)}</span>
                        <div style="min-width: 0;">
                          <div class="mobile-card-title">${escapeHtml(s.name)}</div>
                          <div class="mobile-card-meta">
                            <span class="font-mono">${escapeHtml(s.nis || '—')}</span>
                            <span>•</span>
                            <span class="font-mono">${escapeHtml(formatPhoneDisplay(s.phone_number))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    ${s.address ? `<div style="font-size: 0.78rem; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(s.address)}</div>` : ''}
                    <div class="mobile-card-actions">
                      <button type="button" class="btn btn-secondary btn-xs" data-student-detail="${Number(s.id)}">
                        Detail
                      </button>
                      ${
                        canWrite
                          ? `
                        <button type="button" class="btn btn-secondary btn-xs" data-student-edit="${Number(s.id)}">
                          Edit
                        </button>
                        <button type="button" class="btn btn-danger-soft btn-xs" data-student-delete="${Number(s.id)}">
                          Hapus
                        </button>
                      `
                          : ''
                      }
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>

              <!-- Tabel Siswa Desktop (>= 768px) -->
              <div class="desktop-table-container table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style="width: 80px;">No. Absen</th>
                      <th>Nama Lengkap</th>
                      <th>NIS</th>
                      <th>No. WhatsApp</th>
                      <th class="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${list
                      .map(
                        (s) => `
                      <tr>
                        <td class="font-mono" data-label="No. Absen"><strong>#${Number(s.student_number)}</strong></td>
                        <td data-label="Nama Lengkap">
                          <div style="font-weight: 600;">${escapeHtml(s.name)}</div>
                          ${s.address ? `<div class="text-subtle" style="font-size: 0.76rem;">${escapeHtml(s.address)}</div>` : ''}
                        </td>
                        <td class="font-mono" data-label="NIS">${escapeHtml(s.nis || '—')}</td>
                        <td class="font-mono" data-label="No. WhatsApp">${escapeHtml(formatPhoneDisplay(s.phone_number))}</td>
                        <td class="text-right" data-label="Aksi">
                          <div class="table-actions">
                            <button type="button" class="btn btn-secondary btn-xs" data-student-detail="${Number(s.id)}">
                              Detail
                            </button>
                            ${
                              canWrite
                                ? `
                              <button type="button" class="btn btn-secondary btn-xs" data-student-edit="${Number(s.id)}">
                                Edit
                              </button>
                              <button type="button" class="btn btn-danger btn-xs" data-student-delete="${Number(s.id)}">
                                Hapus
                              </button>
                            `
                                : ''
                            }
                          </div>
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
          }
        </div>
      </section>
      ${canWrite ? `<button type="button" class="fab" id="fab-add-student" aria-label="Tambah Siswa" title="Tambah Siswa">+</button>` : ''}
    `;

    document.getElementById('fab-add-student')?.addEventListener('click', () => {
      openStudentFormModal(null);
    });

    // Bind real-time search
    const searchInput = document.getElementById('student-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.studentSearch = e.target.value;
        clearTimeout(searchInput._timer);
        searchInput._timer = setTimeout(async () => {
          const q = state.studentSearch ? `?search=${encodeURIComponent(state.studentSearch)}` : '';
          const r = await apiRequest(`/api/students${q}`);
          if (r.ok) {
            state.students = r.data.students || [];
            const pos = searchInput.selectionStart;
            renderStudentsView(container);
            const nextInput = document.getElementById('student-search-input');
            if (nextInput) {
              nextInput.focus();
              nextInput.setSelectionRange(pos, pos);
            }
          }
        }, 220);
      });
    }

    document.getElementById('btn-open-add-student')?.addEventListener('click', () => openStudentFormModal(null));
    document.getElementById('btn-empty-add-student')?.addEventListener('click', () => openStudentFormModal(null));
    document.getElementById('btn-open-import-students')?.addEventListener('click', () => openStudentImportModal());
  }

  function openStudentDetailModal(studentId) {
    const s = state.students.find((it) => Number(it.id) === Number(studentId));
    if (!s) return;

    openModal({
      title: `Detail Biodata Siswa — Absen #${s.student_number}`,
      bodyHtml: `
        <div class="detail-grid">
          <div class="detail-label">Nomor Absen</div>
          <div class="detail-value font-mono">#${Number(s.student_number)}</div>

          <div class="detail-label">Nama Lengkap</div>
          <div class="detail-value">${escapeHtml(s.name)}</div>

          <div class="detail-label">Nama Ortu</div>
          <div class="detail-value">${escapeHtml(s.parent_name || 'Belum diisi')}</div>

          <div class="detail-label">Nomor Induk (NIS)</div>
          <div class="detail-value font-mono">${escapeHtml(s.nis || 'Belum diisi')}</div>

          <div class="detail-label">Tempat, Tgl Lahir</div>
          <div class="detail-value">${escapeHtml(s.birth_info || 'Belum diisi')}</div>

          <div class="detail-label">Alamat Domisili</div>
          <div class="detail-value">${escapeHtml(s.address || 'Belum diisi')}</div>

          <div class="detail-label">Nomor WhatsApp</div>
          <div class="detail-value font-mono">${escapeHtml(formatPhoneDisplay(s.phone_number))}</div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Tutup</button>
      `
    });
  }

  function openStudentFormModal(student = null) {
    const isEdit = Boolean(student);
    const nextNumber = isEdit
      ? student.student_number
      : (state.students.reduce((max, s) => Math.max(max, Number(s.student_number || 0)), 0) + 1);

    openModal({
      title: isEdit ? `Edit Biodata Siswa — #${student.student_number}` : 'Tambah Siswa Baru',
      bodyHtml: `
        <form id="modal-student-form" class="auth-form">
          <div class="form-row-2">
            <div class="form-group">
              <label for="st-number" class="form-label">Nomor Absen (1-50)</label>
              <input type="number" id="st-number" class="form-input font-mono" min="1" max="50" required value="${Number(nextNumber)}" />
            </div>
            <div class="form-group">
              <label for="st-nis" class="form-label">NIS</label>
              <input type="text" id="st-nis" class="form-input font-mono" placeholder="Contoh: 240192" value="${escapeHtml(student?.nis || '')}" />
            </div>
          </div>

          <div class="form-group">
            <label for="st-name" class="form-label">Nama Lengkap Siswa</label>
            <input type="text" id="st-name" class="form-input" placeholder="Masukkan nama lengkap" required value="${escapeHtml(student?.name || '')}" />
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label for="st-phone" class="form-label">Nomor WhatsApp</label>
              <input type="tel" id="st-phone" class="form-input font-mono" placeholder="081234567890" value="${escapeHtml(formatPhoneDisplay(student?.phone_number) === '—' ? '' : formatPhoneDisplay(student?.phone_number))}" />
            </div>
            <div class="form-group">
              <label for="st-birth" class="form-label">Tempat, Tanggal Lahir</label>
              <input type="text" id="st-birth" class="form-input" placeholder="Blitar, 12 Mei 2009" value="${escapeHtml(student?.birth_info || '')}" />
            </div>
          </div>

          <div class="form-group">
            <label for="st-address" class="form-label">Alamat Lengkap</label>
            <input type="text" id="st-address" class="form-input" placeholder="Jl. Raya Talun No. 10, Blitar" value="${escapeHtml(student?.address || '')}" />
          </div>

          <div class="form-group">
            <label for="st-parent-name" class="form-label">Nama Orang Tua</label>
            <input type="text" id="st-parent-name" class="form-input" placeholder="Nama ayah / ibu / wali" value="${escapeHtml(student?.parent_name || '')}" />
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-save-student" class="btn btn-primary">${isEdit ? 'Simpan Perubahan' : 'Tambahkan Siswa'}</button>
      `,
      onMount: () => {
        document.getElementById('btn-save-student')?.addEventListener('click', async () => {
          const payload = {
            student_number: parseInt(document.getElementById('st-number')?.value || '0', 10),
            name: document.getElementById('st-name')?.value.trim() || '',
            nis: document.getElementById('st-nis')?.value.trim() || '',
            phone_number: document.getElementById('st-phone')?.value.trim() || '',
            birth_info: document.getElementById('st-birth')?.value.trim() || '',
            address: document.getElementById('st-address')?.value.trim() || '',
            parent_name: document.getElementById('st-parent-name')?.value.trim() || ''
          };

          const url = isEdit ? `/api/students/${student.id}` : '/api/students';
          const method = isEdit ? 'PUT' : 'POST';
          const res = await apiRequest(url, { method, body: payload });

          if (!res.ok) {
            showToast(res.data.error || 'Gagal menyimpan data siswa.', 'error');
            return;
          }

          closeModal();
          showToast(res.data.message || 'Data siswa berhasil disimpan.', 'success');
          await loadStudentsModule(document.getElementById('page-content'));
        });
      }
    });
  }

  function openStudentImportModal() {
    openModal({
      title: 'Impor Daftar Siswa Massal',
      bodyHtml: `
        <div class="form-group">
          <label for="import-students-text" class="form-label">Daftar Siswa (Satu Siswa per Baris)</label>
          <textarea
            id="import-students-text"
            class="form-textarea font-mono"
            rows="7"
            placeholder="1. Ahmad Fauzi | 24001 | Blitar, 01-01-2009 | Talun | 081234567890&#10;2. Budi Santoso&#10;3. Citra Lestari"
          ></textarea>
          <span class="form-hint">Format: <code>No. Nama Lengkap</code> atau <code>No. Nama | NIS | TTL | Alamat | NoHP</code></span>
        </div>
        <div class="form-group">
          <span class="form-label">Pratinjau Baris Terdeteksi</span>
          <div id="import-preview-box" class="preview-terminal" style="max-height: 150px;">Ketik atau tempel daftar siswa di atas untuk melihat pratinjau...</div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-submit-import-students" class="btn btn-primary">Impor Sekarang</button>
      `,
      onMount: () => {
        const textarea = document.getElementById('import-students-text');
        const preview = document.getElementById('import-preview-box');

        textarea?.addEventListener('input', () => {
          const lines = (textarea.value || '').split('\n').filter((l) => /^\s*\d+[\.\)\-\s]+.+/.test(l));
          if (lines.length === 0) {
            preview.textContent = 'Belum ada baris dengan format "1. Nama Siswa" yang terdeteksi.';
          } else {
            preview.textContent = `Terdeteksi ${lines.length} siswa siap diimpor:\n` + lines.slice(0, 10).join('\n');
          }
        });

        document.getElementById('btn-submit-import-students')?.addEventListener('click', async () => {
          const text = textarea?.value.trim() || '';
          if (!text) {
            showToast('Masukkan teks daftar siswa terlebih dahulu.', 'warning');
            return;
          }
          const res = await apiRequest('/api/students/import', {
            method: 'POST',
            body: { text }
          });

          if (!res.ok) {
            showToast(res.data.error || 'Gagal mengimpor daftar siswa.', 'error');
            return;
          }

          closeModal();
          showToast(res.data.message || 'Impor siswa selesai.', 'success');
          await loadStudentsModule(document.getElementById('page-content'));
        });
      }
    });
  }

  function openStudentDeleteModal(studentId) {
    const s = state.students.find((it) => Number(it.id) === Number(studentId));
    if (!s) return;

    openModal({
      title: 'Konfirmasi Hapus Data Siswa',
      bodyHtml: `
        <p style="font-size: 0.92rem; color: var(--text);">
          Apakah Anda yakin ingin menghapus siswa <strong>#${Number(s.student_number)} — ${escapeHtml(s.name)}</strong> dari kelas ini?
        </p>
        <p class="form-hint" style="color: var(--danger);">
          Tindakan ini juga akan menghapus riwayat pembayaran kas yang terkait dengan siswa tersebut.
        </p>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-confirm-del-student" class="btn btn-danger">Ya, Hapus Siswa</button>
      `,
      onMount: () => {
        document.getElementById('btn-confirm-del-student')?.addEventListener('click', async () => {
          const res = await apiRequest(`/api/students/${s.id}`, { method: 'DELETE' });
          if (!res.ok) {
            showToast(res.data.error || 'Gagal menghapus siswa.', 'error');
            return;
          }
          closeModal();
          showToast(`Data siswa ${s.name} berhasil dihapus.`, 'success');
          await loadStudentsModule(document.getElementById('page-content'));
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 10. MODULE 3: JADWAL PELAJARAN (/api/schedules)
  // --------------------------------------------------------------------------

  async function loadSchedulesModule(container) {
    container.innerHTML = renderLoadingState('Memuat jadwal blok KBM...');

    const params = new URLSearchParams();
    if (state.scheduleWeek) params.set('week_number', String(state.scheduleWeek));
    if (state.scheduleTeacher) params.set('teacher', state.scheduleTeacher);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiRequest(`/api/schedules${qs}`);

    if (res.status === 403) {
      container.innerHTML = renderForbiddenState(res.data.error);
      return;
    }
    if (!res.ok) {
      container.innerHTML = renderErrorState(res.data.error || 'Gagal memuat jadwal pelajaran.');
      return;
    }

    state.activeSchoolWeek = Number(res.data.active_week || 1);
    if (!state.scheduleWeek) {
      state.scheduleWeek = state.activeSchoolWeek;
    }
    state.schedules = res.data.schedules || [];
    state.scheduleSubTab = state.scheduleSubTab || 'mapel';

    renderSchedulesView(container);
  }

  function renderSchedulesHoursView() {
    return `
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title-group">
            <h2 class="panel-title">Alokasi Jam Belajar Mengajar (KBM)</h2>
            <p class="panel-subtitle">Struktur pembagian sesi jam pelajaran dan waktu istirahat harian SMKN 1 Jenangan Ponorogo</p>
          </div>
        </div>
        <div class="panel-body">
          <div class="hours-grid">
            <!-- SENIN -->
            <div class="hours-day-card">
              <div class="hours-day-header">
                <div class="hours-day-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Senin</span>
                </div>
                <span class="badge badge-neutral" style="font-size: 0.72rem;">5 Jam + Upacara</span>
              </div>
              <div class="hours-timeline-list">
                <div class="hours-slot-row">
                  <span class="hours-slot-time">07:00 – 07:50</span>
                  <span class="hours-slot-name">Upacara Bendera</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">07:50 – 09:10</span>
                  <span class="hours-slot-name">Jam Ke-1</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">09:10 – 10:45</span>
                  <span class="hours-slot-name">Jam Ke-2</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">10:45 – 12:05</span>
                  <span class="hours-slot-name">Jam Ke-3</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">12:05 – 12:50</span>
                  <span class="hours-slot-name">Istirahat 2 &amp; ISHOMA</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">12:50 – 14:10</span>
                  <span class="hours-slot-name">Jam Ke-4</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">14:10 – 15:30</span>
                  <span class="hours-slot-name">Jam Ke-5</span>
                </div>
              </div>
            </div>

            <!-- SELASA & RABU -->
            <div class="hours-day-card">
              <div class="hours-day-header">
                <div class="hours-day-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Selasa &amp; Rabu</span>
                </div>
                <span class="badge badge-neutral" style="font-size: 0.72rem;">5 Jam Pelajaran</span>
              </div>
              <div class="hours-timeline-list">
                <div class="hours-slot-row">
                  <span class="hours-slot-time">07:00 – 08:30</span>
                  <span class="hours-slot-name">Jam Ke-1</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">08:30 – 10:00</span>
                  <span class="hours-slot-name">Jam Ke-2</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">10:00 – 10:15</span>
                  <span class="hours-slot-name">Istirahat 1</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">10:15 – 11:45</span>
                  <span class="hours-slot-name">Jam Ke-3</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">11:45 – 12:30</span>
                  <span class="hours-slot-name">Istirahat 2 &amp; ISHOMA</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">12:30 – 14:00</span>
                  <span class="hours-slot-name">Jam Ke-4</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">14:00 – 15:30</span>
                  <span class="hours-slot-name">Jam Ke-5</span>
                </div>
              </div>
            </div>

            <!-- KAMIS -->
            <div class="hours-day-card">
              <div class="hours-day-header">
                <div class="hours-day-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Kamis</span>
                </div>
                <span class="badge badge-neutral" style="font-size: 0.72rem;">5 Jam Pelajaran</span>
              </div>
              <div class="hours-timeline-list">
                <div class="hours-slot-row">
                  <span class="hours-slot-time">07:00 – 08:30</span>
                  <span class="hours-slot-name">Jam Ke-1</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">08:30 – 10:00</span>
                  <span class="hours-slot-name">Jam Ke-2</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">10:00 – 10:15</span>
                  <span class="hours-slot-name">Istirahat 1</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">10:15 – 11:45</span>
                  <span class="hours-slot-name">Jam Ke-3</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">11:45 – 12:30</span>
                  <span class="hours-slot-name">Istirahat 2 &amp; ISHOMA</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">12:30 – 14:00</span>
                  <span class="hours-slot-name">Jam Ke-4</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">14:00 – 15:00</span>
                  <span class="hours-slot-name">Jam Ke-5</span>
                </div>
              </div>
            </div>

            <!-- JUMAT -->
            <div class="hours-day-card">
              <div class="hours-day-header">
                <div class="hours-day-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Jumat</span>
                </div>
                <span class="badge badge-neutral" style="font-size: 0.72rem;">5 Jam + Refleksi</span>
              </div>
              <div class="hours-timeline-list">
                <div class="hours-slot-row">
                  <span class="hours-slot-time">07:00 – 08:30</span>
                  <span class="hours-slot-name">Jam Ke-1</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">08:30 – 10:00</span>
                  <span class="hours-slot-name">Jam Ke-2</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">10:00 – 10:15</span>
                  <span class="hours-slot-name">Istirahat 1</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">10:15 – 11:45</span>
                  <span class="hours-slot-name">Jam Ke-3</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">11:45 – 13:00</span>
                  <span class="hours-slot-name">Sholat Jumat &amp; ISHOMA</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">13:00 – 14:30</span>
                  <span class="hours-slot-name">Jam Ke-4</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">14:30 – 15:15</span>
                  <span class="hours-slot-name">Jam Ke-5</span>
                </div>
                <div class="hours-slot-row">
                  <span class="hours-slot-time">15:15 – 16:00</span>
                  <span class="hours-slot-name">Refleksi</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function formatScheduleNotes(notes) {
    if (!notes) return '';
    const trimmed = String(notes).trim();
    if (/wearpack|safety\s*shoes/i.test(trimmed)) return '';
    return trimmed;
  }

  function renderSchedulesView(container) {
    const canWrite = canEditAcademic();
    const currentWeek = Number(state.scheduleWeek || state.activeSchoolWeek || 1);
    const hasBengkel = state.schedules.some((s) => s.block_type === 'BENGKEL');

    // Deduplikasi mata pelajaran rolling untuk minggu aktif
    const uniqueSchedules = [];
    const seenSubjects = new Set();
    for (const item of state.schedules) {
      const key = `${(item.subject_name || '').trim().toLowerCase()}|${(item.teacher_name || '').trim().toLowerCase()}|${(item.room_name || '').trim().toLowerCase()}|${item.block_type}`;
      if (!seenSubjects.has(key)) {
        seenSubjects.add(key);
        uniqueSchedules.push(item);
      }
    }

    // Filter lokal berdasarkan input pencarian guru/mapel jika ada
    const query = (state.scheduleTeacher || '').trim().toLowerCase();
    const displaySchedules = query
      ? uniqueSchedules.filter((s) =>
          (s.subject_name || '').toLowerCase().includes(query) ||
          (s.teacher_name || '').toLowerCase().includes(query) ||
          (s.room_name || '').toLowerCase().includes(query)
        )
      : uniqueSchedules;

    const scheduleWeekOptionsList = [];
    for (let w = 1; w <= 20; w++) {
      const isCur = (w === state.activeSchoolWeek);
      scheduleWeekOptionsList.push({
        value: String(w),
        label: `Minggu ${w}${isCur ? ' (Minggu Ini)' : ''}`
      });
    }

    const isHoursTab = (state.scheduleSubTab === 'hours');

    container.innerHTML = `
      <div class="util-subtab-bar mb-3" role="tablist" aria-label="Sub-modul Jadwal">
        <button type="button" class="util-subtab-btn ${!isHoursTab ? 'active' : ''}" data-sched-subtab="mapel" role="tab" aria-selected="${!isHoursTab}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span>Jadwal Mata Pelajaran</span>
        </button>
        <button type="button" class="util-subtab-btn ${isHoursTab ? 'active' : ''}" data-sched-subtab="hours" role="tab" aria-selected="${isHoursTab}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Alokasi Jam KBM</span>
        </button>
      </div>

      ${
        isHoursTab
          ? renderSchedulesHoursView()
          : `
        <div class="toolbar">
          <div class="toolbar-group">
            <button type="button" id="btn-week-prev" class="btn btn-secondary btn-sm" ${currentWeek <= 1 ? 'disabled' : ''} title="Minggu Lalu">
              &larr;<span class="hide-sm"> Minggu Lalu</span>
            </button>
            <button type="button" id="btn-week-current" class="btn btn-secondary btn-sm" title="Minggu Ini">
              <span class="hide-sm">Minggu Ini </span>(Minggu ${state.activeSchoolWeek})
            </button>
            <button type="button" id="btn-week-next" class="btn btn-secondary btn-sm" ${currentWeek >= 20 ? 'disabled' : ''} title="Minggu Depan">
              <span class="hide-sm">Minggu Depan </span>&rarr;
            </button>
            ${renderCustomSelectHtml({
              id: 'schedule-week-select',
              value: String(currentWeek),
              options: scheduleWeekOptionsList,
              style: 'width: auto; min-width: 155px;'
            })}

            <div class="search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="search"
                id="schedule-teacher-input"
                class="form-input"
                placeholder="Cari guru / mapel..."
                value="${escapeHtml(state.scheduleTeacher)}"
              />
            </div>
          </div>

          ${
            canWrite
              ? `<button type="button" id="btn-add-schedule" class="btn btn-primary btn-sm hide-mobile">+ Tambah Jadwal</button>`
              : ''
          }
        </div>

        <section class="panel">
          <div class="panel-header">
            <div class="panel-title-group">
              <h2 class="panel-title">Daftar Mata Pelajaran — Minggu ke-${currentWeek}</h2>
              <p class="panel-subtitle">Menampilkan ${displaySchedules.length} mata pelajaran (Sistem Blok Rolling Harian)</p>
            </div>
          </div>
          <div class="panel-body ${displaySchedules.length > 0 ? 'no-pad' : ''}">
            ${
              displaySchedules.length === 0
                ? renderEmptyState({
                    title: `Belum Ada Jadwal pada Minggu ke-${currentWeek}`,
                    description: 'Tidak ditemukan mata pelajaran untuk minggu atau pencarian yang dipilih.',
                    actionLabel: canWrite ? '+ Tambah Jadwal Minggu Ini' : '',
                    actionId: canWrite ? 'btn-empty-add-schedule' : ''
                  })
                : `
                <!-- Tampilan Jadwal Mobile (< 768px) -->
                <div class="mobile-card-list">
                  ${displaySchedules
                    .map(
                      (item, idx) => `
                    <div class="schedule-card-compact">
                      <div class="schedule-card-compact-row">
                        <span class="badge ${item.block_type === 'BENGKEL' ? 'badge-warning' : 'badge-info'}" style="font-size: 0.72rem; padding: 2px 7px;">
                          ${escapeHtml(item.block_type)}
                        </span>
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">
                          ${item.block_type === 'BENGKEL' ? 'Praktik Bengkel' : 'Rolling Senin – Jumat'}
                        </span>
                      </div>
                      <div style="font-weight: 600; font-size: 0.95rem; color: var(--text); margin-top: 4px;">
                        ${escapeHtml(item.subject_name)}
                      </div>
                      <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
                        ${escapeHtml(item.teacher_name)} • <span class="badge badge-neutral" style="font-size: 0.72rem;">${escapeHtml(item.room_name)}</span>
                      </div>
                      ${formatScheduleNotes(item.notes) ? `<div style="font-size: 0.76rem; color: var(--text-faint); margin-top: 3px;">${escapeHtml(formatScheduleNotes(item.notes))}</div>` : ''}
                      ${
                        canWrite
                          ? `
                        <div class="mobile-card-actions" style="margin-top: 8px;">
                          <button type="button" class="btn btn-secondary btn-xs" data-schedule-edit="${Number(item.id)}">Edit</button>
                          <button type="button" class="btn btn-danger-soft btn-xs" data-schedule-delete="${Number(item.id)}">Hapus</button>
                        </div>
                      `
                          : ''
                      }
                    </div>
                  `
                    )
                    .join('')}
                </div>

                <!-- Tabel Jadwal Desktop (>= 768px) -->
                <div class="desktop-table-container table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th style="width: 50px; text-align: center;">No</th>
                        <th style="width: 110px;">Tipe Blok</th>
                        <th>Mata Pelajaran</th>
                        <th>Guru Pengampu</th>
                        <th>Ruangan</th>
                        <th>Keterangan / Alur</th>
                        ${canWrite ? '<th class="text-right" style="width: 120px;">Aksi</th>' : ''}
                      </tr>
                    </thead>
                    <tbody>
                      ${displaySchedules
                        .map(
                          (item, idx) => `
                        <tr>
                          <td data-label="No" style="text-align: center; color: var(--text-faint); font-weight: 500;">${idx + 1}</td>
                          <td data-label="Tipe Blok">
                            <span class="badge ${item.block_type === 'BENGKEL' ? 'badge-warning' : 'badge-info'}">
                              ${escapeHtml(item.block_type)}
                            </span>
                          </td>
                          <td data-label="Mata Pelajaran">
                            <div style="font-weight: 600; font-size: 0.94rem;">${escapeHtml(item.subject_name)}</div>
                          </td>
                          <td data-label="Guru Pengampu">
                            <span style="font-weight: 500;">${escapeHtml(item.teacher_name)}</span>
                          </td>
                          <td data-label="Ruangan">
                            <span class="badge badge-neutral" style="font-size: 0.78rem;">${escapeHtml(item.room_name)}</span>
                          </td>
                          <td data-label="Keterangan / Alur">
                            <div style="font-size: 0.82rem; color: var(--text-muted);">
                              ${item.block_type === 'BENGKEL' ? 'Praktikum Bengkel / Lab' : 'Rolling Harian (Senin s/d Jumat)'}
                            </div>
                            ${formatScheduleNotes(item.notes) ? `<div class="text-subtle" style="font-size: 0.75rem;">${escapeHtml(formatScheduleNotes(item.notes))}</div>` : ''}
                          </td>
                          ${
                            canWrite
                              ? `
                            <td class="text-right" data-label="Aksi">
                              <div class="table-actions">
                                <button type="button" class="btn btn-secondary btn-xs" data-schedule-edit="${Number(item.id)}">Edit</button>
                                <button type="button" class="btn btn-danger btn-xs" data-schedule-delete="${Number(item.id)}">Hapus</button>
                              </div>
                            </td>
                          `
                              : ''
                          }
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
            }
          </div>
        </section>
        ${canWrite ? `<button type="button" class="fab" id="fab-add-schedule" aria-label="Tambah Jadwal" title="Tambah Jadwal">+</button>` : ''}
      `
      }
    `;

    // Handler Tab Switcher Jadwal
    container.querySelectorAll('[data-sched-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-sched-subtab');
        if (tab && tab !== state.scheduleSubTab) {
          state.scheduleSubTab = tab;
          renderSchedulesView(container);
        }
      });
    });

    if (!isHoursTab) {
      document.getElementById('fab-add-schedule')?.addEventListener('click', () => {
        openScheduleFormModal(null);
      });

      // Bind schedule filter events
      document.getElementById('btn-week-prev')?.addEventListener('click', () => {
        if (state.scheduleWeek > 1) {
          state.scheduleWeek--;
          loadSchedulesModule(container);
        }
      });

      document.getElementById('btn-week-current')?.addEventListener('click', () => {
        state.scheduleWeek = state.activeSchoolWeek;
        loadSchedulesModule(container);
      });

      document.getElementById('btn-week-next')?.addEventListener('click', () => {
        if (state.scheduleWeek < 20) {
          state.scheduleWeek++;
          loadSchedulesModule(container);
        }
      });

      document.getElementById('schedule-week-select')?.addEventListener('change', (e) => {
        state.scheduleWeek = parseInt(e.target.value, 10) || 1;
        loadSchedulesModule(container);
      });

      const teacherInput = document.getElementById('schedule-teacher-input');
      teacherInput?.addEventListener('input', (e) => {
        state.scheduleTeacher = e.target.value;
        clearTimeout(teacherInput._timer);
        teacherInput._timer = setTimeout(() => {
          loadSchedulesModule(container);
        }, 280);
      });

      document.getElementById('btn-add-schedule')?.addEventListener('click', () => openScheduleFormModal(null));
      document.getElementById('btn-empty-add-schedule')?.addEventListener('click', () => openScheduleFormModal(null));
    }
  }

  function openScheduleFormModal(schedule = null) {
    const isEdit = Boolean(schedule);
    const defaultWeek = schedule?.week_number || state.scheduleWeek || state.activeSchoolWeek || 1;
    const defaultDay = schedule?.day_index || 1;

    openModal({
      title: isEdit ? 'Edit Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran',
      bodyHtml: `
        <form id="modal-schedule-form" class="auth-form">
          <div class="form-row-3">
            <div class="form-group">
              <label for="sch-week" class="form-label">Minggu (1-20)</label>
              <input type="number" id="sch-week" class="form-input font-mono" min="1" max="20" required value="${Number(defaultWeek)}" />
            </div>
            <div class="form-group">
              <label for="sch-day" class="form-label">Hari KBM</label>
              ${renderCustomSelectHtml({
                id: 'sch-day',
                value: String(defaultDay),
                options: [
                  { value: '1', label: 'Senin' },
                  { value: '2', label: 'Selasa' },
                  { value: '3', label: 'Rabu' },
                  { value: '4', label: 'Kamis' },
                  { value: '5', label: 'Jumat' }
                ],
                style: 'width: 100%;'
              })}
            </div>
            <div class="form-group">
              <label for="sch-block" class="form-label">Tipe Blok</label>
              ${renderCustomSelectHtml({
                id: 'sch-block',
                value: schedule?.block_type || 'TEORI',
                options: [
                  { value: 'TEORI', label: 'TEORI' },
                  { value: 'BENGKEL', label: 'BENGKEL' }
                ],
                style: 'width: 100%;'
              })}
            </div>
          </div>

          <div class="form-group">
            <label for="sch-subject" class="form-label">Nama Mata Pelajaran</label>
            <input type="text" id="sch-subject" class="form-input" placeholder="Contoh: Pemrograman Web & Perangkat Bergerak" required value="${escapeHtml(schedule?.subject_name || '')}" />
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label for="sch-teacher" class="form-label">Nama Guru Pengampu</label>
              <input type="text" id="sch-teacher" class="form-input" placeholder="Nama lengkap guru" required value="${escapeHtml(schedule?.teacher_name || '')}" />
            </div>
            <div class="form-group">
              <label for="sch-room" class="form-label">Ruang / Bengkel</label>
              <input type="text" id="sch-room" class="form-input" placeholder="Ruang Teori (R.2) / Lab RPL" required value="${escapeHtml(schedule?.room_name || '')}" />
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label for="sch-start" class="form-label">Jam Mulai</label>
              <input type="time" id="sch-start" class="form-input font-mono" value="${escapeHtml(schedule?.time_start || '07:00')}" />
            </div>
            <div class="form-group">
              <label for="sch-end" class="form-label">Jam Selesai</label>
              <input type="time" id="sch-end" class="form-input font-mono" value="${escapeHtml(schedule?.time_end || '15:30')}" />
            </div>
          </div>

          <div class="form-group">
            <label for="sch-notes" class="form-label">Catatan Tambahan (Opsional)</label>
            <input type="text" id="sch-notes" class="form-input" placeholder="Contoh: Bawa modul praktikum" value="${escapeHtml(schedule?.notes || '')}" />
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-save-schedule" class="btn btn-primary">${isEdit ? 'Simpan Perubahan' : 'Tambahkan Jadwal'}</button>
      `,
      onMount: () => {
        document.getElementById('btn-save-schedule')?.addEventListener('click', async () => {
          const payload = {
            week_number: parseInt(document.getElementById('sch-week')?.value || '1', 10),
            day_index: parseInt(document.getElementById('sch-day')?.value || '1', 10),
            block_type: document.getElementById('sch-block')?.value || 'TEORI',
            subject_name: document.getElementById('sch-subject')?.value.trim() || '',
            teacher_name: document.getElementById('sch-teacher')?.value.trim() || '',
            room_name: document.getElementById('sch-room')?.value.trim() || '',
            time_start: document.getElementById('sch-start')?.value || '07:00',
            time_end: document.getElementById('sch-end')?.value || '15:30',
            notes: document.getElementById('sch-notes')?.value.trim() || ''
          };

          const url = isEdit ? `/api/schedules/${schedule.id}` : '/api/schedules';
          const method = isEdit ? 'PUT' : 'POST';
          const res = await apiRequest(url, { method, body: payload });

          if (!res.ok) {
            showToast(res.data.error || 'Gagal menyimpan jadwal.', 'error');
            return;
          }

          closeModal();
          showToast(res.data.message || 'Jadwal berhasil disimpan.', 'success');
          await loadSchedulesModule(document.getElementById('page-content'));
        });
      }
    });
  }

  function openScheduleDeleteModal(scheduleId) {
    const item = state.schedules.find((s) => Number(s.id) === Number(scheduleId));
    if (!item) return;

    openModal({
      title: 'Konfirmasi Hapus Jadwal',
      bodyHtml: `
        <p style="font-size: 0.92rem;">
          Hapus jadwal <strong>${escapeHtml(item.subject_name)}</strong> (${escapeHtml(DAY_NAMES[item.day_index])}, Minggu ke-${Number(item.week_number)}) oleh <strong>${escapeHtml(item.teacher_name)}</strong>?
        </p>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-confirm-del-schedule" class="btn btn-danger">Ya, Hapus Jadwal</button>
      `,
      onMount: () => {
        document.getElementById('btn-confirm-del-schedule')?.addEventListener('click', async () => {
          const res = await apiRequest(`/api/schedules/${item.id}`, { method: 'DELETE' });
          if (!res.ok) {
            showToast(res.data.error || 'Gagal menghapus jadwal.', 'error');
            return;
          }
          closeModal();
          showToast('Jadwal berhasil dihapus.', 'success');
          await loadSchedulesModule(document.getElementById('page-content'));
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 11. MODULE 4: KAS KELAS (/api/cash/*)
  // --------------------------------------------------------------------------

  async function loadCashModule(container) {
    if (!canViewCash()) {
      container.innerHTML = renderForbiddenState(
        'Sekretaris tidak memiliki hak akses untuk membuka modul Kas Kelas.'
      );
      return;
    }

    container.innerHTML = renderLoadingState('Memuat rekapitulasi & pengaturan kas kelas...');

    const [settingsRes, recapRes] = await Promise.all([
      apiRequest('/api/cash/settings'),
      apiRequest('/api/cash/recap')
    ]);

    if (settingsRes.status === 403 || recapRes.status === 403) {
      container.innerHTML = renderForbiddenState(
        settingsRes.data?.error || recapRes.data?.error || 'Akses ke modul Kas Kelas ditolak.'
      );
      return;
    }

    if (!settingsRes.ok || !recapRes.ok) {
      container.innerHTML = renderErrorState(
        settingsRes.data?.error || recapRes.data?.error || 'Gagal memuat data kas kelas.'
      );
      return;
    }

    state.cashSettings = settingsRes.data.settings || { weekly_fee: 0, active_weeks_count: 0 };
    state.cashTreasurers = settingsRes.data.treasurers || [];
    state.cashTreasurerNames = settingsRes.data.treasurer_names || [];
    state.cashActiveSchoolWeek = settingsRes.data.active_school_week || state.activeSchoolWeek || 2;
    if (!state.cashWeek || state.cashWeek < 2) {
      state.cashWeek = Math.max(2, state.cashActiveSchoolWeek);
    }
    state.cashRecap = recapRes.data.students || [];
    state.cashFormattedText = recapRes.data.formatted_text || '';

    renderCashView(container);
  }

  function renderCashView(container) {
    const isEditable = canEditCash();
    const fee = Number(state.cashSettings.weekly_fee || 0);
    const maxWeek = Number(state.cashSettings.active_weeks_count || 1);
    const hasWeek1 = (state.cashRecap && state.cashRecap.some((s) => s.weeks && s.weeks[1]));
    const startCashWeek = hasWeek1 ? 1 : 2;
    const endCashWeek = Math.max(startCashWeek, maxWeek, 20);
    const currentCashWeek = Math.max(startCashWeek, Math.min(Number(state.cashWeek || state.cashActiveSchoolWeek || startCashWeek), endCashWeek));
    const activeWeeks = Math.max(0, maxWeek - startCashWeek + 1);

    // USER REQUIREMENT (Foto 1): Kartu Daftar Bendahara Kelas menampilkan NAMA bukan nomor telepon
    let treasurersText = 'Belum ada bendahara terdaftar';
    if (Array.isArray(state.cashTreasurerNames) && state.cashTreasurerNames.length > 0) {
      treasurersText = state.cashTreasurerNames.join(', ');
    } else if (Array.isArray(state.cashTreasurers) && state.cashTreasurers.length > 0) {
      treasurersText = state.cashTreasurers
        .map((t) => {
          if (typeof t === 'string') return formatPhoneDisplay(t);
          return t.name || formatPhoneDisplay(t.phone_number || '');
        })
        .join(', ');
    }

    // USER REQUIREMENT: Toolbar pemilih minggu kas (dimulai dari Minggu ke-2)
    const weekOptions = [];
    const cashWeekOptionsList = [];
    for (let w = startCashWeek; w <= endCashWeek; w++) {
      const isCur = (w === state.cashActiveSchoolWeek);
      weekOptions.push(
        `<option value="${w}" ${w === currentCashWeek ? 'selected' : ''}>Minggu ${w}${
          isCur ? ' (Minggu Ini)' : ''
        }</option>`
      );
      cashWeekOptionsList.push({
        value: String(w),
        label: `Minggu ${w}${isCur ? ' (Minggu Ini)' : ''}`
      });
    }

    const weekHeaders = [
      `<th class="text-center font-mono" style="min-width: 90px; font-weight: 600;">Minggu ${currentCashWeek}</th>`
    ];

    let displayedStudents = state.cashRecap;
    if (state.cashSearch && state.cashSearch.trim()) {
      const q = state.cashSearch.toLowerCase().trim();
      displayedStudents = state.cashRecap.filter((st) =>
        st.name.toLowerCase().includes(q) || String(st.student_number).includes(q)
      );
    }

    const totalStudents = state.cashRecap.length;
    const paidStudentsCount = state.cashRecap.filter((s) => s.is_lunas).length;
    const paidPercent = totalStudents > 0 ? Math.round((paidStudentsCount / totalStudents) * 100) : 0;

    container.innerHTML = `
      <!-- Ringkasan Kas Terpadu Mobile (< 768px) -->
      <div class="cash-unified-summary hide-desktop">
        <div class="cash-unified-row-top">
          <div class="cash-unified-amount">
            ${formatRupiah(fee)}<span> / siswa / mgg</span>
          </div>
          <span class="badge badge-info" style="font-size: 0.76rem;">
            Minggu 2 – ${startCashWeek + activeWeeks - 1} (${activeWeeks} Minggu Aktif)
          </span>
        </div>

        <div class="cash-progress-box">
          <div class="cash-progress-labels">
            <span><strong>${paidStudentsCount}</strong> dari ${totalStudents} siswa lunas</span>
            <span class="font-mono">${paidPercent}%</span>
          </div>
          <div class="cash-progress-bar">
            <div class="cash-progress-fill" style="width: ${paidPercent}%;"></div>
          </div>
        </div>

        <div class="cash-unified-footer">
          <div>Bendahara: <strong>${escapeHtml(treasurersText)}</strong></div>
          <span class="badge ${isEditable ? 'badge-success-soft' : 'badge-neutral'}">
            ${isEditable ? 'Izin Kelola Aktif' : 'Mode Baca Saja'}
          </span>
        </div>
      </div>

      <!-- Kartu Statistik Kas Desktop (>= 768px) -->
      <div class="stats-grid hide-mobile">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Tarif Kas Mingguan</span>
          </div>
          <div class="stat-value font-mono">${formatRupiah(fee)}</div>
          <div class="stat-footer">
            <span>Tarif per siswa per minggu aktif</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Jumlah Minggu Aktif</span>
          </div>
          <div class="stat-value font-mono">${activeWeeks} <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">Minggu</span></div>
          <div class="stat-footer">
            <span>Minggu 2 s/d ${startCashWeek + activeWeeks - 1} • Total: ${formatRupiah(fee * activeWeeks)}/siswa</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Daftar Bendahara Kelas</span>
          </div>
          <div class="stat-value" style="font-size: 1.05rem;">${escapeHtml(treasurersText)}</div>
          <div class="stat-footer">
            <span>${isEditable ? 'Anda memiliki izin kelola kas' : 'Mode Baca Saja (Read-Only)'}</span>
          </div>
        </div>
      </div>

      <!-- Toolbar Pemilih Minggu & Pencarian Kas Kelas -->
      <div class="toolbar" style="margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
        <div class="toolbar-group" style="flex: 0 0 auto; display: flex; align-items: center; gap: 8px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cash-prev-week" title="Minggu Lalu" ${currentCashWeek <= startCashWeek ? 'disabled' : ''} style="padding: 6px 12px; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            <span class="hide-mobile">Minggu Lalu</span>
          </button>
          ${renderCustomSelectHtml({
            id: 'cash-week-select',
            value: String(currentCashWeek),
            options: cashWeekOptionsList,
            style: 'width: auto; min-width: 175px;'
          })}
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cash-next-week" title="Minggu Depan" ${currentCashWeek >= endCashWeek ? 'disabled' : ''} style="padding: 6px 12px; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
            <span class="hide-mobile">Minggu Depan</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div class="toolbar-actions" style="margin-left: auto;">
          <div class="search-box" style="min-width: 220px; max-width: 320px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="cash-search-input" class="form-input" placeholder="Cari nama siswa..." value="${escapeHtml(state.cashSearch || '')}" />
          </div>
        </div>
      </div>

      <!-- Pengaturan Tarif & Minggu Kas (Accordion Tertutup) -->
      ${
        isEditable
          ? `
        <div class="accordion-panel" id="accordion-cash-settings">
          <button type="button" class="accordion-toggle" id="btn-toggle-cash-settings" aria-expanded="false">
            <span>⚙️ Pengaturan Tarif &amp; Minggu Aktif Kas</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="accordion-content">
            <form id="cash-settings-form" class="form-row-3" style="align-items: flex-end;">
              <div class="form-group">
                <label for="input-cash-fee" class="form-label">Tarif Kas Mingguan (Rp)</label>
                <input type="number" id="input-cash-fee" class="form-input font-mono" min="0" step="500" value="${fee}" required />
              </div>
              <div class="form-group">
                <label for="input-cash-weeks" class="form-label">Jumlah Minggu Aktif (0-52)</label>
                <input type="number" id="input-cash-weeks" class="form-input font-mono" min="0" max="52" value="${activeWeeks}" required />
              </div>
              <div class="form-group">
                <button type="submit" class="btn btn-primary">Simpan Pengaturan Kas</button>
              </div>
            </form>
          </div>
        </div>
      `
          : ''
      }

      <section class="panel">
        <div class="panel-header">
          <div class="panel-title-group">
            <h2 class="panel-title">Tabel Rekapitulasi Kas Siswa</h2>
            <p class="panel-subtitle">
              Menampilkan kas: <strong>Minggu ${currentCashWeek}</strong> • Format: centang untuk lunas, nominal untuk tunggakan
            </p>
          </div>
        </div>
        <div class="panel-body ${displayedStudents.length > 0 ? 'no-pad' : ''}">
          ${
            displayedStudents.length === 0
              ? renderEmptyState({
                  title: state.cashSearch ? 'Siswa Tidak Ditemukan' : 'Belum Ada Data Siswa untuk Rekap Kas',
                  description: state.cashSearch ? `Tidak ada siswa dengan kata kunci "${escapeHtml(state.cashSearch)}".` : 'Tambahkan daftar siswa terlebih dahulu pada menu Data Siswa.'
                })
              : `
              <!-- Daftar Kartu Siswa Mobile (< 768px) -->
              <div class="mobile-card-list">
                ${displayedStudents
                  .map((st) => {
                    const paid = Boolean(st.weeks && st.weeks[currentCashWeek]);
                    const weekChips = [
                      `
                        <div class="cash-card-week-slot">
                          <span class="cash-card-week-label">Minggu ${currentCashWeek}</span>
                          <button
                            type="button"
                            class="cash-week-btn ${paid ? 'paid' : 'unpaid'}"
                            ${isEditable ? `data-toggle-cash="${Number(st.student_id)}:${currentCashWeek}:${paid ? 0 : 1}"` : 'disabled'}
                            title="Minggu ${currentCashWeek}: ${paid ? 'Lunas' : 'Belum Lunas'}"
                          >
                            ${paid ? '✓' : '—'}
                          </button>
                        </div>
                      `
                    ];
                    return `
                      <div class="mobile-data-card">
                        <div class="mobile-card-top">
                          <div class="mobile-card-identity">
                            <span class="student-circle-num">#${Number(st.student_number)}</span>
                            <div style="min-width: 0;">
                              <div class="mobile-card-title">${escapeHtml(st.name)}</div>
                            </div>
                          </div>
                          <div data-cash-status="${Number(st.student_id)}">
                            ${
                              st.is_lunas
                                ? '<span class="badge badge-success">LUNAS</span>'
                                : `<span class="badge badge-warning">${escapeHtml(st.status_label)}</span>`
                            }
                          </div>
                        </div>
                        <div class="cash-weeks-strip">
                          ${weekChips.join('')}
                          <div class="cash-card-week-slot">
                            <span class="cash-card-week-label">Semua</span>
                            <button type="button" class="cash-week-btn" data-cash-view-all="${Number(st.student_id)}" style="color: var(--accent); font-weight: 600;" title="Lihat rekap seluruh minggu">
                              &rarr;
                            </button>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>

              <!-- Tabel Kas Desktop (>= 768px) -->
              <div class="desktop-table-container table-responsive table-responsive-cash">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style="width: 70px;">Absen</th>
                      <th>Nama Siswa</th>
                      ${weekHeaders.join('')}
                      <th class="text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${displayedStudents
                      .map((st) => {
                        const paid = Boolean(st.weeks && st.weeks[currentCashWeek]);
                        const weekCells = [
                          `
                            <td class="text-center">
                              <button
                                type="button"
                                class="cash-week-btn ${paid ? 'paid' : 'unpaid'}"
                                ${isEditable ? `data-toggle-cash="${Number(st.student_id)}:${currentCashWeek}:${paid ? 0 : 1}"` : 'disabled'}
                                title="Minggu ${currentCashWeek}: ${paid ? 'Lunas' : 'Belum Lunas'}"
                              >
                                ${paid ? '✓' : '—'}
                              </button>
                            </td>
                          `
                        ];
                        return `
                          <tr>
                            <td class="font-mono">#${Number(st.student_number)}</td>
                            <td><strong>${escapeHtml(st.name)}</strong></td>
                            ${weekCells.join('')}
                            <td class="text-right font-mono" data-cash-status="${Number(st.student_id)}">
                              ${
                                st.is_lunas
                                  ? '<span class="badge badge-success">LUNAS</span>'
                                  : `<span class="badge badge-warning" style="font-weight: 600;">${escapeHtml(st.status_label)}</span>`
                              }
                            </td>
                          </tr>
                        `;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
          }
        </div>
      </section>
    `;

    // Toggle Accordion Pengaturan Kas
    document.getElementById('btn-toggle-cash-settings')?.addEventListener('click', () => {
      const panel = document.getElementById('accordion-cash-settings');
      panel?.classList.toggle('open');
      const isOpen = panel?.classList.contains('open');
      document.getElementById('btn-toggle-cash-settings')?.setAttribute('aria-expanded', String(isOpen));
    });

    // Bind Cash Settings Form with confirmation dialog
    const settingsForm = document.getElementById('cash-settings-form');
    settingsForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nextFee = parseInt(document.getElementById('input-cash-fee')?.value || '0', 10);
      const nextWeeks = parseInt(document.getElementById('input-cash-weeks')?.value || '0', 10);

      openModal({
        title: 'Konfirmasi Perubahan Pengaturan Kas',
        bodyHtml: `
          <p style="font-size: 0.92rem;">
            Anda akan memperbarui pengaturan kas kelas untuk <strong>${escapeHtml(state.currentUser?.class_name || 'Kelas Aktif')}</strong>:
          </p>
          <ul style="font-size: 0.88rem; color: var(--text-muted); padding-left: 18px; list-style: disc;">
            <li>Tarif Mingguan: <strong>${formatRupiah(nextFee)}</strong></li>
            <li>Jumlah Minggu Aktif: <strong>${nextWeeks} Minggu</strong></li>
          </ul>
        `,
        footerHtml: `
          <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
          <button type="button" id="btn-confirm-cash-settings" class="btn btn-primary">Konfirmasi &amp; Simpan</button>
        `,
        onMount: () => {
          document.getElementById('btn-confirm-cash-settings')?.addEventListener('click', async () => {
            const res = await apiRequest('/api/cash/settings', {
              method: 'POST',
              body: { weekly_fee: nextFee, active_weeks_count: nextWeeks }
            });
            if (!res.ok) {
              showToast(res.data.error || 'Gagal menyimpan pengaturan kas.', 'error');
              return;
            }
            closeModal();
            showToast('Pengaturan kas kelas berhasil diperbarui.', 'success');
            await loadCashModule(container);
          });
        }
      });
    });

    // Bind Toolbar Pemilih Minggu & Pencarian Kas Kelas
    document.getElementById('btn-cash-prev-week')?.addEventListener('click', () => {
      if (currentCashWeek > startCashWeek) {
        state.cashWeek = currentCashWeek - 1;
        renderCashView(container);
      }
    });

    document.getElementById('btn-cash-next-week')?.addEventListener('click', () => {
      if (currentCashWeek < endCashWeek) {
        state.cashWeek = currentCashWeek + 1;
        renderCashView(container);
      }
    });

    document.getElementById('cash-week-select')?.addEventListener('change', (e) => {
      state.cashWeek = parseInt(e.target.value, 10);
      renderCashView(container);
    });

    const cashSearchInput = document.getElementById('cash-search-input');
    cashSearchInput?.addEventListener('input', (e) => {
      state.cashSearch = e.target.value;
      renderCashView(container);
      const el = document.getElementById('cash-search-input');
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = el.value.length;
      }
    });
  }

  /**
   * Optimistic In-Place Update untuk baris rekap kas tanpa reload halaman / reset scroll
   */
  function updateCashRowInPlace(studentId, weekNumber, isPaid, buttonEl) {
    const fee = Number(state.cashSettings.weekly_fee || 0);
    const maxWeek = Number(state.cashSettings.active_weeks_count || 1);
    const hasWeek1 = (state.cashRecap && state.cashRecap.some((s) => s.weeks && s.weeks[1]));
    const startWeek = hasWeek1 ? 1 : 2;
    const totalWeeks = Math.max(0, maxWeek - startWeek + 1);

    // 1. Perbarui state lokal
    const studentObj = state.cashRecap.find((s) => Number(s.student_id) === Number(studentId));
    if (studentObj) {
      if (!studentObj.weeks) studentObj.weeks = {};
      studentObj.weeks[weekNumber] = Boolean(isPaid);

      let paidCount = 0;
      for (let w = startWeek; w <= maxWeek; w++) {
        if (studentObj.weeks[w]) paidCount++;
      }
      const unpaidWeeks = Math.max(0, totalWeeks - paidCount);
      const arrearsNominal = unpaidWeeks * fee;
      studentObj.paid_weeks = paidCount;
      studentObj.unpaid_weeks = unpaidWeeks;
      studentObj.arrears = arrearsNominal;
      studentObj.is_lunas = unpaidWeeks === 0;
      studentObj.status_label = studentObj.is_lunas
        ? '✅'
        : `-Rp${arrearsNominal.toLocaleString('id-ID')}`;

      // 2. Perbarui sel status pada baris dan kartu siswa tersebut
      const statusCells = document.querySelectorAll(`[data-cash-status="${Number(studentId)}"]`);
      statusCells.forEach((cell) => {
        cell.innerHTML = studentObj.is_lunas
          ? '<span class="badge badge-success">LUNAS</span>'
          : `<span class="badge badge-warning">${escapeHtml(studentObj.status_label)}</span>`;
      });

      // Perbarui progress bar di ringkasan mobile jika ada
      const totalStudents = state.cashRecap.length;
      const paidStudentsCount = state.cashRecap.filter((s) => s.is_lunas).length;
      const paidPercent = totalStudents > 0 ? Math.round((paidStudentsCount / totalStudents) * 100) : 0;
      const progressFill = document.querySelector('.cash-progress-fill');
      if (progressFill) progressFill.style.width = `${paidPercent}%`;
      const progressLabels = document.querySelector('.cash-progress-labels');
      if (progressLabels) {
        progressLabels.innerHTML = `<span><strong>${paidStudentsCount}</strong> dari ${totalStudents} siswa lunas</span><span class="font-mono">${paidPercent}%</span>`;
      }
    }

    // 3. Perbarui seluruh tombol/chip minggu yang cocok (desktop dan mobile)
    const matchingBtns = document.querySelectorAll(`[data-toggle-cash^="${Number(studentId)}:${Number(weekNumber)}:"]`);
    matchingBtns.forEach((btn) => {
      btn.classList.toggle('paid', Boolean(isPaid));
      btn.classList.toggle('unpaid', !isPaid);
      btn.setAttribute('data-toggle-cash', `${Number(studentId)}:${Number(weekNumber)}:${isPaid ? 0 : 1}`);
      btn.setAttribute('title', isPaid ? `Minggu ${weekNumber}: Lunas` : `Minggu ${weekNumber}: Belum Lunas`);
      btn.textContent = isPaid ? '✓' : '—';
    });
  }

  function openStudentAllWeeksModal(studentId) {
    const studentObj = state.cashRecap.find((s) => Number(s.student_id) === Number(studentId));
    if (!studentObj) return;
    const isEditable = canEditCash();
    const maxWeek = Number(state.cashSettings.active_weeks_count || 1);
    const hasWeek1 = (state.cashRecap && state.cashRecap.some((s) => s.weeks && s.weeks[1]));
    const startWeek = hasWeek1 ? 1 : 2;
    const endWeek = Math.max(startWeek, maxWeek);

    const weekChips = [];
    for (let w = startWeek; w <= endWeek; w++) {
      const paid = Boolean(studentObj.weeks && studentObj.weeks[w]);
      weekChips.push(`
        <div class="cash-card-week-slot">
          <span class="cash-card-week-label">Minggu ${w}</span>
          <button
            type="button"
            class="cash-week-btn ${paid ? 'paid' : 'unpaid'}"
            style="width: 40px; height: 40px; font-size: 0.92rem;"
            ${isEditable ? `data-toggle-cash="${Number(studentObj.student_id)}:${w}:${paid ? 0 : 1}"` : 'disabled'}
            title="Minggu ${w}: ${paid ? 'Lunas' : 'Belum Lunas'}"
          >
            ${paid ? '✓' : '—'}
          </button>
        </div>
      `);
    }

    openModal({
      title: `Rekap Seluruh Minggu — ${escapeHtml(studentObj.name)}`,
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.88rem; color: var(--text-muted);">Nomor Absen #${Number(studentObj.student_number)}</span>
            <div data-cash-status="${Number(studentObj.student_id)}">
              ${
                studentObj.is_lunas
                  ? '<span class="badge badge-success">LUNAS</span>'
                  : `<span class="badge badge-warning">${escapeHtml(studentObj.status_label)}</span>`
              }
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 8px;">
            ${weekChips.join('')}
          </div>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Tutup</button>
      `
    });
  }

  function openCashImportChecklistModal(container) {
    openModal({
      title: 'Impor Ceklis Kas Mingguan',
      bodyHtml: `
        <div class="form-group">
          <label for="cash-checklist-textarea" class="form-label">Teks Ceklis Bendahara</label>
          <textarea
            id="cash-checklist-textarea"
            class="form-textarea font-mono"
            rows="8"
            placeholder="KAS TANGGAL 29 JULI 2026 (MINGGU 2)&#10;1. naswa✅&#10;2. natasya✅&#10;3. naufal"
          ></textarea>
          <span class="form-hint">Sertakan baris <code>MINGGU [angka]</code> di judul dan tanda <code>✅</code> pada nomor absen siswa yang sudah lunas.</span>
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-submit-cash-checklist" class="btn btn-primary">Proses Ceklis Kas</button>
      `,
      onMount: () => {
        document.getElementById('btn-submit-cash-checklist')?.addEventListener('click', async () => {
          const text = document.getElementById('cash-checklist-textarea')?.value.trim() || '';
          if (!text) {
            showToast('Teks ceklis tidak boleh kosong.', 'warning');
            return;
          }
          const res = await apiRequest('/api/cash/import-checklist', {
            method: 'POST',
            body: { text }
          });
          if (!res.ok) {
            showToast(res.data.error || res.data.message || 'Gagal memproses ceklis kas.', 'error');
            return;
          }
          closeModal();
          showToast('Rekap ceklis kas berhasil disimpan.', 'success');
          await loadCashModule(container);
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 11B. MODULE 4B: BUKU KAS & REKAP KEUANGAN KELAS (/api/finance/*)
  // --------------------------------------------------------------------------

  function formatRangeLabel(range) {
    if (range === '7d') return '7 Hari Terakhir';
    if (range === '14d') return '14 Hari (2 Minggu)';
    if (range === '30d') return '30 Hari (1 Bulan)';
    if (range === '60d') return '60 Hari (2 Bulan)';
    if (range === 'semester') return '1 Semester Penuh';
    return range;
  }

  async function loadFinanceModule(container) {
    if (!canViewFinance()) {
      container.innerHTML = renderForbiddenState(
        'Akses ditolak: Sekretaris tidak memiliki hak akses ke modul Keuangan.'
      );
      return;
    }

    container.innerHTML = renderLoadingState('Memuat rekap buku kas & transaksi keuangan...');

    const range = state.financeRange || '30d';
    const groupBy = state.financeGroupBy || 'day';

    const res = await apiRequest(
      `/api/finance/summary?range=${encodeURIComponent(range)}&group_by=${encodeURIComponent(groupBy)}`
    );

    if (res.status === 403) {
      container.innerHTML = renderForbiddenState(
        res.data?.error || 'Akses ke modul Keuangan ditolak.'
      );
      return;
    }

    if (!res.ok) {
      container.innerHTML = renderErrorState(
        res.data?.error || 'Gagal memuat rekap keuangan kelas.'
      );
      return;
    }

    state.financeSummary = res.data;
    renderFinanceView(container, res.data);
  }

  function renderFinanceView(container, data) {
    const isEditable = canEditFinance();
    const balance = Number(data.current_balance || 0);
    const period = data.period_summary || { total_income: 0, total_expense: 0, net: 0, range: '30d', group_by: 'day' };
    const allTime = data.all_time || {};
    const records = Array.isArray(data.records) ? data.records : [];
    const currentRange = state.financeRange || period.range || '30d';
    const currentGroupBy = state.financeGroupBy || period.group_by || 'day';

    const balanceColorClass = balance >= 0 ? 'text-emerald' : 'text-danger';

    container.innerHTML = `
      <!-- 3 Kartu Ringkasan Keuangan (Saldo Saat Ini, Pemasukan Periode, Pengeluaran Periode) -->
      <div class="stats-grid finance-stat-grid">
        <div class="stat-card finance-stat-card">
          <div class="stat-header">
            <span class="stat-label">Saldo Kas Saat Ini</span>
            <span class="badge ${balance >= 0 ? 'badge-success-soft' : 'badge-danger-soft'}">
              ${balance >= 0 ? 'Surplus' : 'Defisit'}
            </span>
          </div>
          <div class="stat-value font-mono ${balanceColorClass}">
            ${formatRupiah(balance)}
          </div>
          <div class="stat-footer">
            <span>Total Masuk: ${formatRupiah(allTime.total_income || 0)} • Keluar: ${formatRupiah(allTime.total_manual_expense || 0)}</span>
          </div>
        </div>

        <div class="stat-card finance-stat-card">
          <div class="stat-header">
            <span class="stat-label">Pemasukan Periode Ini</span>
            <span class="badge badge-info font-mono" style="font-size: 0.72rem;">${escapeHtml(formatRangeLabel(currentRange))}</span>
          </div>
          <div class="stat-value font-mono text-emerald">
            +${formatRupiah(period.total_income || 0)}
          </div>
          <div class="stat-footer">
            <span>Kas Siswa & Pemasukan Kelas Terpilih</span>
          </div>
        </div>

        <div class="stat-card finance-stat-card">
          <div class="stat-header">
            <span class="stat-label">Pengeluaran Periode Ini</span>
            <span class="badge badge-danger-soft font-mono" style="font-size: 0.72rem;">${escapeHtml(formatRangeLabel(currentRange))}</span>
          </div>
          <div class="stat-value font-mono text-danger">
            -${formatRupiah(period.total_expense || 0)}
          </div>
          <div class="stat-footer">
            <span>Arus Kas Bersih: <strong class="${period.net >= 0 ? 'text-emerald' : 'text-danger'}">${period.net >= 0 ? '+' : ''}${formatRupiah(period.net)}</strong></span>
          </div>
        </div>
      </div>

      <!-- Toolbar 2 Filter Dropdown (Rentang Waktu & Format Granularitas) + Tombol Tambah Transaksi -->
      <div class="toolbar finance-toolbar" style="margin-bottom: 16px;">
        <div class="toolbar-group">
          <!-- Dropdown 1: Rentang Waktu -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <label for="finance-range-select" class="hide-mobile" style="font-size: 0.82rem; color: var(--text-muted); font-weight: 500;">Periode:</label>
            ${renderCustomSelectHtml({
              id: 'finance-range-select',
              value: currentRange,
              options: [
                { value: '7d', label: '7 Hari Terakhir' },
                { value: '14d', label: '14 Hari (2 Minggu)' },
                { value: '30d', label: '30 Hari (1 Bulan)' },
                { value: '60d', label: '60 Hari (2 Bulan)' },
                { value: 'semester', label: '1 Semester Penuh' }
              ],
              style: 'width: auto; min-width: 155px;'
            })}
          </div>

          <!-- Dropdown 2: Granularitas Tampilan (Per Hari / Per Minggu) -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <label for="finance-view-select" class="hide-mobile" style="font-size: 0.82rem; color: var(--text-muted); font-weight: 500;">Tampilan:</label>
            ${renderCustomSelectHtml({
              id: 'finance-view-select',
              value: currentGroupBy,
              options: [
                { value: 'day', label: 'Per Hari' },
                { value: 'week', label: 'Per Minggu' }
              ],
              style: 'width: auto; min-width: 135px;'
            })}
          </div>
        </div>

        ${
          isEditable
            ? `
          <div class="toolbar-actions">
            <button type="button" id="btn-open-add-transaction" class="btn btn-primary btn-sm">
              + Catat Transaksi
            </button>
          </div>
        `
            : ''
        }
      </div>

      <!-- Konten Rekap Transaksi (Per Hari atau Per Minggu) -->
      <div id="finance-records-container">
        ${renderFinanceRecordsList(records, currentGroupBy, isEditable)}
      </div>
    `;

    attachFinanceEvents(container, records);
  }

  function renderFinanceRecordsList(records, groupBy, isEditable) {
    if (!records || records.length === 0) {
      return `
        <div class="empty-state-card" style="padding: 48px 24px; text-align: center; background: var(--surface-1); border: 1px dashed var(--border); border-radius: var(--radius-lg);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📑</div>
          <div style="font-weight: 600; color: var(--text); font-size: 1.05rem;">Belum Ada Transaksi</div>
          <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px; max-width: 400px; margin-left: auto; margin-right: auto;">
            Tidak ada pergerakan kas siswa maupun pencatatan pemasukan/pengeluaran pada periode ini.
          </div>
        </div>
      `;
    }

    if (groupBy === 'day') {
      return records
        .map((d, index) => {
          const groupId = `finance-day-${index}`;
          const isFirstThree = index < 3;
          const chevronRotate = isFirstThree ? 'rotate(180deg)' : 'rotate(0deg)';
          const hiddenClass = isFirstThree ? '' : 'hidden';

          const hasCash = d.cash_income > 0;
          const hasManual = Array.isArray(d.transactions) && d.transactions.length > 0;

          let cashItemHtml = '';
          if (hasCash) {
            const studentCount = d.cash_count || 0;
            const studentDetails = (d.cash_students || [])
              .map((s) => `#${s.student_number} ${escapeHtml(s.name)} (Mgg ${s.week_number})`)
              .join(', ');

            cashItemHtml = `
              <div class="finance-tx-item">
                <div class="finance-tx-left">
                  <div class="finance-tx-icon finance-icon-cash" title="Pemasukan Kas Siswa">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  </div>
                  <div class="finance-tx-info">
                    <div class="finance-tx-title">
                      <span>Pemasukan Kas Siswa (${studentCount} pembayaran)</span>
                      <span class="badge badge-success-soft" style="font-size: 0.7rem; font-weight: 600;">Otomatis Kas</span>
                    </div>
                    <div class="finance-tx-desc" title="${escapeHtml(studentDetails)}">
                      ${escapeHtml(studentDetails)}
                    </div>
                  </div>
                </div>
                <div class="finance-tx-right">
                  <div class="finance-tx-amount font-mono text-emerald">
                    +${formatRupiah(d.cash_income)}
                  </div>
                </div>
              </div>
            `;
          }

          const manualItemsHtml = (d.transactions || [])
            .map((tx) => {
              const isIncome = tx.type === 'INCOME';
              const amtPrefix = isIncome ? '+' : '-';
              const amtColorClass = isIncome ? 'text-emerald' : 'text-danger';
              const iconClass = isIncome ? 'finance-icon-income' : 'finance-icon-expense';

              return `
                <div class="finance-tx-item">
                  <div class="finance-tx-left">
                    <div class="finance-tx-icon ${iconClass}" title="${isIncome ? 'Pemasukan Non-Kas' : 'Pengeluaran'}">
                      ${
                        isIncome
                          ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>'
                          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>'
                      }
                    </div>
                    <div class="finance-tx-info">
                      <div class="finance-tx-title">
                        <span>${escapeHtml(tx.description)}</span>
                        <span class="badge ${isIncome ? 'badge-success-soft' : 'badge-danger-soft'}" style="font-size: 0.7rem;">
                          ${isIncome ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                      </div>
                      ${
                        tx.created_by
                          ? `<div class="finance-tx-author">Dicatat oleh: ${escapeHtml(formatPhoneDisplay(tx.created_by))}</div>`
                          : ''
                      }
                    </div>
                  </div>

                  <div class="finance-tx-right">
                    ${
                      tx.receipt_url
                        ? `
                      <img
                        src="${escapeHtml(tx.receipt_url)}"
                        alt="Bukti Nota"
                        class="receipt-thumb"
                        data-preview-receipt="${escapeHtml(tx.receipt_url)}"
                        data-receipt-desc="${escapeHtml(tx.description)}"
                        title="Klik untuk melihat foto nota penuh"
                      />
                    `
                        : ''
                    }
                    <div class="finance-tx-amount font-mono ${amtColorClass}">
                      ${amtPrefix}${formatRupiah(tx.amount)}
                    </div>
                    ${
                      isEditable
                        ? `
                      <div class="finance-tx-actions">
                        <button type="button" class="btn btn-secondary btn-icon-only btn-sm" data-edit-tx="${tx.id}" title="Edit transaksi">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button type="button" class="btn btn-danger-soft btn-icon-only btn-sm" data-delete-tx="${tx.id}" title="Hapus transaksi">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    `
                        : ''
                    }
                  </div>
                </div>
              `;
            })
            .join('');

          return `
            <div class="finance-group-card">
              <button
                type="button"
                class="finance-group-header"
                data-finance-toggle-group="${groupId}"
                aria-expanded="${isFirstThree ? 'true' : 'false'}"
              >
                <div class="finance-group-header-left">
                  <div class="finance-date-badge font-mono">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>${escapeHtml(d.date_formatted || d.date)}</span>
                  </div>
                </div>

                <div class="finance-group-header-right">
                  ${
                    d.total_income > 0
                      ? `<span class="badge badge-success-soft font-mono">+${formatRupiah(d.total_income)}</span>`
                      : ''
                  }
                  ${
                    d.total_expense > 0
                      ? `<span class="badge badge-danger-soft font-mono">-${formatRupiah(d.total_expense)}</span>`
                      : ''
                  }
                  <svg class="accordion-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform: ${chevronRotate}; transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </button>

              <div id="${groupId}" class="finance-group-body ${hiddenClass}">
                ${cashItemHtml}
                ${manualItemsHtml}
                ${
                  !hasCash && !hasManual
                    ? '<div style="padding: 12px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">Tidak ada transaksi pada tanggal ini.</div>'
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');
    }

    // Granularitas Per Minggu
    return records
      .map((w, index) => {
        const groupId = `finance-week-${index}`;
        const isFirst = index === 0;
        const chevronRotate = isFirst ? 'rotate(180deg)' : 'rotate(0deg)';
        const hiddenClass = isFirst ? '' : 'hidden';

        const subDaysHtml = (w.days || [])
          .map((d) => {
            return `
              <div class="finance-subday-row">
                <div class="finance-subday-left">
                  <span class="font-mono" style="font-weight: 600; font-size: 0.86rem; color: var(--text);">${escapeHtml(d.date_formatted || d.date)}</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px;">
                    (${d.cash_count || 0} kas, ${(d.transactions || []).length} manual)
                  </span>
                </div>
                <div class="finance-subday-right font-mono" style="font-size: 0.82rem; display: flex; gap: 8px;">
                  ${d.total_income > 0 ? `<span class="text-emerald">+${formatRupiah(d.total_income)}</span>` : ''}
                  ${d.total_expense > 0 ? `<span class="text-danger">-${formatRupiah(d.total_expense)}</span>` : ''}
                </div>
              </div>
            `;
          })
          .join('');

        return `
          <div class="finance-group-card">
            <button
              type="button"
              class="finance-group-header"
              data-finance-toggle-group="${groupId}"
              aria-expanded="${isFirst ? 'true' : 'false'}"
            >
              <div class="finance-group-header-left">
                <div class="finance-date-badge font-mono" style="color: var(--accent);">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Minggu ke-${w.week_number}</span>
                </div>
              </div>

              <div class="finance-group-header-right">
                <span class="badge badge-success-soft font-mono">+${formatRupiah(w.total_income)}</span>
                <span class="badge badge-danger-soft font-mono">-${formatRupiah(w.total_expense)}</span>
                <svg class="accordion-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform: ${chevronRotate}; transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </button>

            <div id="${groupId}" class="finance-group-body ${hiddenClass}">
              <div style="padding: 10px 14px; background: rgba(255,255,255,0.01); border-bottom: 1px solid var(--border); font-size: 0.8rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                <span>Kas Siswa: <strong>${formatRupiah(w.cash_income || 0)}</strong> | Manual: <strong>${formatRupiah(w.manual_income || 0)}</strong></span>
                <span>Total Pengeluaran: <strong>${formatRupiah(w.total_expense || 0)}</strong></span>
              </div>
              ${subDaysHtml}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function attachFinanceEvents(container, records) {
    const rangeSelect = document.getElementById('finance-range-select');
    rangeSelect?.addEventListener('change', async (e) => {
      state.financeRange = e.target.value;
      await loadFinanceModule(container);
    });

    const viewSelect = document.getElementById('finance-view-select');
    viewSelect?.addEventListener('change', async (e) => {
      state.financeGroupBy = e.target.value;
      await loadFinanceModule(container);
    });

    document.getElementById('btn-open-add-transaction')?.addEventListener('click', () => {
      openTransactionModal({ isEdit: false });
    });

    container.querySelectorAll('[data-finance-toggle-group]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-finance-toggle-group');
        const bodyEl = document.getElementById(targetId);
        const iconEl = btn.querySelector('.accordion-chevron');
        if (bodyEl) {
          const isHidden = bodyEl.classList.toggle('hidden');
          if (iconEl) {
            iconEl.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
          }
        }
      });
    });

    container.querySelectorAll('[data-edit-tx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const txId = parseInt(btn.getAttribute('data-edit-tx'), 10);
        let foundTx = null;
        for (const r of records) {
          if (r.transactions) {
            foundTx = r.transactions.find((t) => t.id === txId);
            if (foundTx) {
              foundTx.transaction_date = r.date;
              break;
            }
          }
          if (r.days) {
            for (const d of r.days) {
              foundTx = d.transactions?.find((t) => t.id === txId);
              if (foundTx) {
                foundTx.transaction_date = d.date;
                break;
              }
            }
            if (foundTx) break;
          }
        }
        if (foundTx) {
          openTransactionModal({ isEdit: true, txData: foundTx });
        }
      });
    });

    container.querySelectorAll('[data-delete-tx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const txId = parseInt(btn.getAttribute('data-delete-tx'), 10);
        handleDeleteTransaction(txId);
      });
    });

    container.querySelectorAll('[data-preview-receipt]').forEach((img) => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = img.getAttribute('data-preview-receipt');
        const desc = img.getAttribute('data-receipt-desc') || '';
        openReceiptPreviewModal(url, desc);
      });
    });
  }

  function openTransactionModal({ isEdit = false, txData = null, defaultType = 'EXPENSE' } = {}) {
    const todayStr = new Date().toISOString().split('T')[0];
    const initialType = txData?.type || defaultType;
    const initialDate = txData?.transaction_date || todayStr;
    const initialAmount = txData?.amount || '';
    const initialDesc = txData?.description || '';
    const initialReceipt = txData?.receipt_url || null;

    let selectedBase64 = null;
    let removeReceipt = false;

    openModal({
      title: isEdit ? `Edit Transaksi #${txData.id}` : 'Catat Transaksi Keuangan',
      bodyHtml: `
        <form id="modal-finance-form" class="auth-form">
          <div class="form-group">
            <label class="form-label">Jenis Transaksi</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <label class="finance-type-radio ${initialType === 'EXPENSE' ? 'active' : ''}" id="radio-label-expense" style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer;">
                <input type="radio" name="finance_tx_type" value="EXPENSE" ${initialType === 'EXPENSE' ? 'checked' : ''} style="margin: 0;" />
                <span style="font-weight: 600; color: var(--danger, #ef4444);">Pengeluaran</span>
              </label>
              <label class="finance-type-radio ${initialType === 'INCOME' ? 'active' : ''}" id="radio-label-income" style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer;">
                <input type="radio" name="finance_tx_type" value="INCOME" ${initialType === 'INCOME' ? 'checked' : ''} style="margin: 0;" />
                <span style="font-weight: 600; color: var(--success, #10b981);">Pemasukan</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="modal-tx-date" class="form-label">Tanggal Transaksi</label>
            <input type="date" id="modal-tx-date" class="form-input font-mono" required value="${escapeHtml(initialDate)}" />
          </div>

          <div class="form-group">
            <label for="modal-tx-amount" class="form-label">Nominal (Rupiah)</label>
            <div style="position: relative;">
              <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-weight: 600; color: var(--text-muted);">Rp</span>
              <input type="number" id="modal-tx-amount" class="form-input font-mono" style="padding-left: 40px;" min="1" step="500" placeholder="Contoh: 35000" required value="${escapeHtml(String(initialAmount))}" />
            </div>
          </div>

          <div class="form-group">
            <label for="modal-tx-desc" class="form-label">Keterangan Transaksi</label>
            <textarea id="modal-tx-desc" class="form-textarea" rows="3" placeholder="Contoh: Beli spidol whiteboard & penghapus papan tulis" required>${escapeHtml(initialDesc)}</textarea>
          </div>

          <div class="form-group">
            <label for="modal-tx-receipt" class="form-label">Foto Nota / Kuitansi (Opsional)</label>
            <input type="file" id="modal-tx-receipt" class="form-input" accept="image/png,image/jpeg,image/webp" />
            <div id="receipt-preview-container" style="margin-top: 10px; ${initialReceipt ? '' : 'display: none;'}">
              <div style="display: flex; align-items: center; gap: 12px;">
                <img id="receipt-preview-img" src="${initialReceipt ? escapeHtml(initialReceipt) : ''}" alt="Pratinjau Nota" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border);" />
                <button type="button" id="btn-remove-receipt" class="btn btn-secondary btn-sm" style="color: var(--danger);">Hapus Foto</button>
              </div>
            </div>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-save-transaction" class="btn btn-primary">${isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}</button>
      `,
      onMount: () => {
        const radioExpense = document.querySelector('input[name="finance_tx_type"][value="EXPENSE"]');
        const radioIncome = document.querySelector('input[name="finance_tx_type"][value="INCOME"]');
        const labelExpense = document.getElementById('radio-label-expense');
        const labelIncome = document.getElementById('radio-label-income');

        function updateRadioStyles() {
          if (radioExpense?.checked) {
            if (labelExpense) {
              labelExpense.style.borderColor = 'var(--danger, #ef4444)';
              labelExpense.style.background = 'rgba(239, 68, 68, 0.08)';
            }
            if (labelIncome) {
              labelIncome.style.borderColor = 'var(--border)';
              labelIncome.style.background = 'transparent';
            }
          } else {
            if (labelIncome) {
              labelIncome.style.borderColor = 'var(--success, #10b981)';
              labelIncome.style.background = 'rgba(16, 185, 129, 0.08)';
            }
            if (labelExpense) {
              labelExpense.style.borderColor = 'var(--border)';
              labelExpense.style.background = 'transparent';
            }
          }
        }
        radioExpense?.addEventListener('change', updateRadioStyles);
        radioIncome?.addEventListener('change', updateRadioStyles);
        updateRadioStyles();

        const fileInput = document.getElementById('modal-tx-receipt');
        const previewContainer = document.getElementById('receipt-preview-container');
        const previewImg = document.getElementById('receipt-preview-img');
        const removeBtn = document.getElementById('btn-remove-receipt');

        fileInput?.addEventListener('change', () => {
          const file = fileInput.files?.[0];
          if (!file) return;

          if (file.size > 8 * 1024 * 1024) {
            showToast('Ukuran foto terlalu besar. Maksimal 8MB.', 'error');
            fileInput.value = '';
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            selectedBase64 = e.target.result;
            removeReceipt = false;
            if (previewImg && previewContainer) {
              previewImg.src = selectedBase64;
              previewContainer.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        });

        removeBtn?.addEventListener('click', () => {
          selectedBase64 = null;
          removeReceipt = true;
          if (fileInput) fileInput.value = '';
          if (previewImg) previewImg.src = '';
          if (previewContainer) previewContainer.style.display = 'none';
        });

        document.getElementById('btn-save-transaction')?.addEventListener('click', async () => {
          const type = radioExpense?.checked ? 'EXPENSE' : 'INCOME';
          const date = document.getElementById('modal-tx-date')?.value || '';
          const amount = parseInt(document.getElementById('modal-tx-amount')?.value, 10);
          const desc = document.getElementById('modal-tx-desc')?.value.trim() || '';

          if (!date) {
            showToast('Silakan pilih tanggal transaksi.', 'error');
            return;
          }
          if (!amount || amount <= 0 || isNaN(amount)) {
            showToast('Nominal harus berupa angka lebih dari 0.', 'error');
            return;
          }
          if (!desc) {
            showToast('Keterangan transaksi wajib diisi.', 'error');
            return;
          }

          const payload = {
            type,
            transaction_date: date,
            amount,
            description: desc
          };

          if (selectedBase64) {
            payload.receipt_image = selectedBase64;
          }
          if (isEdit && removeReceipt) {
            payload.remove_receipt = true;
          }

          const saveBtn = document.getElementById('btn-save-transaction');
          if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Menyimpan...';
          }

          try {
            const url = isEdit ? `/api/finance/transactions/${txData.id}` : '/api/finance/transactions';
            const method = isEdit ? 'PUT' : 'POST';
            const res = await apiRequest(url, { method, body: payload });

            if (!res.ok) {
              showToast(res.data?.error || 'Gagal menyimpan transaksi.', 'error');
              if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi';
              }
              return;
            }

            closeModal();
            showToast(isEdit ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil dicatat.', 'success');
            const pageContainer = document.getElementById('page-content');
            if (pageContainer) await loadFinanceModule(pageContainer);
          } catch (err) {
            showToast('Terjadi kesalahan jaringan atau server.', 'error');
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.textContent = isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi';
            }
          }
        });
      }
    });
  }

  function openReceiptPreviewModal(imageUrl, caption) {
    openModal({
      title: 'Pratinjau Nota / Bukti Transaksi',
      bodyHtml: `
        <div style="text-align: center; padding: 10px 0;">
          <img src="${escapeHtml(imageUrl)}" alt="Nota Bukti Transaksi" class="receipt-modal-img" />
          ${caption ? `<div style="margin-top: 12px; font-size: 0.9rem; color: var(--text-muted);">${escapeHtml(caption)}</div>` : ''}
        </div>
      `,
      footerHtml: `
        <a href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" download>Buka / Unduh Ukuran Penuh</a>
        <button type="button" class="btn btn-primary btn-sm" data-close-modal="true">Tutup</button>
      `
    });
  }

  async function handleDeleteTransaction(txId) {
    if (!confirm(`Apakah Anda yakin ingin menghapus transaksi #${txId}? Data yang dihapus tidak dapat dipulihkan.`)) {
      return;
    }

    try {
      const res = await apiRequest(`/api/finance/transactions/${txId}`, { method: 'DELETE' });
      if (!res.ok) {
        showToast(res.data?.error || 'Gagal menghapus transaksi.', 'error');
        return;
      }

      showToast('Transaksi berhasil dihapus.', 'success');
      const container = document.getElementById('page-content');
      if (container) await loadFinanceModule(container);
    } catch (err) {
      showToast('Gagal menghapus transaksi.', 'error');
    }
  }

  // --------------------------------------------------------------------------
  // 12. MODULE 5: TUGAS & PR (/api/assignments)
  // --------------------------------------------------------------------------

  async function loadAssignmentsModule(container) {
    container.innerHTML = renderLoadingState('Memuat daftar tugas & PR...');
    const res = await apiRequest(`/api/assignments?status=${encodeURIComponent(state.assignmentFilter)}`);

    if (res.status === 403) {
      container.innerHTML = renderForbiddenState(res.data.error);
      return;
    }
    if (!res.ok) {
      container.innerHTML = renderErrorState(res.data.error || 'Gagal memuat daftar tugas.');
      return;
    }

    state.assignments = res.data.assignments || [];
    renderAssignmentsView(container);
  }

  function renderAssignmentsView(container) {
    const canWrite = canEditAcademic();
    const items = state.assignments;

    container.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-group">
          <div class="subtabs" role="tablist">
            <button
              type="button"
              class="subtab-btn ${state.assignmentFilter === 'active' ? 'active' : ''}"
              data-pr-filter="active"
            >
              Tugas Aktif
            </button>
            <button
              type="button"
              class="subtab-btn ${state.assignmentFilter === 'all' ? 'active' : ''}"
              data-pr-filter="all"
            >
              Riwayat Seluruh PR
            </button>
          </div>
          <span class="badge badge-neutral">${items.length} Tugas</span>
        </div>

        ${
          canWrite
            ? `<button type="button" id="btn-add-assignment" class="btn btn-primary btn-sm hide-mobile">+ Tambah Tugas / PR</button>`
            : ''
        }
      </div>

      <section class="panel">
        <div class="panel-body">
          ${
            items.length === 0
              ? renderEmptyState({
                  title:
                    state.assignmentFilter === 'active'
                      ? 'Belum Ada Tugas Aktif untuk Kelas Ini'
                      : 'Belum Ada Riwayat Tugas & PR',
                  description:
                    state.assignmentFilter === 'active'
                      ? 'Seluruh pekerjaan rumah telah diselesaikan atau belum ada tugas baru.'
                      : 'Belum ada catatan tugas yang pernah dibuat di kelas ini.',
                  actionLabel: canWrite ? '+ Buat Tugas Baru' : '',
                  actionId: canWrite ? 'btn-empty-add-assignment' : ''
                })
              : `
              <div class="assignment-list">
                ${items
                  .map((a) => {
                    let badgeHtml = '';
                    if (a.is_completed) {
                      badgeHtml = '<span class="badge badge-success">Selesai</span>';
                    } else {
                      const dl = new Date(String(a.deadline).replace(' ', 'T'));
                      const diffHours = (dl.getTime() - Date.now()) / (1000 * 60 * 60);
                      if (diffHours < 0) {
                        badgeHtml = '<span class="badge badge-danger">Terlewat</span>';
                      } else if (diffHours <= 24) {
                        badgeHtml = '<span class="badge badge-warning">Segera</span>';
                      } else {
                        badgeHtml = '<span class="badge badge-info">Aktif</span>';
                      }
                    }
                    return `
                  <div class="assignment-card ${a.is_completed ? 'completed' : ''}">
                    <div class="assignment-main">
                      <div class="assignment-meta-top">
                        ${badgeHtml}
                        <span class="font-mono text-subtle" style="font-size: 0.76rem;">ID #${Number(a.id)}</span>
                        <h3 class="assignment-subject">${escapeHtml(a.subject)}</h3>
                      </div>
                      <p class="assignment-desc">${escapeHtml(a.description)}</p>
                      <div class="assignment-footer-meta">
                        <span class="font-mono">Tenggat: <strong>${escapeHtml(a.deadline)}</strong></span>
                        <span>Pembuat: ${escapeHtml(a.created_by)}</span>
                      </div>
                    </div>
                    ${
                      canWrite
                        ? `
                      <div class="table-actions">
                        <button type="button" class="btn ${a.is_completed ? 'btn-secondary' : 'btn-success-soft'} btn-xs" data-pr-toggle="${Number(a.id)}">
                          ${a.is_completed ? 'Buka Kembali' : 'Tandai Selesai'}
                        </button>
                        <button type="button" class="btn btn-secondary btn-xs" data-pr-edit="${Number(a.id)}">
                          Edit
                        </button>
                        <button type="button" class="btn btn-danger-soft btn-xs" data-pr-delete="${Number(a.id)}">
                          Hapus
                        </button>
                      </div>
                    `
                        : ''
                    }
                  </div>
                `;
                  })
                  .join('')}
              </div>
            `
          }
        </div>
      </section>
      ${canWrite ? `<button type="button" class="fab" id="fab-add-assignment" aria-label="Tambah Tugas" title="Tambah Tugas / PR">+</button>` : ''}
    `;

    document.getElementById('btn-add-assignment')?.addEventListener('click', () => openAssignmentFormModal(null));
    document.getElementById('fab-add-assignment')?.addEventListener('click', () => openAssignmentFormModal(null));
    document.getElementById('btn-empty-add-assignment')?.addEventListener('click', () => openAssignmentFormModal(null));
  }

  function openAssignmentFormModal(assignment = null) {
    const isEdit = Boolean(assignment);
    const defaultDeadline = assignment?.deadline
      ? assignment.deadline.replace(' ', 'T').slice(0, 16)
      : new Date(Date.now() + 86400000).toISOString().slice(0, 16);

    openModal({
      title: isEdit ? `Edit Tugas #${assignment.id}` : 'Tambah Tugas / PR Baru',
      bodyHtml: `
        <form id="modal-assignment-form" class="auth-form">
          <div class="form-group">
            <label for="pr-subject" class="form-label">Mata Pelajaran</label>
            <input type="text" id="pr-subject" class="form-input" placeholder="Contoh: Basis Data / Matematika" required value="${escapeHtml(assignment?.subject || '')}" />
          </div>
          <div class="form-group">
            <label for="pr-deadline" class="form-label">Tenggat Waktu (Deadline)</label>
            <input type="datetime-local" id="pr-deadline" class="form-input font-mono" required value="${escapeHtml(defaultDeadline)}" />
          </div>
          <div class="form-group">
            <label for="pr-desc" class="form-label">Deskripsi / Instruksi Tugas</label>
            <textarea id="pr-desc" class="form-textarea" rows="4" placeholder="Jelaskan rincian tugas yang harus dikerjakan..." required>${escapeHtml(assignment?.description || '')}</textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-save-assignment" class="btn btn-primary">${isEdit ? 'Simpan Perubahan' : 'Simpan Tugas'}</button>
      `,
      onMount: () => {
        document.getElementById('btn-save-assignment')?.addEventListener('click', async () => {
          const subject = document.getElementById('pr-subject')?.value.trim() || '';
          const deadlineRaw = document.getElementById('pr-deadline')?.value || '';
          const description = document.getElementById('pr-desc')?.value.trim() || '';

          const payload = {
            subject,
            deadline: deadlineRaw.replace('T', ' '),
            description
          };

          const url = isEdit ? `/api/assignments/${assignment.id}` : '/api/assignments';
          const method = isEdit ? 'PUT' : 'POST';
          const res = await apiRequest(url, { method, body: payload });

          if (!res.ok) {
            showToast(res.data.error || 'Gagal menyimpan tugas.', 'error');
            return;
          }

          closeModal();
          showToast(res.data.message || 'Tugas berhasil disimpan.', 'success');
          await loadAssignmentsModule(document.getElementById('page-content'));
        });
      }
    });
  }

  function openAssignmentDeleteModal(assignmentId) {
    const item = state.assignments.find((a) => Number(a.id) === Number(assignmentId));
    if (!item) return;

    openModal({
      title: 'Konfirmasi Hapus Tugas / PR',
      bodyHtml: `
        <p style="font-size: 0.92rem;">
          Apakah Anda yakin ingin menghapus tugas <strong>${escapeHtml(item.subject)}</strong> (Tenggat: <span class="font-mono">${escapeHtml(item.deadline)}</span>)?
        </p>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-confirm-del-pr" class="btn btn-danger">Ya, Hapus Tugas</button>
      `,
      onMount: () => {
        document.getElementById('btn-confirm-del-pr')?.addEventListener('click', async () => {
          const res = await apiRequest(`/api/assignments/${item.id}`, { method: 'DELETE' });
          if (!res.ok) {
            showToast(res.data.error || 'Gagal menghapus tugas.', 'error');
            return;
          }
          closeModal();
          showToast('Tugas berhasil dihapus.', 'success');
          await loadAssignmentsModule(document.getElementById('page-content'));
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 13. MODULE 6: ADMINISTRASI KELAS (/api/structure)
  // --------------------------------------------------------------------------

  async function loadStructureModule(container) {
    container.innerHTML = renderLoadingState('Memuat struktur organisasi kelas...');
    const res = await apiRequest('/api/structure');

    if (res.status === 403) {
      container.innerHTML = renderForbiddenState(res.data.error);
      return;
    }
    if (!res.ok) {
      container.innerHTML = renderErrorState(res.data.error || 'Gagal memuat struktur organisasi kelas.');
      return;
    }

    state.structures = res.data.structures || [];
    state.classRoles = res.data.class_roles || [];
    state.linkedGroups = res.data.linked_groups || [];
    state.activeClassInfo = res.data.class_info || null;
    renderStructureView(container);
  }

  function renderStructureView(container) {
    const canWrite = canEditAcademic();
    const className = state.currentUser?.class_name || 'Kelas Aktif';

    container.innerHTML = `
      <div class="dashboard-split">
        <section class="panel">
          <div class="panel-header">
            <div class="panel-title-group">
              <h2 class="panel-title">Struktur Pengurus Kelas — ${escapeHtml(className)}</h2>
              <p class="panel-subtitle">Jabatan Ketua, Sekretaris, dan Bendahara otomatis tersinkronisasi dengan otorisasi RBAC</p>
            </div>
            ${
              canWrite
                ? `<button type="button" id="btn-add-position" class="btn btn-primary btn-sm hide-mobile">+ Atur Jabatan</button>`
                : ''
            }
          </div>
          <div class="panel-body ${state.structures.length > 0 ? 'no-pad' : ''}">
            ${
              state.structures.length === 0
                ? renderEmptyState({
                    title: 'Belum Ada Struktur Pengurus',
                    description: 'Tambahkan jabatan Ketua, Wakil Ketua, Sekretaris, atau Bendahara untuk kelas ini.',
                    actionLabel: canWrite ? '+ Tambah Jabatan Pengurus' : '',
                    actionId: canWrite ? 'btn-empty-add-position' : ''
                  })
                : `
                <!-- Daftar Pengurus Mobile (< 768px) -->
                <div class="mobile-card-list">
                  ${state.structures
                    .map(
                      (st) => `
                    <div class="mobile-data-card">
                      <div class="mobile-card-top">
                        <span class="badge badge-info" style="font-size: 0.76rem;">${escapeHtml(st.position_name)}</span>
                        <span class="font-mono text-subtle" style="font-size: 0.8rem;">${escapeHtml(formatPhoneDisplay(st.phone_number))}</span>
                      </div>
                      <div style="font-weight: 600; font-size: 0.98rem; color: var(--text);">${escapeHtml(st.holder_name)}</div>
                      ${
                        canWrite
                          ? `
                        <div class="mobile-card-actions">
                          <button type="button" class="btn btn-secondary btn-xs" data-struct-edit="${Number(st.id)}">Ubah</button>
                          <button type="button" class="btn btn-danger-soft btn-xs" data-struct-delete="${Number(st.id)}">Hapus</button>
                        </div>
                      `
                          : ''
                      }
                    </div>
                  `
                    )
                    .join('')}
                </div>

                <!-- Tabel Pengurus Desktop (>= 768px) -->
                <div class="desktop-table-container table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Jabatan</th>
                        <th>Nama Pemegang Jabatan</th>
                        <th>Nomor WhatsApp</th>
                        ${canWrite ? '<th class="text-right">Aksi</th>' : ''}
                      </tr>
                    </thead>
                    <tbody>
                      ${state.structures
                        .map(
                          (st) => `
                        <tr>
                          <td data-label="Jabatan"><span class="badge badge-info">${escapeHtml(st.position_name)}</span></td>
                          <td data-label="Nama Pemegang Jabatan"><strong>${escapeHtml(st.holder_name)}</strong></td>
                          <td class="font-mono" data-label="Nomor WhatsApp">${escapeHtml(formatPhoneDisplay(st.phone_number))}</td>
                          ${
                            canWrite
                              ? `
                            <td class="text-right" data-label="Aksi">
                              <div class="table-actions">
                                <button type="button" class="btn btn-secondary btn-xs" data-struct-edit="${Number(st.id)}">Ubah</button>
                                <button type="button" class="btn btn-danger btn-xs" data-struct-delete="${Number(st.id)}">Hapus</button>
                              </div>
                            </td>
                          `
                              : ''
                          }
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
            }
          </div>
        </section>

        <!-- Panel Pratinjau Format Pengumuman Grup -->
        <section class="panel">
          <div class="panel-header">
            <div class="panel-title-group">
              <h2 class="panel-title">Pratinjau Format Pengumuman Grup</h2>
              <p class="panel-subtitle">Target Kelas Aktif: <strong>${escapeHtml(className)}</strong></p>
            </div>
          </div>
          <div class="panel-body" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label for="announcement-input" class="form-label">Isi Pesan Pengumuman</label>
              <textarea
                id="announcement-input"
                class="form-textarea"
                rows="3"
                placeholder="Ketik pesan pengumuman kelas untuk melihat pratinjau format..."
              >Besok seluruh siswa wajib hadir pukul 06.45 WIB untuk persiapan kegiatan kelas.</textarea>
            </div>

            <div class="form-group">
              <span class="form-label">Pratinjau Pesan Siap Kirim</span>
              <div id="announcement-preview-box" class="preview-terminal"></div>
            </div>

            <div class="panel-actions" style="justify-content: flex-end;">
              <button type="button" id="btn-copy-announcement" class="btn btn-secondary btn-sm">
                Salin Format Pengumuman
              </button>
            </div>
          </div>
        </section>

        <!-- Panel Multi-Group Linking -->
        <section class="panel" style="grid-column: 1 / -1;">
          <div class="panel-header">
            <div class="panel-title-group">
              <h2 class="panel-title">Grup WhatsApp Terhubung (Multi-Group Linking)</h2>
              <p class="panel-subtitle">Hubungkan grup khusus (seperti grup putra, grup putri) ke kelas ini agar jadwal, PR, dan kas otomatis tersinkronisasi</p>
            </div>
            ${
              canWrite
                ? `<button type="button" id="btn-add-linked-group" class="btn btn-primary btn-sm">+ Hubungkan Grup</button>`
                : ''
            }
          </div>
          <div class="panel-body">
            <!-- Banner Grup Utama -->
            <div style="background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  <span style="font-weight: 600; font-size: 0.92rem; color: var(--text);">Grup WhatsApp Utama (Kelas Induk)</span>
                </div>
                <div class="font-mono text-subtle" style="font-size: 0.82rem; margin-top: 2px;">${escapeHtml(state.activeClassInfo?.group_id || state.currentUser?.group_id || '-')}</div>
              </div>
              <span class="badge badge-primary">Kelas Induk</span>
            </div>

            ${
              (state.linkedGroups || []).length === 0
                ? renderEmptyState({
                    title: 'Belum Ada Grup Cabang Terhubung',
                    description: 'Hubungkan grup WhatsApp khusus seperti grup putra atau putri agar data kelas selalu tersinkronisasi.',
                    actionLabel: canWrite ? '+ Hubungkan Grup Cabang' : '',
                    actionId: canWrite ? 'btn-empty-add-linked-group' : ''
                  })
                : `
                <!-- Daftar Grup Cabang Mobile (< 768px) -->
                <div class="mobile-card-list">
                  ${(state.linkedGroups || [])
                    .map(
                      (lg) => `
                    <div class="mobile-data-card">
                      <div class="mobile-card-top">
                        <span class="badge badge-success" style="font-size: 0.76rem;">${escapeHtml(lg.group_label || 'Cabang')}</span>
                        <span class="font-mono text-subtle" style="font-size: 0.76rem;">${escapeHtml(lg.created_at ? lg.created_at.split(' ')[0] : '')}</span>
                      </div>
                      <div class="font-mono" style="font-size: 0.84rem; color: var(--text); word-break: break-all;">${escapeHtml(lg.group_id)}</div>
                      ${
                        canWrite
                          ? `
                        <div class="mobile-card-actions">
                          <button type="button" class="btn btn-secondary btn-xs" data-link-edit="${Number(lg.id)}" data-link-label="${escapeHtml(lg.group_label || 'Cabang')}" data-link-jid="${escapeHtml(lg.group_id)}">Ubah Penanda</button>
                          <button type="button" class="btn btn-danger-soft btn-xs" data-link-delete="${Number(lg.id)}" data-link-label="${escapeHtml(lg.group_label || 'Cabang')}">Putuskan Tautan</button>
                        </div>
                      `
                          : ''
                      }
                    </div>
                  `
                    )
                    .join('')}
                </div>

                <!-- Tabel Grup Cabang Desktop (>= 768px) -->
                <div class="desktop-table-container table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Label Penanda</th>
                        <th>ID WhatsApp Group (JID)</th>
                        <th>Terhubung Sejak</th>
                        ${canWrite ? '<th class="text-right">Aksi</th>' : ''}
                      </tr>
                    </thead>
                    <tbody>
                      ${(state.linkedGroups || [])
                        .map(
                          (lg) => `
                        <tr>
                          <td data-label="Label Penanda"><span class="badge badge-success">${escapeHtml(lg.group_label || 'Cabang')}</span></td>
                          <td class="font-mono" data-label="ID WhatsApp Group" style="font-size: 0.84rem;">${escapeHtml(lg.group_id)}</td>
                          <td class="text-subtle" data-label="Terhubung Sejak" style="font-size: 0.84rem;">${escapeHtml(lg.created_at || '-')}</td>
                          ${
                            canWrite
                              ? `
                            <td class="text-right" data-label="Aksi">
                              <div style="display: inline-flex; gap: 6px;">
                                <button type="button" class="btn btn-secondary btn-xs" data-link-edit="${Number(lg.id)}" data-link-label="${escapeHtml(lg.group_label || 'Cabang')}" data-link-jid="${escapeHtml(lg.group_id)}" title="Ubah Nama Penanda">Ubah Penanda</button>
                                <button type="button" class="btn btn-danger btn-xs" data-link-delete="${Number(lg.id)}" data-link-label="${escapeHtml(lg.group_label || 'Cabang')}" title="Putuskan Tautan">Putuskan</button>
                              </div>
                            </td>
                          `
                              : ''
                          }
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
            }
          </div>
        </section>
      </div>
      ${canWrite ? `<button type="button" class="fab" id="fab-add-position" aria-label="Tambah Jabatan" title="Atur Jabatan">+</button>` : ''}
    `;

    document.getElementById('fab-add-position')?.addEventListener('click', () => openStructureFormModal(null));

    const msgInput = document.getElementById('announcement-input');
    const previewBox = document.getElementById('announcement-preview-box');

    function updatePreview() {
      if (!previewBox) return;
      const msg = (msgInput?.value || '').trim() || 'Perhatian untuk seluruh anggota kelas!';
      previewBox.textContent =
        `📢 *PENGUMUMAN KELAS ${className.toUpperCase()}*\n` +
        `────────────────────────────\n\n` +
        `💬 *Pesan:*\n${msg}\n\n` +
        `📌 _Tertanda: Pengurus Kelas ${className}_`;
    }

    updatePreview();
    msgInput?.addEventListener('input', updatePreview);

    document.getElementById('btn-copy-announcement')?.addEventListener('click', async () => {
      const copyBtn = document.getElementById('btn-copy-announcement');
      try {
        await navigator.clipboard.writeText(previewBox?.textContent || '');
        if (copyBtn) {
          copyBtn.textContent = 'Tersalin ✓';
          setTimeout(() => {
            copyBtn.textContent = 'Salin Format Pengumuman';
          }, 2000);
        }
        showToast(`Format pengumuman untuk kelas ${className} berhasil disalin.`, 'success');
      } catch {
        showToast('Pratinjau pengumuman telah disiapkan.', 'info');
      }
    });

    document.getElementById('btn-add-position')?.addEventListener('click', () => openStructureFormModal(null));
    document.getElementById('btn-empty-add-position')?.addEventListener('click', () => openStructureFormModal(null));

    document.getElementById('btn-add-linked-group')?.addEventListener('click', () => openLinkGroupModal());
    document.getElementById('btn-empty-add-linked-group')?.addEventListener('click', () => openLinkGroupModal());

    container.querySelectorAll('[data-link-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-link-edit'));
        const label = btn.getAttribute('data-link-label') || 'Cabang';
        const jid = btn.getAttribute('data-link-jid') || '';
        openEditLinkGroupModal({ id, group_label: label, group_id: jid });
      });
    });

    container.querySelectorAll('[data-link-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-link-delete'));
        const label = btn.getAttribute('data-link-label') || 'Cabang';
        openConfirmUnlinkModal(id, label);
      });
    });
  }

  function openStructureFormModal(item = null) {
    const isEdit = Boolean(item);
    openModal({
      title: isEdit ? `Ubah Jabatan — ${item.position_name}` : 'Atur Jabatan Pengurus Kelas',
      bodyHtml: `
        <form id="modal-structure-form" class="auth-form">
          <div class="form-group">
            <label for="str-pos" class="form-label">Nama Jabatan</label>
            <input
              type="text"
              id="str-pos"
              class="form-input"
              placeholder="Contoh: KETUA / WAKIL KETUA / SEKRETARIS 1 / BENDAHARA 1"
              required
              value="${escapeHtml(item?.position_name || '')}"
            />
          </div>
          <div class="form-group">
            <label for="str-holder" class="form-label">Nama Pemegang Jabatan</label>
            <input
              type="text"
              id="str-holder"
              class="form-input"
              placeholder="Masukkan nama siswa pengurus"
              required
              value="${escapeHtml(item?.holder_name || '')}"
            />
          </div>
          <div class="form-group">
            <label for="str-phone" class="form-label">Nomor WhatsApp Pengurus</label>
            <input
              type="tel"
              id="str-phone"
              class="form-input font-mono"
              placeholder="081234567890"
              value="${escapeHtml(formatPhoneDisplay(item?.phone_number) === '—' ? '' : formatPhoneDisplay(item?.phone_number))}"
            />
            <span class="form-hint">Nomor ini akan dapat melakukan registrasi akun dashboard sesuai jabatannya.</span>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-save-structure" class="btn btn-primary">Simpan Jabatan</button>
      `,
      onMount: () => {
        document.getElementById('btn-save-structure')?.addEventListener('click', async () => {
          const payload = {
            position_name: document.getElementById('str-pos')?.value.trim() || '',
            holder_name: document.getElementById('str-holder')?.value.trim() || '',
            phone_number: document.getElementById('str-phone')?.value.trim() || ''
          };

          const res = await apiRequest('/api/structure', { method: 'POST', body: payload });
          if (!res.ok) {
            showToast(res.data.error || 'Gagal menyimpan jabatan pengurus.', 'error');
            return;
          }

          closeModal();
          showToast(res.data.message || 'Jabatan pengurus berhasil disimpan.', 'success');
          await loadStructureModule(document.getElementById('page-content'));
        });
      }
    });
  }

  function openStructureDeleteModal(structId) {
    const item = state.structures.find((s) => Number(s.id) === Number(structId));
    if (!item) return;

    openModal({
      title: 'Konfirmasi Hapus Jabatan Pengurus',
      bodyHtml: `
        <p style="font-size: 0.92rem;">
          Hapus jabatan <strong>${escapeHtml(item.position_name)}</strong> (${escapeHtml(item.holder_name)}) dari struktur organisasi kelas?
        </p>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-confirm-del-struct" class="btn btn-danger">Ya, Hapus Jabatan</button>
      `,
      onMount: () => {
        document.getElementById('btn-confirm-del-struct')?.addEventListener('click', async () => {
          const res = await apiRequest(`/api/structure/${item.id}`, { method: 'DELETE' });
          if (!res.ok) {
            showToast(res.data.error || 'Gagal menghapus jabatan.', 'error');
            return;
          }
          closeModal();
          showToast(res.data.message || 'Jabatan berhasil dihapus.', 'success');
          await loadStructureModule(document.getElementById('page-content'));
        });
      }
    });
  }

  function openLinkGroupModal() {
    openModal({
      title: 'Hubungkan Grup WhatsApp ke Kelas',
      bodyHtml: `
        <form id="modal-link-group-form" class="auth-form" onsubmit="return false;">
          <div class="form-group">
            <label for="link-group-id" class="form-label">ID Grup WhatsApp (JID)</label>
            <input
              type="text"
              id="link-group-id"
              class="form-input"
              placeholder="Contoh: 120363403751366495@g.us"
              required
            />
            <small class="form-hint" style="color: var(--text-subtle); font-size: 0.78rem; display: block; margin-top: 4px;">
              Salin ID grup WhatsApp (format @g.us). Pastikan bot sudah dimasukkan ke grup tersebut.
            </small>
          </div>

          <div class="form-group">
            <label for="link-group-label" class="form-label">Label Grup (Kategori)</label>
            <input
              type="text"
              id="link-group-label"
              class="form-input"
              placeholder="Contoh: Khusus Putra / Khusus Putri / Sub-Grup"
            />
            <small class="form-hint" style="color: var(--text-subtle); font-size: 0.78rem; display: block; margin-top: 4px;">
              Nama pembeda untuk mengenali grup cabang di panel ini.
            </small>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-save-link-group" class="btn btn-primary">Hubungkan Sekarang</button>
      `,
      onMount: () => {
        document.getElementById('btn-save-link-group')?.addEventListener('click', async () => {
          const groupIdInput = document.getElementById('link-group-id')?.value.trim() || '';
          const groupLabelInput = document.getElementById('link-group-label')?.value.trim() || '';

          if (!groupIdInput) {
            showToast('ID Grup WhatsApp wajib diisi.', 'error');
            return;
          }

          const res = await apiRequest('/api/classes/linked-groups', {
            method: 'POST',
            body: {
              linked_group_id: groupIdInput,
              group_label: groupLabelInput || 'Cabang'
            }
          });

          if (!res.ok) {
            showToast(res.data.error || 'Gagal menghubungkan grup.', 'error');
            return;
          }

          closeModal();
          showToast(res.data.message || 'Grup berhasil dihubungkan!', 'success');
          await loadStructureModule(document.getElementById('page-content'));
        });
      }
    });
  }

  function openConfirmUnlinkModal(id, label) {
    openModal({
      title: 'Putuskan Tautan Grup Cabang',
      bodyHtml: `
        <p style="font-size: 0.92rem;">
          Yakin ingin memutuskan tautan grup <strong>${escapeHtml(label)}</strong> dari kelas ini?
        </p>
        <p class="text-subtle" style="font-size: 0.84rem; margin-top: 8px;">
          Setelah diputuskan, jadwal, PR, dan kas kelas tidak akan lagi disinkronkan ke grup tersebut.
        </p>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-confirm-unlink" class="btn btn-danger">Ya, Putuskan Tautan</button>
      `,
      onMount: () => {
        document.getElementById('btn-confirm-unlink')?.addEventListener('click', async () => {
          const res = await apiRequest(`/api/classes/linked-groups/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            showToast(res.data.error || 'Gagal memutuskan tautan grup.', 'error');
            return;
          }
          closeModal();
          showToast(res.data.message || 'Tautan grup berhasil diputuskan.', 'success');
          await loadStructureModule(document.getElementById('page-content'));
        });
      }
    });
  }

  function openEditLinkGroupModal(item) {
    openModal({
      title: 'Ubah Penanda Grup Cabang',
      bodyHtml: `
        <form id="modal-edit-link-form" class="auth-form" onsubmit="return false;">
          <div class="form-group">
            <label class="form-label">ID WhatsApp Group (JID)</label>
            <div class="font-mono text-subtle" style="font-size: 0.84rem; background: var(--surface-2); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); word-break: break-all;">
              ${escapeHtml(item.group_id)}
            </div>
          </div>
          <div class="form-group">
            <label for="edit-link-label" class="form-label">Nama Penanda / Label Grup</label>
            <input
              type="text"
              id="edit-link-label"
              class="form-input"
              placeholder="Contoh: Khusus Putra / Khusus Putri / Grup Diskusi"
              value="${escapeHtml(item.group_label || '')}"
              required
              maxlength="80"
            />
            <small class="form-hint" style="color: var(--text-subtle); font-size: 0.78rem; display: block; margin-top: 4px;">
              Beri nama penanda yang jelas untuk mengenali fungsi grup cabang ini.
            </small>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-close-modal="true">Batal</button>
        <button type="button" id="btn-save-edit-link" class="btn btn-primary">Simpan Penanda</button>
      `,
      onMount: () => {
        const inputEl = document.getElementById('edit-link-label');
        inputEl?.focus();
        inputEl?.select();

        document.getElementById('btn-save-edit-link')?.addEventListener('click', async () => {
          const newLabel = inputEl?.value.trim() || '';
          if (!newLabel) {
            showToast('Nama penanda grup tidak boleh kosong.', 'error');
            return;
          }

          const res = await apiRequest(`/api/classes/linked-groups/${item.id}`, {
            method: 'PUT',
            body: { group_label: newLabel }
          });

          if (!res.ok) {
            showToast(res.data?.error || res.error || 'Gagal memperbarui penanda grup.', 'error');
            return;
          }

          closeModal();
          showToast(res.data?.message || 'Penanda grup berhasil diperbarui.', 'success');
          await loadStructureModule(document.getElementById('page-content'));
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 14. MODULE 7: AI & UTILITAS (/api/utils/calc & /api/utils/ai)
  // --------------------------------------------------------------------------

  function renderUtilitiesModule(container) {
    const COPY_ICON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="11" height="14" rx="2.5"></rect><path d="M5 8v9a2.5 2.5 0 0 0 2.5 2.5h8.5"></path></svg>`;
    const CHECK_ICON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    const currentUserId = state.currentUser?.id || state.currentUser?.phone_number || 'default';
    const chatStorageKey = `aras_ai_chat_user_${currentUserId}`;

    // Ambil riwayat chat terisolasi per user
    let chatHistory = [];
    try {
      const stored = localStorage.getItem(chatStorageKey);
      if (stored) {
        chatHistory = JSON.parse(stored);
      }
    } catch (_e) {
      chatHistory = [];
    }

    if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
      chatHistory = [
        {
          sender: 'ai',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          text: 'Halo! Saya Asisten Belajar AI SMK. Tanyakan materi kejuruan RPL, logika pemrograman, query SQL basis data, jaringan komputer, atau materi pelajaran lainnya.'
        }
      ];
    }

    container.innerHTML = `
      <div class="utilities-wrapper">
        <!-- Sub-Tab Header Switcher -->
        <div class="util-subtab-bar" role="tablist" aria-label="Sub-modul Utilitas">
          <button type="button" class="util-subtab-btn active" data-util-tab="ai" role="tab" aria-selected="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z"/></svg>
            <span>Asisten Belajar AI</span>
          </button>
          <button type="button" class="util-subtab-btn" data-util-tab="calc" role="tab" aria-selected="false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="16" y1="18" x2="16" y2="18.01"/><line x1="12" y1="18" x2="12" y2="18.01"/><line x1="8" y1="18" x2="8" y2="18.01"/></svg>
            <span>Kalkulator Ilmiah</span>
          </button>
        </div>

        <!-- TAB 1: ASISTEN BELAJAR AI (CHAT INTERFACE) -->
        <div id="util-pane-ai" class="util-pane active">
          <div class="chat-panel">
            <div class="chat-header">
              <div class="chat-header-info">
                <div class="chat-bot-avatar">AI</div>
                <div>
                  <h2 class="chat-header-title">Asisten Belajar AI Kelas SMK</h2>
                  <span class="chat-header-status">
                    <span class="status-dot"></span> Siap membantu materi produktif RPL, basis data & pelajaran
                  </span>
                </div>
              </div>
              <button type="button" id="btn-clear-chat" class="btn btn-secondary btn-sm" title="Bersihkan obrolan aktif">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Bersihkan<span class="hide-sm"> Obrolan</span></span>
              </button>
            </div>

            <!-- Messages Container -->
            <div id="chat-messages-container" class="chat-messages-container" aria-live="polite"></div>

            <!-- Chat Input Bar -->
            <form id="form-chat-ai" class="chat-input-bar">
              <textarea
                id="chat-ai-input"
                class="chat-input-field"
                placeholder="Ketik pertanyaan materi di sini..."
                rows="1"
                required
              ></textarea>
              <button type="submit" id="btn-send-chat" class="btn btn-primary chat-send-btn" aria-label="Kirim Pesan">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </form>
          </div>
        </div>

        <!-- TAB 2: KALKULATOR ILMIAH (/calc) -->
        <div id="util-pane-calc" class="util-pane hidden">
          <div class="panel calc-panel">
            <div class="panel-header">
              <div class="panel-title-group">
                <h2 class="panel-title">Kalkulator Matematika &amp; Ilmiah (/calc)</h2>
                <p class="panel-subtitle">Mendukung ekspresi aritmetika, pemangkatan, akar, modulus, dan trigonometri</p>
              </div>
            </div>
            
            <div class="panel-body" style="display: flex; flex-direction: column; gap: 18px;">
              <form id="form-util-calc" class="calc-form">
                <div class="form-group">
                  <label for="util-calc-expr" class="form-label">Ekspresi Rumus Matematika</label>
                  <div class="input-wrapper">
                    <input
                      type="text"
                      id="util-calc-expr"
                      class="form-input font-mono"
                      placeholder="Contoh: (25 * 4) + sqrt(144)"
                      autocomplete="off"
                      required
                    />
                  </div>
                </div>

                <!-- Barisan Chip Pintasan Cepat Rumus -->
                <div class="calc-chips-container">
                  <span class="calc-chips-label">Pintasan Rumus Cepat:</span>
                  <div class="calc-chips-row">
                    <button type="button" class="calc-chip" data-insert="sqrt()">√ Akar (sqrt)</button>
                    <button type="button" class="calc-chip" data-insert="^2">x² Pangkat 2</button>
                    <button type="button" class="calc-chip" data-insert="()">() Kurung</button>
                    <button type="button" class="calc-chip" data-insert=" % ">% Persen / Mod</button>
                    <button type="button" class="calc-chip" data-insert="pi">π Pi</button>
                    <button type="button" class="calc-chip" data-insert="sin()">sin()</button>
                    <button type="button" class="calc-chip" data-insert="cos()">cos()</button>
                    <button type="button" class="calc-chip" data-insert="tan()">tan()</button>
                    <button type="button" class="calc-chip calc-chip-clear" id="btn-clear-calc">Bersihkan</button>
                  </div>
                </div>

                <button type="submit" id="btn-submit-calc" class="btn btn-primary" style="align-self: flex-start; margin-top: 6px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                  <span>Hitung Hasil (/calc)</span>
                </button>
              </form>

              <!-- Hasil Display -->
              <div class="calc-result-box">
                <div class="calc-result-header">
                  <span class="form-label" style="margin: 0; font-size: 0.85rem; font-weight: 600;">Hasil Perhitungan:</span>
                  <button type="button" id="btn-copy-calc" class="btn-copy-calc hidden" aria-label="Salin hasil perhitungan" title="Salin nilai hasil">${COPY_ICON_SVG}</button>
                </div>
                <div id="util-calc-output" class="calc-output-display">
                  <span class="calc-output-placeholder">Masukkan ekspresi di atas lalu klik Hitung Hasil.</span>
                </div>
              </div>

              <!-- Panduan Sintaks Singkat -->
              <div class="calc-guide-card">
                <h4 class="calc-guide-title">Panduan Sintaks Operator</h4>
                <div class="calc-guide-grid">
                  <div class="calc-guide-item"><code>+ - * /</code><span>Penjumlahan, Pengurangan, Perkalian, Pembagian</span></div>
                  <div class="calc-guide-item"><code>^</code><span>Pangkat (misal: <code>2^8 = 256</code>)</span></div>
                  <div class="calc-guide-item"><code>sqrt(x)</code><span>Akar kuadrat (misal: <code>sqrt(144) = 12</code>)</span></div>
                  <div class="calc-guide-item"><code>sin, cos, tan</code><span>Fungsi trigonometri sudut</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 1. Sub-Tab Switcher Logic
    const tabBtns = container.querySelectorAll('.util-subtab-btn');
    const paneAi = container.querySelector('#util-pane-ai');
    const paneCalc = container.querySelector('#util-pane-calc');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-util-tab');
        tabBtns.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        if (targetTab === 'ai') {
          paneAi?.classList.remove('hidden');
          paneCalc?.classList.add('hidden');
        } else {
          paneCalc?.classList.remove('hidden');
          paneAi?.classList.add('hidden');
        }
      });
    });

    // 2. Chat Feed Rendering & Storage
    const chatContainer = container.querySelector('#chat-messages-container');

    function saveChatHistory() {
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(chatHistory));
      } catch (_e) {}
    }

    function renderChatFeed() {
      if (!chatContainer) return;
      chatContainer.innerHTML = chatHistory
        .map((msg, index) => {
          const isUser = msg.sender === 'user';
          return `
            <div class="chat-message-row ${isUser ? 'user' : 'ai'}">
              <div class="chat-bubble">
                <div class="chat-bubble-header">
                  <span>${isUser ? (state.currentUser?.name || 'Anda') : 'Asisten AI'} • ${escapeHtml(msg.time || '')}</span>
                  ${
                    !isUser
                      ? `<button type="button" class="btn-copy-bubble" data-msg-idx="${index}" aria-label="Salin jawaban AI" title="Salin jawaban AI">${COPY_ICON_SVG}</button>`
                      : ''
                  }
                </div>
                <div class="chat-bubble-text">${escapeHtml(msg.text)}</div>
              </div>
            </div>
          `;
        })
        .join('');

      // Bind copy buttons
      chatContainer.querySelectorAll('.btn-copy-bubble').forEach((b) => {
        b.addEventListener('click', () => {
          const idx = Number(b.getAttribute('data-msg-idx'));
          const text = chatHistory[idx]?.text || '';
          if (text) {
            navigator.clipboard.writeText(text);
            b.innerHTML = CHECK_ICON_SVG;
            b.classList.add('copied');
            showToast('Jawaban AI disalin ke papan klip.', 'success');
            setTimeout(() => {
              b.innerHTML = COPY_ICON_SVG;
              b.classList.remove('copied');
            }, 1500);
          }
        });
      });

      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    renderChatFeed();

    // 3. Clear Chat Button
    container.querySelector('#btn-clear-chat')?.addEventListener('click', () => {
      chatHistory = [
        {
          sender: 'ai',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          text: 'Obrolan telah dibersihkan. Silakan tanyakan materi atau pertanyaan baru.'
        }
      ];
      saveChatHistory();
      renderChatFeed();
      showToast('Sesi obrolan Anda telah dibersihkan.', 'info');
    });

    // 4. Send Chat Logic
    const chatForm = container.querySelector('#form-chat-ai');
    const chatInput = container.querySelector('#chat-ai-input');
    const sendBtn = container.querySelector('#btn-send-chat');

    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });

    chatForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prompt = chatInput?.value.trim() || '';
      if (!prompt) return;

      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      chatHistory.push({
        sender: 'user',
        time: nowTime,
        text: prompt
      });
      saveChatHistory();
      renderChatFeed();

      if (chatInput) chatInput.value = '';
      if (sendBtn) sendBtn.disabled = true;

      // Append temporary typing indicator
      const typingEl = document.createElement('div');
      typingEl.className = 'chat-message-row ai';
      typingEl.id = 'chat-typing-row';
      typingEl.innerHTML = `
        <div class="chat-bubble">
          <div class="chat-typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      `;
      chatContainer?.appendChild(typingEl);
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

      const res = await apiRequest('/api/utils/ai', { method: 'POST', body: { prompt } });
      if (sendBtn) sendBtn.disabled = false;
      document.getElementById('chat-typing-row')?.remove();

      const aiTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      if (!res.ok) {
        chatHistory.push({
          sender: 'ai',
          time: aiTime,
          text: res.data?.error || 'Maaf, terjadi gangguan saat menghubungi asisten AI. Silakan coba kembali.'
        });
        showToast('Gagal menghubungi layanan AI.', 'error');
      } else {
        chatHistory.push({
          sender: 'ai',
          time: aiTime,
          text: res.data.reply || 'Tidak ada respons dari AI.'
        });
      }

      saveChatHistory();
      renderChatFeed();
    });

    // 5. Kalkulator Pintasan Cepat & Submission
    const calcExprInput = container.querySelector('#util-calc-expr');
    const calcOutDisplay = container.querySelector('#util-calc-output');
    const btnCopyCalc = container.querySelector('#btn-copy-calc');

    container.querySelectorAll('.calc-chip[data-insert]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const toInsert = chip.getAttribute('data-insert') || '';
        if (!calcExprInput) return;
        const start = calcExprInput.selectionStart || 0;
        const end = calcExprInput.selectionEnd || 0;
        const val = calcExprInput.value;
        calcExprInput.value = val.substring(0, start) + toInsert + val.substring(end);
        calcExprInput.focus();
        const newPos = start + toInsert.length - (toInsert.endsWith(')') ? 1 : 0);
        calcExprInput.setSelectionRange(newPos, newPos);
      });
    });

    container.querySelector('#btn-clear-calc')?.addEventListener('click', () => {
      if (calcExprInput) {
        calcExprInput.value = '';
        calcExprInput.focus();
      }
      if (calcOutDisplay) {
        calcOutDisplay.innerHTML = '<span class="calc-output-placeholder">Masukkan ekspresi di atas lalu klik Hitung Hasil.</span>';
      }
      btnCopyCalc?.classList.add('hidden');
    });

    container.querySelector('#form-util-calc')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const expression = calcExprInput?.value.trim() || '';
      if (!expression || !calcOutDisplay) return;

      calcOutDisplay.innerHTML = '<span class="calc-output-placeholder">Menghitung...</span>';
      const res = await apiRequest('/api/utils/calc', { method: 'POST', body: { expression } });

      if (!res.ok) {
        calcOutDisplay.innerHTML = `<span class="calc-output-error">${escapeHtml(res.data?.error || 'Rumus tidak valid.')}</span>`;
        btnCopyCalc?.classList.add('hidden');
        return;
      }

      const val = res.data.value || res.data.result_text || '';
      const expr = res.data.expression || expression;
      const botText = res.data.bot_output || '';

      calcOutDisplay.innerHTML = `
        <div class="calc-output-content">
          <div class="calc-output-expr">${escapeHtml(expr)} =</div>
          <div class="calc-output-val">${escapeHtml(val)}</div>
          ${botText ? `
            <div class="calc-output-footer">
              <button type="button" class="btn-copy-wa" id="btn-copy-calc-wa" title="Salin format teks WhatsApp">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>Salin Format Bot WhatsApp</span>
              </button>
            </div>
          ` : ''}
        </div>
      `;

      if (btnCopyCalc) {
        btnCopyCalc.innerHTML = COPY_ICON_SVG;
        btnCopyCalc.classList.remove('hidden', 'copied');
        btnCopyCalc.onclick = () => {
          navigator.clipboard.writeText(val);
          btnCopyCalc.innerHTML = CHECK_ICON_SVG;
          btnCopyCalc.classList.add('copied');
          showToast(`Hasil (${val}) disalin ke clipboard!`, 'success');
          setTimeout(() => {
            btnCopyCalc.innerHTML = COPY_ICON_SVG;
            btnCopyCalc.classList.remove('copied');
          }, 1500);
        };
      }

      const btnCopyWa = container.querySelector('#btn-copy-calc-wa');
      if (btnCopyWa && botText) {
        btnCopyWa.onclick = () => {
          navigator.clipboard.writeText(botText);
          showToast('Format pesan WhatsApp disalin!', 'success');
        };
      }
    });
  }

  // --------------------------------------------------------------------------
  // 15. MODULE 8: DEVELOPER CONSOLE (/api/system/status & /api/system/audit-logs)
  // --------------------------------------------------------------------------

  async function loadDevConsoleModule(container) {
    if (!isDeveloper()) {
      container.innerHTML = renderForbiddenState(
        'Konsol sistem dan audit log hanya diizinkan untuk akun DEVELOPER.'
      );
      return;
    }

    container.innerHTML = renderLoadingState('Memuat metrik real-time server & log audit...');

    const [statusRes, logsRes, stickerRes] = await Promise.all([
      apiRequest('/api/system/status'),
      apiRequest('/api/system/audit-logs?limit=100'),
      apiRequest('/api/system/sticker-limit')
    ]);

    if (statusRes.status === 403 || logsRes.status === 403 || stickerRes.status === 403) {
      container.innerHTML = renderForbiddenState('Akses ditolak ke endpoint sistem.');
      return;
    }

    if (!statusRes.ok || !logsRes.ok) {
      container.innerHTML = renderErrorState(
        statusRes.data?.error || logsRes.data?.error || 'Gagal memuat metrik sistem Developer Console.'
      );
      return;
    }

    state.systemData = statusRes.data;
    state.auditLogs = logsRes.data.logs || [];
    state.stickerLimitData = stickerRes.ok ? stickerRes.data : null;

    renderDevConsoleView(container);
  }

  function renderDevConsoleView(container) {
    const m = state.systemData?.metrics || {};
    const statusText = state.systemData?.status_text || '';
    const dbCounts = m.db_counts || {};

    let tabBodyHtml = '';

    if (state.devTab === 'vps') {
      tabBodyHtml = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-header"><span class="stat-label">Sistem Operasi &amp; Host</span></div>
            <div class="stat-value" style="font-size: 1.15rem;">${escapeHtml(m.platform || 'Linux')}</div>
            <div class="stat-footer"><span class="font-mono">Host: ${escapeHtml(m.hostname || '-')}</span></div>
          </div>

          <div class="stat-card">
            <div class="stat-header"><span class="stat-label">Penggunaan RAM VPS</span></div>
            <div class="stat-value font-mono">${Number(m.ram?.used_percent || 0)}%</div>
            <div class="stat-footer">
              <span>${Number(m.ram?.used_gb || 0)} GB / ${Number(m.ram?.total_gb || 0)} GB • RSS: ${Number(m.ram?.rss_mb || 0)} MB</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-header"><span class="stat-label">Penyimpanan Disk (/)</span></div>
            <div class="stat-value font-mono">${m.disk ? `${m.disk.used_percent}%` : '—'}</div>
            <div class="stat-footer">
              <span>${m.disk ? `${m.disk.used_gb} GB terpakai dari ${m.disk.total_gb} GB` : 'Info disk tidak tersedia'}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-header"><span class="stat-label">Prosesor &amp; Uptime</span></div>
            <div class="stat-value" style="font-size: 1.1rem;">${Number(m.cpu_cores || 1)} Core CPU</div>
            <div class="stat-footer">
              <span>VPS: ${formatDuration(m.uptime?.vps_seconds)} • Web: ${formatDuration(m.uptime?.process_seconds)}</span>
            </div>
          </div>
        </div>

        <section class="panel" style="margin-top: 16px;">
          <div class="panel-header">
            <div class="panel-title-group">
              <h2 class="panel-title">Statistik Tabel Database SQLite Otoritatif</h2>
              <p class="panel-subtitle">Jumlah baris nyata pada database produksi saat ini</p>
            </div>
          </div>
          <div class="panel-body no-pad">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Nama Tabel</th>
                    <th>Keterangan Modul</th>
                    <th class="text-right">Jumlah Rekaman</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="font-mono">classes</td>
                    <td>Grup Kelas Terdaftar</td>
                    <td class="text-right font-mono"><strong>${Number(dbCounts.classes || 0)}</strong></td>
                  </tr>
                  <tr>
                    <td class="font-mono">students</td>
                    <td>Total Master Siswa Lintas Kelas</td>
                    <td class="text-right font-mono"><strong>${Number(dbCounts.students || 0)}</strong></td>
                  </tr>
                  <tr>
                    <td class="font-mono">schedules</td>
                    <td>Slot Jadwal Blok KBM Mingguan</td>
                    <td class="text-right font-mono"><strong>${Number(dbCounts.schedules || 0)}</strong></td>
                  </tr>
                  <tr>
                    <td class="font-mono">assignments</td>
                    <td>Rekaman Tugas &amp; PR</td>
                    <td class="text-right font-mono"><strong>${Number(dbCounts.assignments || 0)}</strong></td>
                  </tr>
                  <tr>
                    <td class="font-mono">cash_payments</td>
                    <td>Entri Pembayaran Kas Mingguan</td>
                    <td class="text-right font-mono"><strong>${Number(dbCounts.cash_payments || 0)}</strong></td>
                  </tr>
                  <tr>
                    <td class="font-mono">web_users / web_sessions</td>
                    <td>Akun Dashboard Terdaftar / Sesi Aktif</td>
                    <td class="text-right font-mono"><strong>${Number(dbCounts.web_users || 0)} akun / ${Number(dbCounts.active_sessions || 0)} sesi</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      `;
    } else if (state.devTab === 'ping') {
      tabBodyHtml = `
        <section class="panel">
          <div class="panel-header">
            <div class="panel-title-group">
              <h2 class="panel-title">Output Diagnostik /ping ARAS 1.0</h2>
              <p class="panel-subtitle">Dihasilkan langsung dari modul sistem bot (<code>getSystemStatusInfo</code>)</p>
            </div>
          </div>
          <div class="panel-body">
            <pre class="preview-terminal">${escapeHtml(statusText)}</pre>
          </div>
        </section>
      `;
    } else if (state.devTab === 'audit') {
      tabBodyHtml = `
        <section class="panel">
          <div class="panel-header">
            <div class="panel-title-group">
              <h2 class="panel-title">Audit Log Aktivitas Web Dashboard</h2>
              <p class="panel-subtitle">Menampilkan ${state.auditLogs.length} aktivitas terbaru (login, perubahan data, dan percobaan akses)</p>
            </div>
          </div>
          <div class="panel-body ${state.auditLogs.length > 0 ? 'no-pad' : ''}">
            ${
              state.auditLogs.length === 0
                ? renderEmptyState({
                    title: 'Belum Ada Catatan Audit Log',
                    description: 'Aktivitas pengguna akan tercatat secara otomatis di sini.'
                  })
                : `
                <div class="table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Aksi</th>
                        <th>Pengguna (No. HP)</th>
                        <th>Role</th>
                        <th>Kelas Target</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${state.auditLogs
                        .map(
                          (log) => `
                        <tr>
                          <td class="font-mono" style="font-size: 0.78rem;">${escapeHtml(log.created_at || '')}</td>
                          <td><span class="badge badge-neutral font-mono">${escapeHtml(log.action)}</span></td>
                          <td class="font-mono">${escapeHtml(formatPhoneDisplay(log.phone_number))}</td>
                          <td>
                            ${
                              log.role
                                ? `<span class="${getRoleBadgeClass(log.role)}">${escapeHtml(log.role)}</span>`
                                : '—'
                            }
                          </td>
                          <td class="font-mono" style="font-size: 0.76rem;">${escapeHtml(log.group_id || '—')}</td>
                          <td class="font-mono text-subtle" style="font-size: 0.75rem; max-width: 280px; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHtml(log.details || '')}
                          </td>
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
            }
          </div>
        </section>
      `;
    } else if (state.devTab === 'sticker') {
      const cfg = state.stickerLimitData?.config || {
        enabled: true,
        max_stickers: 1,
        window_seconds: 120,
        message: 'Pembuatan sticker sedang limit, mohon tunggu sebentar'
      };
      const groups = state.stickerLimitData?.groups || [];
      const windowMinutes = (Number(cfg.window_seconds || 120) / 60).toFixed(1).replace(/\.0$/, '');

      tabBodyHtml = `
        <div class="grid-2-cols">
          <section class="panel">
            <div class="panel-header">
              <div class="panel-title-group">
                <h2 class="panel-title">Konfigurasi Limit Pembuatan Stiker per Grup</h2>
                <p class="panel-subtitle">Berlaku otomatis untuk <code>/s</code>, <code>/sticker</code>, <code>/brat</code>, <code>/bratvid</code>, <code>/smeme</code>, <code>/emojimix</code>, dan <code>/qc</code></p>
              </div>
              <span class="badge ${cfg.enabled ? 'badge-success' : 'badge-neutral'}">
                ${cfg.enabled ? 'Limit Aktif' : 'Nonaktif'}
              </span>
            </div>
            <div class="panel-body">
              <form id="form-sticker-limit">
                <div class="form-group">
                  <label class="form-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <input
                      type="checkbox"
                      id="sticker-limit-enabled"
                      ${cfg.enabled ? 'checked' : ''}
                      style="width: 18px; height: 18px; accent-color: var(--accent);"
                    />
                    <span>Aktifkan Rate Limit Pembuatan Stiker di Setiap Grup</span>
                  </label>
                  <span class="form-hint">Jika diaktifkan, setiap grup hanya dapat membuat stiker sesuai kuota dan jendela waktu di bawah ini.</span>
                </div>

                <div class="form-row-2">
                  <div class="form-group">
                    <label for="sticker-limit-max" class="form-label">Maksimal Stiker per Grup</label>
                    <input
                      type="number"
                      id="sticker-limit-max"
                      class="form-input font-mono"
                      min="1"
                      max="100"
                      value="${Number(cfg.max_stickers || 1)}"
                      required
                    />
                    <span class="form-hint">Default: 1 stiker per jendela waktu.</span>
                  </div>

                  <div class="form-group">
                    <label for="sticker-limit-window" class="form-label">Durasi Cooldown / Jendela Waktu (Detik)</label>
                    <input
                      type="number"
                      id="sticker-limit-window"
                      class="form-input font-mono"
                      min="5"
                      max="86400"
                      value="${Number(cfg.window_seconds || 120)}"
                      required
                    />
                    <span class="form-hint">Default: 120 detik (${escapeHtml(windowMinutes)} menit).</span>
                  </div>
                </div>

                <div class="form-group">
                  <label for="sticker-limit-message" class="form-label">Pesan Balasan Saat Grup Sedang Limit</label>
                  <input
                    type="text"
                    id="sticker-limit-message"
                    class="form-input"
                    value="${escapeHtml(cfg.message || 'Pembuatan sticker sedang limit, mohon tunggu sebentar')}"
                    required
                  />
                  <span class="form-hint">Pesan ini hanya dikirim ketika grup sedang mencapai batas limit dan anggota mencoba membuat stiker.</span>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;">
                  <button type="submit" id="btn-save-sticker-limit" class="btn btn-primary">
                    Simpan Pengaturan Limit
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div class="panel-title-group">
                <h2 class="panel-title">Status Cooldown Grup Saat Ini</h2>
                <p class="panel-subtitle">Kuota penggunaan stiker real-time per grup dalam ${Number(cfg.window_seconds || 120)} detik terakhir</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" data-reset-sticker-limit="ALL">
                Reset Semua Cooldown
              </button>
            </div>
            <div class="panel-body ${groups.length > 0 ? 'no-pad' : ''}">
              ${
                groups.length === 0
                  ? renderEmptyState({
                      title: 'Belum Ada Grup Terdaftar',
                      description: 'Daftar grup kelas akan muncul secara otomatis setelah grup menggunakan bot.'
                    })
                  : `
                  <div class="table-responsive">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Nama Kelas / Grup</th>
                          <th class="text-center">Kuota Terpakai</th>
                          <th class="text-center">Status Saat Ini</th>
                          <th class="text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${groups
                          .map(
                            (g) => `
                          <tr>
                            <td>
                              <div><strong>${escapeHtml(g.class_name || g.group_id)}</strong></div>
                              <div class="font-mono text-subtle" style="font-size: 0.75rem;">${escapeHtml(g.group_id)}</div>
                            </td>
                            <td class="text-center font-mono">
                              <strong>${Number(g.used_count || 0)}</strong> / ${Number(g.max_stickers || cfg.max_stickers || 1)}
                            </td>
                            <td class="text-center">
                              ${
                                g.is_limited
                                  ? `<span class="badge badge-danger">Sedang Limit (${Number(g.remaining_seconds || 0)}s)</span>`
                                  : `<span class="badge badge-success">Tersedia</span>`
                              }
                            </td>
                            <td class="text-right">
                              <button
                                type="button"
                                class="btn btn-secondary btn-sm"
                                data-reset-sticker-limit="${escapeHtml(g.group_id)}"
                                ${Number(g.used_count || 0) === 0 ? 'disabled' : ''}
                              >
                                Reset
                              </button>
                            </td>
                          </tr>
                        `
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </div>
                `
              }
            </div>
          </section>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-group">
          <div class="subtabs" role="tablist">
            <button
              type="button"
              class="subtab-btn ${state.devTab === 'vps' ? 'active' : ''}"
              data-dev-tab="vps"
            >
              Status Layanan &amp; VPS
            </button>
            <button
              type="button"
              class="subtab-btn ${state.devTab === 'sticker' ? 'active' : ''}"
              data-dev-tab="sticker"
            >
              Limit Stiker Grup
            </button>
            <button
              type="button"
              class="subtab-btn ${state.devTab === 'ping' ? 'active' : ''}"
              data-dev-tab="ping"
            >
              Output /ping ARAS 1.0
            </button>
            <button
              type="button"
              class="subtab-btn ${state.devTab === 'audit' ? 'active' : ''}"
              data-dev-tab="audit"
            >
              Audit Log Aktivitas
            </button>
          </div>
        </div>
      </div>
      ${tabBodyHtml}
    `;

    // Pasang listener form pengaturan limit stiker bila sedang aktif di tab sticker
    const stickerForm = document.getElementById('form-sticker-limit');
    if (stickerForm) {
      stickerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('btn-save-sticker-limit');
        const enabled = Boolean(document.getElementById('sticker-limit-enabled')?.checked);
        const maxStickers = parseInt(document.getElementById('sticker-limit-max')?.value || '1', 10);
        const windowSeconds = parseInt(document.getElementById('sticker-limit-window')?.value || '120', 10);
        const message = document.getElementById('sticker-limit-message')?.value.trim() || 'Pembuatan sticker sedang limit, mohon tunggu sebentar';

        if (saveBtn) saveBtn.disabled = true;
        const res = await apiRequest('/api/system/sticker-limit', {
          method: 'POST',
          body: {
            enabled,
            max_stickers: maxStickers,
            window_seconds: windowSeconds,
            message
          }
        });
        if (saveBtn) saveBtn.disabled = false;

        if (!res.ok) {
          showToast(res.data?.error || 'Gagal menyimpan pengaturan limit stiker.', 'error');
          return;
        }

        state.stickerLimitData = res.data;
        showToast(res.data.message || 'Pengaturan limit stiker berhasil diperbarui.', 'success');
        renderDevConsoleView(container);
      });
    }
  }

  // --------------------------------------------------------------------------
  // 16. EVENT LISTENERS & DELEGATION
  // --------------------------------------------------------------------------

  function setupGlobalEvents() {
    // Toggle Login / Register Tab
    document.getElementById('tab-btn-login')?.addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tab-btn-register')?.addEventListener('click', () => switchAuthTab('register'));

    // Password Visibility Toggle
    document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-toggle-password');
        const input = document.getElementById(targetId);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });

    // Form Login Submit (/api/auth/login)
    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAuthAlert('');

      const phone = document.getElementById('login-phone')?.value.trim() || '';
      const password = document.getElementById('login-password')?.value || '';
      const submitBtn = document.getElementById('btn-submit-login');

      if (!phone || !password) {
        showAuthAlert('Nomor WhatsApp dan kata sandi wajib diisi.');
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { phone_number: phone, password }
      });
      if (submitBtn) submitBtn.disabled = false;

      if (!res.ok) {
        showAuthAlert(res.data.error || 'Gagal masuk. Periksa kembali nomor HP dan kata sandi Anda.');
        return;
      }

      // Jangan pernah menyimpan password di localStorage
      const pwdInput = document.getElementById('login-password');
      if (pwdInput) pwdInput.value = '';

      applyAuthenticatedUser(res.data);
      showToast(`Selamat datang kembali, ${state.currentUser.name || state.currentUser.role}.`, 'success');
      await enterAppShell();
    });

    // Live Password Strength & Confirmation Match Feedback
    const regPasswordInput = document.getElementById('reg-password');
    const regPasswordConfirmInput = document.getElementById('reg-password-confirm');
    regPasswordInput?.addEventListener('input', updatePasswordValidationUI);
    regPasswordConfirmInput?.addEventListener('input', updatePasswordValidationUI);

    // Form Registrasi Pengurus Submit (/api/auth/register)
    document.getElementById('form-register')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAuthAlert('');

      const phone = document.getElementById('reg-phone')?.value.trim() || '';
      const password = document.getElementById('reg-password')?.value || '';
      const confirmPwd = document.getElementById('reg-password-confirm')?.value || '';
      const submitBtn = document.getElementById('btn-submit-register');

      if (!phone || !password) {
        showAuthAlert('Nomor WhatsApp dan kata sandi baru wajib diisi.');
        return;
      }
      if (password.length < 8) {
        showAuthAlert('Kata sandi minimal harus terdiri dari 8 karakter.');
        return;
      }
      if (password !== confirmPwd) {
        showAuthAlert('Konfirmasi kata sandi tidak cocok.');
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: { phone_number: phone, password }
      });
      if (submitBtn) submitBtn.disabled = false;

      if (!res.ok) {
        showAuthAlert(res.data.error || 'Registrasi ditolak. Pastikan nomor Anda terdaftar sebagai pengurus kelas.');
        return;
      }

      resetPasswordValidationUI();

      applyAuthenticatedUser(res.data);
      showToast(`Registrasi berhasil! Anda masuk sebagai ${state.currentUser.role}.`, 'success');
      await enterAppShell();
    });

    // Logout Button
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      showToast('Anda telah keluar dari sesi dashboard.', 'info');
      showLoginView();
    });

    // Refresh Active Page Button
    document.getElementById('btn-refresh-page')?.addEventListener('click', () => {
      navigateToModule(state.activeModule);
    });

    // Mobile Topbar Refresh Button
    document.getElementById('btn-mobile-refresh')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-mobile-refresh');
      btn?.classList.add('rotating');
      await navigateToModule(state.activeModule);
      setTimeout(() => btn?.classList.remove('rotating'), 500);
    });

    // Bottom Nav Slot 5 ("Lainnya") Toggle
    document.querySelector('[data-nav-slot="more"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (isMoreSheetOpen()) {
        closeMoreSheet();
      } else {
        openMoreSheet();
      }
    });

    // "Lainnya" Sheet Backdrop & Close Button
    document.getElementById('backdrop-more-nav')?.addEventListener('click', closeMoreSheet);
    document.getElementById('sheet-more-backdrop')?.addEventListener('click', closeMoreSheet);
    document.getElementById('btn-close-more-sheet')?.addEventListener('click', closeMoreSheet);

    // "Lainnya" Sheet Logout Button
    document.getElementById('btn-sheet-logout')?.addEventListener('click', async () => {
      closeMoreSheet();
      await apiRequest('/api/auth/logout', { method: 'POST' });
      showToast('Anda telah keluar dari sesi dashboard.', 'info');
      showLoginView();
    });

    // Global Keyboard Handler (Escape to dismiss, Tab to trap focus)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay && !modalOverlay.classList.contains('hidden')) {
          e.preventDefault();
          closeModal();
          return;
        }

        if (isMoreSheetOpen()) {
          e.preventDefault();
          closeMoreSheet();
          return;
        }

        const sidebar = document.getElementById('app-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          e.preventDefault();
          closeMobileDrawer();
          return;
        }
      }

      if (e.key === 'Tab') {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay && !modalOverlay.classList.contains('hidden')) {
          const modalContainer = document.getElementById('modal-container');
          trapFocusInContainer(e, modalContainer);
          return;
        }

        if (isMoreSheetOpen()) {
          const sheet = document.getElementById('sheet-more-nav');
          trapFocusInContainer(e, sheet);
          return;
        }

        const sidebar = document.getElementById('app-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          trapFocusInContainer(e, sidebar);
          return;
        }
      }
    });

    // Mobile Drawer Toggle
    document.getElementById('btn-mobile-menu')?.addEventListener('click', openMobileDrawer);
    document.getElementById('btn-close-sidebar')?.addEventListener('click', closeMobileDrawer);
    document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileDrawer);

    // Developer Class Switcher (POST /api/classes/switch)
    document.getElementById('developer-class-select')?.addEventListener('change', async (e) => {
      const groupId = e.target.value;
      if (!groupId) return;

      const res = await apiRequest('/api/classes/switch', {
        method: 'POST',
        body: { group_id: groupId }
      });

      if (!res.ok) {
        showToast(res.data.error || 'Gagal berpindah konteks kelas.', 'error');
        return;
      }

      const newClassName = res.data.class_info?.class_name || groupId;
      if (state.currentUser) {
        state.currentUser.active_group_id = groupId;
        state.currentUser.class_name = newClassName;
      }

      // Reset filter minggu jadwal agar mengikuti minggu aktif kelas baru
      state.scheduleWeek = null;
      state.cashWeek = null;

      renderUserAndClassContext();
      showToast(`Konteks kelas beralih ke ${newClassName}`, 'success');
      await navigateToModule(state.activeModule);
    });

    // Close Modal Buttons
    document.getElementById('btn-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') closeModal();
    });

    // Delegated Click Handler for Dynamic Content
    document.addEventListener('click', async (e) => {
      const target = e.target.closest(
        '[data-navigate], [data-close-modal], [data-action], [data-student-detail], [data-student-edit], [data-student-delete], [data-schedule-edit], [data-schedule-delete], [data-toggle-cash], [data-cash-view-all], [data-pr-filter], [data-pr-toggle], [data-pr-edit], [data-pr-delete], [data-struct-edit], [data-struct-delete], [data-dev-tab]'
      );
      if (!target) return;

      if (target.hasAttribute('data-close-modal')) {
        closeModal();
        return;
      }

      if (target.getAttribute('data-action') === 'openClassSheet') {
        e.preventDefault();
        closeMoreSheet();
        await openClassSelectorModal();
        return;
      }

      if (target.hasAttribute('data-navigate')) {
        e.preventDefault();
        const mod = target.getAttribute('data-navigate');
        if (mod) await navigateToModule(mod);
        return;
      }

      if (target.getAttribute('data-action') === 'retryCurrentModule') {
        await navigateToModule(state.activeModule);
        return;
      }

      // Students actions
      if (target.hasAttribute('data-student-detail')) {
        openStudentDetailModal(target.getAttribute('data-student-detail'));
        return;
      }
      if (target.hasAttribute('data-student-edit')) {
        const id = Number(target.getAttribute('data-student-edit'));
        const st = state.students.find((s) => Number(s.id) === id);
        if (st) openStudentFormModal(st);
        return;
      }
      if (target.hasAttribute('data-student-delete')) {
        openStudentDeleteModal(target.getAttribute('data-student-delete'));
        return;
      }

      // Schedule actions
      if (target.hasAttribute('data-schedule-edit')) {
        const id = Number(target.getAttribute('data-schedule-edit'));
        const sch = state.schedules.find((s) => Number(s.id) === id);
        if (sch) openScheduleFormModal(sch);
        return;
      }
      if (target.hasAttribute('data-schedule-delete')) {
        openScheduleDeleteModal(target.getAttribute('data-schedule-delete'));
        return;
      }

      if (target.hasAttribute('data-cash-view-all')) {
        openStudentAllWeeksModal(target.getAttribute('data-cash-view-all'));
        return;
      }

      // Cash payment toggle (Optimistic In-Place Update — Zero Page Reload)
      if (target.hasAttribute('data-toggle-cash')) {
        const raw = target.getAttribute('data-toggle-cash') || '';
        const [studentId, weekNumber, nextPaidInt] = raw.split(':').map((v) => parseInt(v, 10));
        if (!studentId || !weekNumber || target.classList.contains('is-saving')) return;

        const nextPaid = nextPaidInt === 1;
        const prevPaid = !nextPaid;

        // 1. Optimistic update seketika di DOM & state lokal tanpa me-reload halaman
        updateCashRowInPlace(studentId, weekNumber, nextPaid, target);
        target.classList.add('is-saving');

        // 2. Kirim pembaruan ke server di latar belakang
        const res = await apiRequest('/api/cash/payments', {
          method: 'POST',
          body: {
            student_id: studentId,
            week_number: weekNumber,
            is_paid: nextPaid
          }
        });

        target.classList.remove('is-saving');

        // 3. Rollback ke status semula hanya jika terjadi error dari server
        if (!res.ok) {
          updateCashRowInPlace(studentId, weekNumber, prevPaid, target);
          showToast(res.data?.error || 'Gagal memperbarui pembayaran kas.', 'error');
        }
        return;
      }

      // Assignments actions
      if (target.hasAttribute('data-pr-filter')) {
        state.assignmentFilter = target.getAttribute('data-pr-filter') || 'active';
        await loadAssignmentsModule(document.getElementById('page-content'));
        return;
      }
      if (target.hasAttribute('data-pr-toggle')) {
        const id = Number(target.getAttribute('data-pr-toggle'));
        const res = await apiRequest(`/api/assignments/${id}/toggle`, { method: 'PATCH' });
        if (!res.ok) {
          showToast(res.data.error || 'Gagal mengubah status tugas.', 'error');
          return;
        }
        showToast(res.data.message || 'Status tugas diperbarui.', 'success');
        await loadAssignmentsModule(document.getElementById('page-content'));
        return;
      }
      if (target.hasAttribute('data-pr-edit')) {
        const id = Number(target.getAttribute('data-pr-edit'));
        const pr = state.assignments.find((a) => Number(a.id) === id);
        if (pr) openAssignmentFormModal(pr);
        return;
      }
      if (target.hasAttribute('data-pr-delete')) {
        openAssignmentDeleteModal(target.getAttribute('data-pr-delete'));
        return;
      }

      // Structure actions
      if (target.hasAttribute('data-struct-edit')) {
        const id = Number(target.getAttribute('data-struct-edit'));
        const st = state.structures.find((s) => Number(s.id) === id);
        if (st) openStructureFormModal(st);
        return;
      }
      if (target.hasAttribute('data-struct-delete')) {
        openStructureDeleteModal(target.getAttribute('data-struct-delete'));
        return;
      }

      // Developer Console sub-tabs
      if (target.hasAttribute('data-dev-tab')) {
        state.devTab = target.getAttribute('data-dev-tab') || 'vps';
        renderDevConsoleView(document.getElementById('page-content'));
        return;
      }

      // Reset Cooldown Limit Stiker (Developer)
      if (target.hasAttribute('data-reset-sticker-limit')) {
        const groupId = target.getAttribute('data-reset-sticker-limit') || 'ALL';
        target.disabled = true;
        const res = await apiRequest('/api/system/sticker-limit/reset', {
          method: 'POST',
          body: { group_id: groupId }
        });
        target.disabled = false;

        if (!res.ok) {
          showToast(res.data?.error || 'Gagal me-reset cooldown limit stiker.', 'error');
          return;
        }

        state.stickerLimitData = res.data;
        showToast(res.data.message || 'Cooldown limit stiker berhasil di-reset.', 'success');
        renderDevConsoleView(document.getElementById('page-content'));
        return;
      }
    });
  }

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    setupGlobalEvents();
    checkInitialSession();
    enhanceAllSelects();
  });
})();
