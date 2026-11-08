/**
 * Kastor-AI Web Dashboard — Client-Side Demo Sandbox
 * 
 * Mengelola sesi demo terisolasi secara 100% di browser (client-side) menggunakan localStorage.
 * Meng-intercept window.fetch untuk semua endpoint /api/* sehingga data fiktif dapat diubah,
 * ditambah, dan dihapus layaknya Developer tanpa menyentuh server database (database.sqlite).
 */

(function () {
  'use strict';

  const DEMO_ACTIVE_KEY = 'kastor_demo_active';
  const DEMO_STORE_KEY = 'kastor_demo_store_v2';
  const DEMO_GROUP_ID = '120363999999999999@g.us';

  /**
   * Menghasilkan dataset fiktif acak awal (fresh seed)
   */
  function generateDefaultDemoStore() {
    const defaultStudents = [
      { id: 1, group_id: DEMO_GROUP_ID, name: 'Ahmad Fauzi', phone_number: '081290001001', gender: 'L' },
      { id: 2, group_id: DEMO_GROUP_ID, name: 'Budi Santoso', phone_number: '081290001002', gender: 'L' },
      { id: 3, group_id: DEMO_GROUP_ID, name: 'Citra Lestari', phone_number: '081290001003', gender: 'P' },
      { id: 4, group_id: DEMO_GROUP_ID, name: 'Dimas Pratama', phone_number: '081290001004', gender: 'L' },
      { id: 5, group_id: DEMO_GROUP_ID, name: 'Eka Rahmawati', phone_number: '081290001005', gender: 'P' },
      { id: 6, group_id: DEMO_GROUP_ID, name: 'Farhan Syahputra', phone_number: '081290001006', gender: 'L' },
      { id: 7, group_id: DEMO_GROUP_ID, name: 'Gita Permata', phone_number: '081290001007', gender: 'P' },
      { id: 8, group_id: DEMO_GROUP_ID, name: 'Hendra Gunawan', phone_number: '081290001008', gender: 'L' },
      { id: 9, group_id: DEMO_GROUP_ID, name: 'Intan Nuraini', phone_number: '081290001009', gender: 'P' },
      { id: 10, group_id: DEMO_GROUP_ID, name: 'Joko Wahyudi', phone_number: '081290001010', gender: 'L' }
    ];

    const defaultStructure = [
      { id: 1, group_id: DEMO_GROUP_ID, position_name: 'Ketua Kelas', holder_name: 'Ahmad Fauzi', phone_number: '081290001001' },
      { id: 2, group_id: DEMO_GROUP_ID, position_name: 'Wakil Ketua', holder_name: 'Dimas Pratama', phone_number: '081290001004' },
      { id: 3, group_id: DEMO_GROUP_ID, position_name: 'Sekretaris', holder_name: 'Citra Lestari', phone_number: '081290001003' },
      { id: 4, group_id: DEMO_GROUP_ID, position_name: 'Bendahara', holder_name: 'Eka Rahmawati', phone_number: '081290001005' },
      { id: 5, group_id: DEMO_GROUP_ID, position_name: 'Seksi Keamanan', holder_name: 'Joko Wahyudi', phone_number: '081290001010' }
    ];

    const defaultSchedules = [
      { id: 1, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 1, subject: 'Matematika Terapan', teacher: 'Pak Hendro, S.Pd', room: 'R-101', time_start: '07:00', time_end: '09:15' },
      { id: 2, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 1, subject: 'Pemrograman Web & Perangkat Bergerak', teacher: 'Bu Maya, M.Kom', room: 'Lab Komputer 1', time_start: '09:30', time_end: '12:00' },
      { id: 3, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 1, subject: 'Bahasa Indonesia', teacher: 'Bu Sri Rahayu', room: 'R-101', time_start: '13:00', time_end: '15:30' },

      { id: 4, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 2, subject: 'Basis Data & SQL Relasional', teacher: 'Pak Dodi Prabowo', room: 'Lab Komputer 2', time_start: '07:00', time_end: '11:30' },
      { id: 5, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 2, subject: 'Pemrograman Berorientasi Objek', teacher: 'Bu Maya, M.Kom', room: 'Lab Komputer 1', time_start: '12:30', time_end: '15:30' },

      { id: 6, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 3, subject: 'Bahasa Inggris Teknis', teacher: 'Mr. Ryan Kusuma', room: 'R-101', time_start: '07:00', time_end: '09:30' },
      { id: 7, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 3, subject: 'Pendidikan Pancasila', teacher: 'Pak Agus Salim', room: 'R-101', time_start: '09:45', time_end: '12:00' },
      { id: 8, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 3, subject: 'Desain Grafis & UI/UX', teacher: 'Bu Ratna Dewi', room: 'Lab Desain', time_start: '13:00', time_end: '15:30' },

      { id: 9, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 4, subject: 'Proyek Kolaborasi Digital & Rekayasa', teacher: 'Tim Guru Pengampu', room: 'Lab Studio Digital', time_start: '07:00', time_end: '11:30' },
      { id: 10, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 4, subject: 'Cloud & DevOps Fundamental', teacher: 'Pak Kevin Sanjaya', room: 'Lab Komputer 1', time_start: '12:30', time_end: '15:00' },

      { id: 11, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 5, subject: 'Pendidikan Agama & Budi Pekerti', teacher: 'Ust. Nur Hidayat', room: 'Masjid Sekolah', time_start: '07:00', time_end: '09:00' },
      { id: 12, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 5, subject: 'Pendidikan Jasmani & Olahraga', teacher: 'Pak Bambang S.', room: 'Lapangan Utama', time_start: '09:15', time_end: '11:15' },
      { id: 13, group_id: DEMO_GROUP_ID, week_number: 18, day_index: 5, subject: 'Bimbingan Konseling & Budaya Industri', teacher: 'Bu Dian Safitri', room: 'R-101', time_start: '13:00', time_end: '15:15' }
    ];

    const todayDate = new Date();
    const inThreeDays = new Date(todayDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 23:59';
    const nextWeek = new Date(todayDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 12:00';
    const pastDate = new Date(todayDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 15:00';

    const defaultAssignments = [
      { id: 1, group_id: DEMO_GROUP_ID, subject: 'Desain Grafis & UI/UX', title: 'Tugas Wireframe Mobile Dashboard', description: 'Buat prototype low-fidelity dashboard kelas format Figma/Paper.', deadline: nextWeek, is_completed: 0 },
      { id: 2, group_id: DEMO_GROUP_ID, subject: 'Basis Data & SQL Relasional', title: 'Studi Kasus Normalisasi 3NF', description: 'Kerjakan soal latihan normalisasi dari tabel transaksi toko ritel.', deadline: inThreeDays, is_completed: 0 },
      { id: 3, group_id: DEMO_GROUP_ID, subject: 'Pemrograman Web', title: 'Mini Project Client-Side LocalStorage', description: 'Simulasikan persistensi CRUD JavaScript tanpa server DB.', deadline: pastDate, is_completed: 1 }
    ];

    const defaultCashSettings = {
      weekly_fee: 5000,
      active_weeks_count: 8,
      holiday_weeks: [3]
    };

    // Pre-populate cash payments
    // Total minggu aktif (tanpa libur w3): w1, w2, w4, w5, w6, w7, w8 = 7 minggu wajib bayar
    const defaultPayments = [];
    const activeWeeks = [1, 2, 4, 5, 6, 7, 8];

    defaultStudents.forEach((student, idx) => {
      // Siswa 1-4 lunas penuh (7 minggu)
      // Siswa 5-7 bayar 6 minggu (tunggakan 1 minggu)
      // Siswa 8-10 bayar 5 minggu (tunggakan 2 minggu)
      let paidCount = 7;
      if (idx >= 4 && idx < 7) paidCount = 6;
      else if (idx >= 7) paidCount = 5;

      for (let i = 0; i < activeWeeks.length; i++) {
        const w = activeWeeks[i];
        defaultPayments.push({
          student_id: student.id,
          week_number: w,
          is_paid: i < paidCount ? 1 : 0
        });
      }
    });

    const defaultFinanceTransactions = [
      { id: 1, group_id: DEMO_GROUP_ID, type: 'INCOME', amount: 350000, category: 'KAS_MASUK', description: 'Setoran Kas Mingguan (Minggu 1-5)', transaction_date: '2026-10-05', receipt_url: null },
      { id: 2, group_id: DEMO_GROUP_ID, type: 'EXPENSE', amount: 45000, category: 'PERLENGKAPAN', description: 'Spidol Whiteboard & Refill Tinta Hitam', transaction_date: '2026-10-12', receipt_url: null },
      { id: 3, group_id: DEMO_GROUP_ID, type: 'EXPENSE', amount: 30000, category: 'KEBERSIHAN', description: 'Kantong Plastik Sampah & Sabun Cuci Tangan', transaction_date: '2026-10-20', receipt_url: null },
      { id: 4, group_id: DEMO_GROUP_ID, type: 'INCOME', amount: 150000, category: 'KAS_MASUK', description: 'Setoran Kas Lanjutan (Minggu 6-7)', transaction_date: '2026-11-02', receipt_url: null }
    ];

    const defaultAuditLogs = [
      { id: 1, phone_number: '08000000000', action: 'DEMO_SESSION_STARTED', details: JSON.stringify({ ip: '127.0.0.1', agent: 'Demo Browser' }), created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, phone_number: '08000000000', action: 'DEV_EXPLORE_DASHBOARD', details: JSON.stringify({ target: 'XI Sains Digital (Demo)' }), created_at: new Date(Date.now() - 1800000).toISOString() },
      { id: 3, phone_number: '08000000000', action: 'SANDBOX_DATA_INIT', details: JSON.stringify({ status: 'ok', isolated: true }), created_at: new Date().toISOString() }
    ];

    return {
      classes: [
        {
          group_id: DEMO_GROUP_ID,
          class_name: 'XI Sains Digital (Demo)',
          academic_year: '2026/2027',
          semester_start_date: '2026-07-13',
          created_at: '2026-07-13 07:00:00',
          student_count: defaultStudents.length,
          linked_count: 0
        }
      ],
      active_group_id: DEMO_GROUP_ID,
      students: defaultStudents,
      structure: defaultStructure,
      schedules: defaultSchedules,
      assignments: defaultAssignments,
      cash_settings: defaultCashSettings,
      cash_payments: defaultPayments,
      finance_transactions: defaultFinanceTransactions,
      audit_logs: defaultAuditLogs,
      sticker_limit: {
        limit: 25,
        used: 4,
        reset_time: '00:00 WIB'
      }
    };
  }

  /**
   * Helper akses & persistensi store demo di localStorage
   */
  function getDemoStore() {
    if (localStorage.getItem('kastor_demo_store')) {
      localStorage.removeItem('kastor_demo_store');
    }
    try {
      const raw = localStorage.getItem(DEMO_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.classes && parsed.classes[0]?.class_name?.includes('RPL')) {
          return resetDemoStore();
        }
        return parsed;
      }
    } catch {
      // JSON parse error -> buat ulang
    }
    const store = generateDefaultDemoStore();
    saveDemoStore(store);
    return store;
  }

  function saveDemoStore(store) {
    try {
      localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
    } catch (e) {
      console.warn('[DEMO SANDBOX] Gagal menyimpan ke localStorage:', e);
    }
  }

  function resetDemoStore() {
    const store = generateDefaultDemoStore();
    saveDemoStore(store);
    return store;
  }

  function isDemoActive() {
    return (
      window.location.pathname === '/demo' ||
      window.location.pathname.startsWith('/demo/')
    );
  }

  function activateDemoMode() {
    // Jika belum ada data atau baru pertama aktif, inisialisasi default
    if (!localStorage.getItem(DEMO_STORE_KEY)) {
      resetDemoStore();
    }
  }

  function exitDemoMode() {
    localStorage.removeItem(DEMO_STORE_KEY);
    window.location.href = '/';
  }

  /**
   * Helper membuat HTTP Mock Response
   */
  function mockResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Demo-Sandbox': 'true'
      }
    });
  }

  /**
   * Handler Intercept Mock Router untuk semua endpoint /api/*
   */
  async function handleDemoApi(url, init = {}) {
    const parsedUrl = new URL(url, window.location.origin);
    const pathname = parsedUrl.pathname;
    const method = (init.method || 'GET').toUpperCase();
    const params = parsedUrl.searchParams;

    let body = {};
    if (init.body) {
      try {
        body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      } catch {
        body = {};
      }
    }

    const store = getDemoStore();

    // 1. AUTENTIKASI & PROFIL
    if (pathname === '/api/auth/me') {
      return mockResponse({
        ok: true,
        user: {
          id: 9999,
          phone_number: '08000000000',
          name: 'Demo Developer',
          role: 'DEVELOPER',
          group_id: store.active_group_id,
          active_group_id: store.active_group_id
        },
        csrf_token: 'demo-csrf-token-sandbox',
        permissions: {
          can_view_all_classes: true,
          can_view_schedules: true,
          can_manage_schedules: true,
          can_view_assignments: true,
          can_manage_assignments: true,
          can_view_cash: true,
          can_manage_cash: true,
          can_manage_cash_settings: true,
          can_view_finance: true,
          can_manage_finance: true,
          can_view_students: true,
          can_manage_students: true,
          can_view_structure: true,
          can_manage_structure: true,
          can_view_utilities: true,
          can_view_dev_console: true,
          can_manage_system: true,
          can_manage_ai: true,
          can_manage_stickers: true
        }
      });
    }

    if (pathname === '/api/auth/login') {
      activateDemoMode();
      return mockResponse({
        ok: true,
        message: 'Login demo berhasil',
        user: {
          id: 9999,
          phone_number: '08000000000',
          name: 'Demo Developer',
          role: 'DEVELOPER'
        }
      });
    }

    if (pathname === '/api/auth/logout') {
      exitDemoMode();
      return mockResponse({ ok: true, message: 'Keluar sesi demo.' });
    }

    // 2. KELAS & KONTEKS
    if (pathname === '/api/classes' && method === 'GET') {
      return mockResponse({
        ok: true,
        active_group_id: store.active_group_id,
        classes: store.classes
      });
    }

    if (pathname === '/api/classes/switch' && method === 'POST') {
      store.active_group_id = body.group_id || DEMO_GROUP_ID;
      saveDemoStore(store);
      return mockResponse({ ok: true, active_group_id: store.active_group_id });
    }

    if (pathname.startsWith('/api/classes/linked-groups')) {
      return mockResponse({ ok: true, linked_groups: [] });
    }

    // 3. DASHBOARD STATS
    if (pathname === '/api/dashboard/stats' && method === 'GET') {
      const cls = store.classes[0];
      const activeAssignments = store.assignments.filter(a => !a.is_completed);
      const completedCount = store.assignments.filter(a => a.is_completed).length;

      // Hitung ringkasan kas
      const weeklyFee = store.cash_settings.weekly_fee;
      const activeWeeks = store.cash_settings.active_weeks_count;
      const holidays = new Set(store.cash_settings.holiday_weeks || []);

      let totalPayableWeeks = 0;
      for (let w = 1; w <= activeWeeks; w++) {
        if (!holidays.has(w)) totalPayableWeeks++;
      }

      let lunasCount = 0;
      let menunggakCount = 0;
      let totalPaidUnits = 0;

      store.students.forEach(st => {
        const studentPaidWeeks = store.cash_payments.filter(
          p => p.student_id === st.id && p.is_paid && !holidays.has(p.week_number)
        ).length;
        totalPaidUnits += studentPaidWeeks;
        if (studentPaidWeeks >= totalPayableWeeks) {
          lunasCount++;
        } else {
          menunggakCount++;
        }
      });

      return mockResponse({
        ok: true,
        class_info: {
          ...cls,
          current_week: 18,
          day_index: new Date().getDay() || 1
        },
        student_count: store.students.length,
        active_assignments: activeAssignments,
        active_assignments_count: activeAssignments.length,
        completed_assignments_count: completedCount,
        today_schedules: store.schedules.filter(s => s.day_index === (new Date().getDay() || 1)),
        week_schedules: store.schedules,
        structure_count: store.structure.length,
        cash_summary: {
          weekly_fee: weeklyFee,
          active_weeks_count: totalPayableWeeks,
          lunas_count: lunasCount,
          menunggak_count: menunggakCount,
          total_collected: totalPaidUnits * weeklyFee
        },
        bot_status: {
          online: true,
          uptime_seconds: 172800,
          vps_uptime_seconds: 864000,
          ram_used_percent: 28.4,
          rss_mb: 42.5
        }
      });
    }

    // 4. SISWA (CRUD)
    if (pathname === '/api/students') {
      if (method === 'GET') {
        let list = [...store.students];
        const q = (params.get('q') || '').toLowerCase().trim();
        const gender = (params.get('gender') || '').toUpperCase().trim();
        if (q) {
          list = list.filter(s => s.name.toLowerCase().includes(q) || s.phone_number.includes(q));
        }
        if (gender) {
          list = list.filter(s => s.gender === gender);
        }
        return mockResponse({ ok: true, count: list.length, students: list });
      }

      if (method === 'POST') {
        const newId = store.students.length ? Math.max(...store.students.map(s => s.id)) + 1 : 1;
        const newStudent = {
          id: newId,
          group_id: DEMO_GROUP_ID,
          name: body.name || 'Siswa Baru (Demo)',
          phone_number: body.phone_number || `08129000${String(newId).padStart(4, '0')}`,
          gender: (body.gender || 'L').toUpperCase()
        };
        store.students.push(newStudent);
        saveDemoStore(store);
        return mockResponse({ ok: true, student: newStudent }, 201);
      }
    }

    if (pathname.startsWith('/api/students/import') && method === 'POST') {
      const rawText = body.text || '';
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      let added = 0;
      let nextId = store.students.length ? Math.max(...store.students.map(s => s.id)) + 1 : 1;

      for (const line of lines) {
        const parts = line.split(/[,;\t]/).map(p => p.trim());
        const name = parts[0] || `Siswa Impor ${nextId}`;
        const phone = parts[1] || `08129000${String(nextId).padStart(4, '0')}`;
        const gender = (parts[2] || 'L').toUpperCase().startsWith('P') ? 'P' : 'L';
        store.students.push({
          id: nextId++,
          group_id: DEMO_GROUP_ID,
          name,
          phone_number: phone,
          gender
        });
        added++;
      }
      saveDemoStore(store);
      return mockResponse({ ok: true, count: added, message: `${added} siswa berhasil diimpor ke sandbox.` });
    }

    if (pathname.startsWith('/api/students/')) {
      const id = parseInt(pathname.split('/')[3], 10);
      const studentIdx = store.students.findIndex(s => s.id === id);

      if (studentIdx === -1) {
        return mockResponse({ ok: false, error: 'Siswa tidak ditemukan' }, 404);
      }

      if (method === 'PUT') {
        store.students[studentIdx] = {
          ...store.students[studentIdx],
          name: body.name !== undefined ? body.name : store.students[studentIdx].name,
          phone_number: body.phone_number !== undefined ? body.phone_number : store.students[studentIdx].phone_number,
          gender: body.gender !== undefined ? (body.gender || 'L').toUpperCase() : store.students[studentIdx].gender
        };
        saveDemoStore(store);
        return mockResponse({ ok: true, student: store.students[studentIdx] });
      }

      if (method === 'DELETE') {
        store.students.splice(studentIdx, 1);
        store.cash_payments = store.cash_payments.filter(p => p.student_id !== id);
        saveDemoStore(store);
        return mockResponse({ ok: true, deleted: true });
      }
    }

    // 5. JADWAL PELAJARAN (CRUD)
    if (pathname === '/api/schedules') {
      if (method === 'GET') {
        const weekNum = parseInt(params.get('week_number') || '18', 10);
        const dayIdx = params.get('day_index') ? parseInt(params.get('day_index'), 10) : null;
        let list = store.schedules.filter(s => s.week_number === weekNum);
        if (dayIdx !== null) {
          list = list.filter(s => s.day_index === dayIdx);
        }
        return mockResponse({ ok: true, week_number: weekNum, schedules: list });
      }

      if (method === 'POST') {
        const nextId = store.schedules.length ? Math.max(...store.schedules.map(s => s.id)) + 1 : 1;
        const newSchedule = {
          id: nextId,
          group_id: DEMO_GROUP_ID,
          week_number: parseInt(body.week_number || 18, 10),
          day_index: parseInt(body.day_index || 1, 10),
          subject: body.subject || 'Mata Pelajaran Baru',
          teacher: body.teacher || 'Guru Pengampu',
          room: body.room || 'R-101',
          time_start: body.time_start || '07:00',
          time_end: body.time_end || '08:30'
        };
        store.schedules.push(newSchedule);
        saveDemoStore(store);
        return mockResponse({ ok: true, schedule: newSchedule }, 201);
      }
    }

    if (pathname.startsWith('/api/schedules/')) {
      const id = parseInt(pathname.split('/')[3], 10);
      const schedIdx = store.schedules.findIndex(s => s.id === id);

      if (schedIdx === -1) {
        return mockResponse({ ok: false, error: 'Jadwal tidak ditemukan' }, 404);
      }

      if (method === 'PUT') {
        store.schedules[schedIdx] = {
          ...store.schedules[schedIdx],
          ...body,
          id
        };
        saveDemoStore(store);
        return mockResponse({ ok: true, schedule: store.schedules[schedIdx] });
      }

      if (method === 'DELETE') {
        store.schedules.splice(schedIdx, 1);
        saveDemoStore(store);
        return mockResponse({ ok: true, deleted: true });
      }
    }

    // 6. TUGAS & PR (CRUD)
    if (pathname === '/api/assignments') {
      if (method === 'GET') {
        const status = params.get('status');
        let list = [...store.assignments];
        if (status === 'active') list = list.filter(a => !a.is_completed);
        else if (status === 'completed') list = list.filter(a => a.is_completed);
        return mockResponse({ ok: true, count: list.length, assignments: list });
      }

      if (method === 'POST') {
        const nextId = store.assignments.length ? Math.max(...store.assignments.map(a => a.id)) + 1 : 1;
        const newAssignment = {
          id: nextId,
          group_id: DEMO_GROUP_ID,
          subject: body.subject || 'Mapel Umum',
          title: body.title || 'Tugas Baru',
          description: body.description || '',
          deadline: body.deadline || new Date().toISOString().split('T')[0] + ' 23:59',
          is_completed: 0
        };
        store.assignments.push(newAssignment);
        saveDemoStore(store);
        return mockResponse({ ok: true, assignment: newAssignment }, 201);
      }
    }

    if (pathname.startsWith('/api/assignments/')) {
      const parts = pathname.split('/');
      const id = parseInt(parts[3], 10);
      const assignIdx = store.assignments.findIndex(a => a.id === id);

      if (assignIdx === -1) {
        return mockResponse({ ok: false, error: 'Tugas tidak ditemukan' }, 404);
      }

      if (parts[4] === 'toggle' && (method === 'PATCH' || method === 'POST')) {
        store.assignments[assignIdx].is_completed = store.assignments[assignIdx].is_completed ? 0 : 1;
        saveDemoStore(store);
        return mockResponse({ ok: true, assignment: store.assignments[assignIdx] });
      }

      if (method === 'PUT') {
        store.assignments[assignIdx] = {
          ...store.assignments[assignIdx],
          ...body,
          id
        };
        saveDemoStore(store);
        return mockResponse({ ok: true, assignment: store.assignments[assignIdx] });
      }

      if (method === 'DELETE') {
        store.assignments.splice(assignIdx, 1);
        saveDemoStore(store);
        return mockResponse({ ok: true, deleted: true });
      }
    }

    // 7. STRUKTUR ORGANISASI (CRUD)
    if (pathname === '/api/structure') {
      if (method === 'GET') {
        return mockResponse({ ok: true, count: store.structure.length, structure: store.structure });
      }

      if (method === 'POST') {
        const nextId = store.structure.length ? Math.max(...store.structure.map(s => s.id)) + 1 : 1;
        const newMember = {
          id: nextId,
          group_id: DEMO_GROUP_ID,
          position_name: body.position_name || 'Anggota Pengurus',
          holder_name: body.holder_name || 'Nama Pengurus',
          phone_number: body.phone_number || '081290000000'
        };
        store.structure.push(newMember);
        saveDemoStore(store);
        return mockResponse({ ok: true, structure: newMember }, 201);
      }
    }

    if (pathname.startsWith('/api/structure/')) {
      const id = parseInt(pathname.split('/')[3], 10);
      const memIdx = store.structure.findIndex(s => s.id === id);

      if (memIdx === -1) {
        return mockResponse({ ok: false, error: 'Jabatan tidak ditemukan' }, 404);
      }

      if (method === 'PUT') {
        store.structure[memIdx] = {
          ...store.structure[memIdx],
          ...body,
          id
        };
        saveDemoStore(store);
        return mockResponse({ ok: true, structure: store.structure[memIdx] });
      }

      if (method === 'DELETE') {
        store.structure.splice(memIdx, 1);
        saveDemoStore(store);
        return mockResponse({ ok: true, deleted: true });
      }
    }

    // 8. KAS KELAS & REKAP
    if (pathname === '/api/cash/settings') {
      if (method === 'GET') {
        return mockResponse({ ok: true, settings: store.cash_settings });
      }
      if (method === 'POST') {
        if (body.weekly_fee !== undefined) store.cash_settings.weekly_fee = Number(body.weekly_fee);
        if (body.active_weeks_count !== undefined) store.cash_settings.active_weeks_count = Number(body.active_weeks_count);
        saveDemoStore(store);
        return mockResponse({ ok: true, settings: store.cash_settings });
      }
    }

    if (pathname === '/api/cash/holidays') {
      if (method === 'GET') {
        return mockResponse({ ok: true, holiday_weeks: store.cash_settings.holiday_weeks || [] });
      }
      if (method === 'POST') {
        const week = parseInt(body.week_number, 10);
        let list = store.cash_settings.holiday_weeks || [];
        const isHol = body.is_holiday === true || body.is_holiday === 'true' || body.is_holiday === 1;

        if (isHol) {
          if (!list.includes(week)) list.push(week);
        } else {
          list = list.filter(w => w !== week);
        }
        list.sort((a, b) => a - b);
        store.cash_settings.holiday_weeks = list;
        saveDemoStore(store);
        return mockResponse({ ok: true, holiday_weeks: list });
      }
    }

    if (pathname === '/api/cash/recap' && method === 'GET') {
      const weeklyFee = store.cash_settings.weekly_fee;
      const activeWeeks = store.cash_settings.active_weeks_count;
      const holidays = new Set(store.cash_settings.holiday_weeks || []);

      let totalPayableWeeks = 0;
      for (let w = 1; w <= activeWeeks; w++) {
        if (!holidays.has(w)) totalPayableWeeks++;
      }

      const recap = store.students.map(st => {
        const paidWeeksMap = {};
        let paidCount = 0;

        for (let w = 1; w <= activeWeeks; w++) {
          const isPaid = store.cash_payments.some(
            p => p.student_id === st.id && p.week_number === w && p.is_paid === 1
          );
          paidWeeksMap[w] = isPaid;
          if (isPaid && !holidays.has(w)) {
            paidCount++;
          }
        }

        const arrears = Math.max(0, totalPayableWeeks - paidCount);
        const arrearsAmount = arrears * weeklyFee;

        return {
          student_id: st.id,
          student_name: st.name,
          phone_number: st.phone_number,
          gender: st.gender,
          paid_weeks: paidWeeksMap,
          paid_weeks_count: paidCount,
          arrears_count: arrears,
          arrears_amount: arrearsAmount,
          is_lunas: arrears === 0
        };
      });

      return mockResponse({
        ok: true,
        weekly_fee: weeklyFee,
        active_weeks_count: activeWeeks,
        holiday_weeks: Array.from(holidays),
        total_payable_weeks: totalPayableWeeks,
        recap
      });
    }

    if (pathname === '/api/cash/payments' && method === 'POST') {
      const studentId = parseInt(body.student_id, 10);
      const weekNumber = parseInt(body.week_number, 10);
      const isPaid = body.is_paid ? 1 : 0;

      const idx = store.cash_payments.findIndex(
        p => p.student_id === studentId && p.week_number === weekNumber
      );

      if (idx !== -1) {
        store.cash_payments[idx].is_paid = isPaid;
      } else {
        store.cash_payments.push({
          student_id: studentId,
          week_number: weekNumber,
          is_paid: isPaid
        });
      }
      saveDemoStore(store);
      return mockResponse({ ok: true, student_id: studentId, week_number: weekNumber, is_paid: isPaid });
    }

    if (pathname === '/api/cash/import-checklist' && method === 'POST') {
      return mockResponse({ ok: true, message: 'Simulasi checklist kas berhasil diimpor.' });
    }

    // 9. KEUANGAN / FINANCE
    if (pathname === '/api/finance/transactions') {
      if (method === 'GET') {
        let totalIncome = 0;
        let totalExpense = 0;
        store.finance_transactions.forEach(t => {
          if (t.type === 'INCOME') totalIncome += Number(t.amount);
          else totalExpense += Number(t.amount);
        });
        return mockResponse({
          ok: true,
          summary: {
            total_income: totalIncome,
            total_expense: totalExpense,
            balance: totalIncome - totalExpense
          },
          transactions: store.finance_transactions
        });
      }

      if (method === 'POST') {
        const nextId = store.finance_transactions.length ? Math.max(...store.finance_transactions.map(t => t.id)) + 1 : 1;
        const newTx = {
          id: nextId,
          group_id: DEMO_GROUP_ID,
          type: (body.type || 'EXPENSE').toUpperCase(),
          amount: Number(body.amount || 0),
          category: body.category || 'LAINNYA',
          description: body.description || 'Transaksi Simulasi',
          transaction_date: body.transaction_date || new Date().toISOString().split('T')[0],
          receipt_url: null
        };
        store.finance_transactions.unshift(newTx);
        saveDemoStore(store);

        let totalIncome = 0;
        let totalExpense = 0;
        store.finance_transactions.forEach(t => {
          if (t.type === 'INCOME') totalIncome += Number(t.amount);
          else totalExpense += Number(t.amount);
        });

        return mockResponse({
          ok: true,
          transaction: newTx,
          summary: {
            total_income: totalIncome,
            total_expense: totalExpense,
            balance: totalIncome - totalExpense
          }
        }, 201);
      }
    }

    if (pathname.startsWith('/api/finance/transactions/')) {
      const id = parseInt(pathname.split('/')[4], 10);
      const txIdx = store.finance_transactions.findIndex(t => t.id === id);

      if (txIdx === -1) {
        return mockResponse({ ok: false, error: 'Transaksi tidak ditemukan' }, 404);
      }

      if (method === 'PUT') {
        store.finance_transactions[txIdx] = {
          ...store.finance_transactions[txIdx],
          ...body,
          id
        };
        saveDemoStore(store);
        return mockResponse({ ok: true, transaction: store.finance_transactions[txIdx] });
      }

      if (method === 'DELETE') {
        store.finance_transactions.splice(txIdx, 1);
        saveDemoStore(store);
        return mockResponse({ ok: true, deleted: true });
      }
    }

    // 10. SYSTEM & DEV-CONSOLE
    if (pathname === '/api/system/status' && method === 'GET') {
      return mockResponse({
        ok: true,
        online: true,
        uptime: '48 jam 12 menit',
        bot_version: '2.5.0 (Demo Mode)',
        platform: 'Client Browser Sandbox (Web API)',
        memory_usage: '42.8 MB',
        node_version: 'v22.5.0-sandbox',
        services: {
          database: 'SQLite In-Memory (localStorage Mock)',
          whatsapp_baileys: 'Simulated (Standby)',
          ai_gateway: 'Simulated (Ready)'
        }
      });
    }

    if (pathname.startsWith('/api/system/audit-logs') && method === 'GET') {
      return mockResponse({
        ok: true,
        logs: store.audit_logs
      });
    }

    if (pathname === '/api/system/sticker-limit') {
      if (method === 'GET') {
        return mockResponse({ ok: true, ...store.sticker_limit });
      }
      if (method === 'POST') {
        if (body.limit !== undefined) store.sticker_limit.limit = Number(body.limit);
        saveDemoStore(store);
        return mockResponse({ ok: true, ...store.sticker_limit });
      }
    }

    if (pathname === '/api/system/sticker-limit/reset' && method === 'POST') {
      store.sticker_limit.used = 0;
      saveDemoStore(store);
      return mockResponse({ ok: true, message: 'Limit stiker berhasil di-reset.', ...store.sticker_limit });
    }

    // 11. UTILITIES: AI & KALKULATOR
    if (pathname === '/api/utils/ai' && method === 'POST') {
      const prompt = body.prompt || body.message || '';
      return mockResponse({
        ok: true,
        response: `[Mode Demo Sandbox] Menjawab pertanyaan: "${prompt.slice(0, 50)}..."\n\nSistem Kastor-AI berjalan normal dalam lingkungan simulasi browser Anda. Data tidak disimpan ke server utama.`
      });
    }

    if (pathname === '/api/utils/calc' && method === 'POST') {
      const expr = body.expression || '';
      let result = 0;
      try {
        // Evaluasi matematika sederhana yang aman
        const clean = expr.replace(/[^0-9+\-*/().]/g, '');
        // eslint-disable-next-line no-eval
        result = Function(`'use strict'; return (${clean})`)();
      } catch {
        result = 'Format ekspresi tidak valid';
      }
      return mockResponse({ ok: true, result });
    }

    // Fallback generik untuk endpoint tak dikenal
    return mockResponse({ ok: true, message: `[DEMO MOCK] Endpoint ${method} ${pathname} berhasil disimulasikan.` });
  }

  // Intercept window.fetch di awal sebelum kode lain berjalan
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    let pathname = url;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        pathname = new URL(url).pathname;
      }
    } catch {}

    if (isDemoActive() && (pathname.startsWith('/api/') || pathname.startsWith('api/'))) {
      return handleDemoApi(url, init);
    }
    return originalFetch.apply(this, arguments);
  };

  /**
   * Render Top Banner Mode Demo
   */
  function renderDemoBanner() {
    if (!isDemoActive()) return;

    let banner = document.getElementById('demo-banner-container');
    if (!banner) {
      banner = document.createElement('aside');
      banner.id = 'demo-banner-container';
      banner.className = 'demo-banner-container';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Notifikasi Mode Demo');

      banner.innerHTML = `
        <div class="demo-banner-inner">
          <div class="demo-banner-left">
            <span class="demo-chip">MODE DEMO</span>
            <span class="demo-text">
              Sandbox terisolasi di browser. Perubahan tersimpan di <code>localStorage</code> &amp; tidak menyentuh database server asli.
            </span>
          </div>
          <div class="demo-banner-actions">
            <button type="button" id="btn-demo-reset" class="btn btn-sm btn-outline-demo" title="Reset data simulasi ke nilai default awal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              <span>Reset Data</span>
            </button>
            <button type="button" id="btn-demo-exit" class="btn btn-sm btn-danger-demo" title="Keluar dari mode demo dan kembali ke portal login">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Keluar Demo</span>
            </button>
          </div>
        </div>
      `;

      // Selipkan di awal main-wrapper atau app-shell
      const mainWrapper = document.querySelector('.main-wrapper') || document.getElementById('app-shell');
      if (mainWrapper) {
        mainWrapper.insertBefore(banner, mainWrapper.firstChild);
      } else {
        document.body.prepend(banner);
      }

      // Event listener tombol reset & keluar
      document.getElementById('btn-demo-reset')?.addEventListener('click', () => {
        if (confirm('Reset seluruh data demo ke kondisi awal (kembali ke 0)? Perubahan buatan Anda di browser akan dihapus.')) {
          resetDemoStore();
          if (window.showToast) {
            window.showToast('Data sandbox demo berhasil di-reset ke nilai default!', 'success');
          }
          setTimeout(() => {
            window.location.reload();
          }, 300);
        }
      });

      document.getElementById('btn-demo-exit')?.addEventListener('click', () => {
        exitDemoMode();
      });
    }
    banner.classList.remove('hidden');
  }

  // Inisialisasi saat script dimuat jika mengakses rute /demo
  if (isDemoActive()) {
    activateDemoMode();
  }

  // Pasang listener saat DOM siap
  document.addEventListener('DOMContentLoaded', () => {
    if (isDemoActive()) {
      renderDemoBanner();
    }
  });

  // Export API sandbox ke global window untuk debugging atau otomasi pengujian
  window.KastorDemoSandbox = {
    isActive: isDemoActive,
    activate: activateDemoMode,
    exit: exitDemoMode,
    getStore: getDemoStore,
    resetStore: resetDemoStore,
    saveStore: saveDemoStore
  };
})();
