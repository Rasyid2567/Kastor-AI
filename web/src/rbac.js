import { db } from '../../database/schema.js';

/**
 * Pemetaan Role Efektif: WAKIL memiliki hak akses yang setara dengan KETUA
 */
export function getEffectiveRole(role) {
  if (!role) return null;
  const r = String(role).toUpperCase().trim();
  if (r === 'WAKIL' || r === 'WAKIL KETUA') return 'KETUA';
  return r;
}

export const EFFECTIVE_ROLE = getEffectiveRole;

/**
 * Mendapatkan daftar izin & menu berdasarkan role untuk frontend dan API `/api/auth/me`
 */
export function getRolePermissions(role) {
  const eff = getEffectiveRole(role);

  const permissions = {
    role: role,
    effective_role: eff,
    can_switch_class: eff === 'DEVELOPER',
    can_view_system: eff === 'DEVELOPER',
    can_view_cash: eff === 'DEVELOPER' || eff === 'BENDAHARA' || eff === 'KETUA',
    can_edit_cash: eff === 'DEVELOPER' || eff === 'BENDAHARA',
    can_view_finance: eff === 'DEVELOPER' || eff === 'BENDAHARA' || eff === 'KETUA',
    can_edit_finance: eff === 'DEVELOPER' || eff === 'BENDAHARA',
    can_view_academic: ['DEVELOPER', 'KETUA', 'SEKRETARIS', 'BENDAHARA'].includes(eff),
    can_edit_academic: ['DEVELOPER', 'KETUA', 'SEKRETARIS'].includes(eff),
    can_edit_students: ['DEVELOPER', 'KETUA', 'SEKRETARIS'].includes(eff),
    can_edit_schedules: ['DEVELOPER', 'KETUA', 'SEKRETARIS'].includes(eff),
    can_edit_assignments: ['DEVELOPER', 'KETUA', 'SEKRETARIS'].includes(eff),
    can_edit_structure: ['DEVELOPER', 'KETUA', 'SEKRETARIS'].includes(eff),
    menus: ['overview', 'students', 'schedules', 'assignments', 'structure', 'ai_tools']
  };

  if (permissions.can_view_cash) {
    // Sisipkan menu cash setelah schedules/assignments
    permissions.menus.splice(3, 0, 'cash');
  }

  if (permissions.can_view_finance) {
    // Sisipkan menu finance setelah cash
    const cashIdx = permissions.menus.indexOf('cash');
    if (cashIdx >= 0) {
      permissions.menus.splice(cashIdx + 1, 0, 'finance');
    } else {
      permissions.menus.splice(3, 0, 'finance');
    }
  }

  if (permissions.can_view_system) {
    permissions.menus.push('system');
  }

  return permissions;
}

/**
 * Penegakan Isolasi Data Antar Kelas (Anti-IDOR)
 * Memeriksa apakah request mencoba mengakses `class_id` atau `group_id` milik kelas lain.
 */
export function enforceClassIsolation(session, reqUrl, reqBody = null) {
  if (!session) {
    return {
      allowed: false,
      status: 401,
      message: 'Sesi tidak ditemukan atau telah berakhir. Silakan login kembali.'
    };
  }

  const queryGroupId =
    reqUrl?.searchParams?.get('class_id') ||
    reqUrl?.searchParams?.get('group_id') ||
    null;

  const isLinkedGroupEndpoint = reqUrl?.pathname?.includes('/linked-groups');
  const bodyGroupId =
    (reqBody && typeof reqBody === 'object' 
      ? (isLinkedGroupEndpoint ? (reqBody.target_group_id || reqBody.class_id) : (reqBody.class_id || reqBody.group_id)) 
      : null) ||
    null;

  const requestedGroupId = queryGroupId || bodyGroupId;

  if (session.role !== 'DEVELOPER') {
    const lockedGroupId = session.group_id || session.active_group_id;
    if (requestedGroupId && requestedGroupId !== lockedGroupId) {
      return {
        allowed: false,
        status: 403,
        message: 'Akses ditolak: Anda tidak memiliki izin untuk mengakses data kelas lain.'
      };
    }

    return {
      allowed: true,
      targetGroupId: lockedGroupId
    };
  }

  // Untuk DEVELOPER:
  if (requestedGroupId) {
    const cls = db.prepare('SELECT group_id FROM classes WHERE group_id = ?').get(requestedGroupId);
    if (!cls) {
      return {
        allowed: false,
        status: 404,
        message: 'Kelas yang diminta tidak ditemukan.'
      };
    }
    return {
      allowed: true,
      targetGroupId: cls.group_id
    };
  }

  let targetGroupId = session.active_group_id;
  if (!targetGroupId) {
    const first = db.prepare('SELECT group_id FROM classes ORDER BY created_at ASC LIMIT 1').get();
    targetGroupId = first ? first.group_id : null;
  }

  return {
    allowed: true,
    targetGroupId
  };
}

/**
 * Cek izin akses endpoint berdasarkan Role & HTTP Method (Matriks RBAC PRD Bagian 3)
 */
export function checkEndpointPermission(session, pathname, method) {
  if (!session) {
    return {
      allowed: false,
      status: 401,
      message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.'
    };
  }

  const effRole = getEffectiveRole(session.role);
  const httpMethod = (method || 'GET').toUpperCase();
  const isReadMethod = httpMethod === 'GET' || httpMethod === 'HEAD';

  // 1. Class Switch: HANYA DEVELOPER
  if (pathname === '/api/classes/switch') {
    if (effRole !== 'DEVELOPER') {
      return {
        allowed: false,
        status: 403,
        message: 'Akses ditolak: Hanya Developer yang dapat berpindah kelas.'
      };
    }
    return { allowed: true };
  }

  // 2. System Status & Audit Logs: HANYA DEVELOPER
  if (pathname.startsWith('/api/system')) {
    if (effRole !== 'DEVELOPER') {
      return {
        allowed: false,
        status: 403,
        message: 'Akses ditolak: Konsol sistem hanya dapat diakses oleh Developer.'
      };
    }
    return { allowed: true };
  }

  // 3. Kas Kelas (/api/cash/*):
  // - SEKRETARIS: Dilarang total (403 baik GET maupun POST/PUT/DELETE)
  // - KETUA / WAKIL: Hanya boleh GET (Read-Only). POST/PUT/PATCH/DELETE -> 403
  // - BENDAHARA & DEVELOPER: Full Access (GET & POST/PUT/PATCH/DELETE)
  if (pathname.startsWith('/api/cash')) {
    if (effRole === 'SEKRETARIS') {
      return {
        allowed: false,
        status: 403,
        message: 'Akses ditolak: Sekretaris tidak memiliki hak akses ke modul Kas Kelas.'
      };
    }

    if (!isReadMethod && effRole !== 'BENDAHARA' && effRole !== 'DEVELOPER') {
      return {
        allowed: false,
        status: 403,
        message: 'Akses ditolak: Hanya Bendahara atau Developer yang dapat mengubah data kas kelas.'
      };
    }

    return { allowed: true };
  }

  // 3b. Keuangan & Buku Kas Kelas (/api/finance/*):
  // - SEKRETARIS: Dilarang total (403 baik GET maupun POST/PUT/DELETE)
  // - KETUA / WAKIL: Hanya boleh GET (Read-Only). POST/PUT/PATCH/DELETE -> 403
  // - BENDAHARA & DEVELOPER: Full Access (GET & POST/PUT/PATCH/DELETE)
  if (pathname.startsWith('/api/finance')) {
    if (effRole === 'SEKRETARIS') {
      return {
        allowed: false,
        status: 403,
        message: 'Akses ditolak: Sekretaris tidak memiliki hak akses ke modul Keuangan.'
      };
    }

    if (!isReadMethod && effRole !== 'BENDAHARA' && effRole !== 'DEVELOPER') {
      return {
        allowed: false,
        status: 403,
        message: 'Akses ditolak: Hanya Bendahara atau Developer yang dapat mengelola transaksi keuangan.'
      };
    }

    return { allowed: true };
  }

  // 4. Data Administrasi Akademik & Kelas (students, schedules, assignments, structure):
  // - GET: Semua role terautentikasi boleh melihat pada kelasnya
  // - POST / PUT / PATCH / DELETE: Hanya DEVELOPER, KETUA, WAKIL, SEKRETARIS. BENDAHARA -> 403!
  if (
    pathname.startsWith('/api/students') ||
    pathname.startsWith('/api/schedules') ||
    pathname.startsWith('/api/assignments') ||
    pathname.startsWith('/api/structure') ||
    pathname.startsWith('/api/classes/linked-groups')
  ) {
    if (!isReadMethod) {
      if (!['DEVELOPER', 'KETUA', 'SEKRETARIS'].includes(effRole)) {
        return {
          allowed: false,
          status: 403,
          message: 'Akses ditolak: Bendahara hanya memiliki akses lihat (read-only) untuk data administrasi akademik.'
        };
      }
    }
    return { allowed: true };
  }

  return { allowed: true };
}
