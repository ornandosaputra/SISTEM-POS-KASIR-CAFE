import { useState } from 'react';
import {
  Lock,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { RolePermissions, StaffMemberRecord, StaffRole } from '../types';
import {
  canDeleteStaffMember,
  getDefaultPermissionsForRole,
  validateStaffForm,
} from '../utils/posLogic';

const PERMISSION_COLUMNS: { key: keyof RolePermissions; label: string }[] = [
  { key: 'canCheckout', label: 'Kasir Checkout' },
  { key: 'canRefund', label: 'Void / Refund' },
  { key: 'canManageInventory', label: 'Kelola Inventaris' },
  { key: 'canViewAnalytics', label: 'Lihat Analitik' },
  { key: 'canManageUsers', label: 'Kelola Staf' },
  { key: 'canManageCloudApi', label: 'Cloud & API' },
];

interface MultiUserViewProps {
  staffList: StaffMemberRecord[];
  activeStaffId: string;
  isAdminUnlocked: boolean;
  onRequestUnlockAdmin: () => void;
  onSelectActiveStaff: (staffId: string) => void;
  onTogglePermission: (staffId: string, perm: keyof RolePermissions) => void;
  onAddStaff: (staff: Omit<StaffMemberRecord, 'id'>) => void;
  onUpdateStaff: (staffId: string, updates: Omit<StaffMemberRecord, 'id'>) => void;
  onDeleteStaff: (staffId: string) => void;
}

export function MultiUserView({
  staffList,
  activeStaffId,
  isAdminUnlocked,
  onRequestUnlockAdmin,
  onSelectActiveStaff,
  onTogglePermission,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
}: MultiUserViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Create form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('Cashier');
  const [shiftLabel, setShiftLabel] = useState('Shift Pagi (08:00 - 16:00)');
  const [createErrors, setCreateErrors] = useState<string[]>([]);

  // Edit modal state
  const [editingMember, setEditingMember] = useState<StaffMemberRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('Cashier');
  const [editShift, setEditShift] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [resetPermsToRolePreset, setResetPermsToRolePreset] = useState(false);
  const [editErrors, setEditErrors] = useState<string[]>([]);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<StaffMemberRecord | null>(null);

  if (!isAdminUnlocked) {
    return (
      <div className="p-6 sm:p-10 max-w-xl mx-auto">
        <div className="bg-white dark:bg-[#181B20] rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-[20px] font-bold text-neutral-900 dark:text-neutral-100">
            Manajemen Staf &amp; RBAC Dikunci
          </h1>
          <p className="text-[13.5px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Halaman pengelolaan akun karyawan dan matriks hak akses hanya dapat diakses oleh Administrator. Masukkan PIN atau akun Admin untuk melanjutkan.
          </p>
          <button
            type="button"
            onClick={onRequestUnlockAdmin}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13.5px] font-semibold cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>Buka Mode Admin</span>
          </button>
        </div>
      </div>
    );
  }

  const filteredStaff = staffList.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.staffRole.toLowerCase().includes(q) ||
      s.shiftLabel.toLowerCase().includes(q)
    );
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateStaffForm(
      {
        name,
        email,
        staffRole: role,
        shiftLabel,
        active: true,
      },
      staffList
    );

    if (!check.valid || !check.parsed) {
      setCreateErrors(check.errors);
      return;
    }

    const perms = getDefaultPermissionsForRole(check.parsed.staffRole);
    onAddStaff({
      ...check.parsed,
      ...perms,
    });
    setName('');
    setEmail('');
    setCreateErrors([]);
  };

  const openEditModal = (member: StaffMemberRecord) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditRole(member.staffRole);
    setEditShift(member.shiftLabel);
    setEditActive(member.active);
    setResetPermsToRolePreset(false);
    setEditErrors([]);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    const check = validateStaffForm(
      {
        name: editName,
        email: editEmail,
        staffRole: editRole,
        shiftLabel: editShift,
        active: editActive,
      },
      staffList,
      editingMember.id
    );

    if (!check.valid || !check.parsed) {
      setEditErrors(check.errors);
      return;
    }

    const roleChanged = check.parsed.staffRole !== editingMember.staffRole;
    const basePerms: RolePermissions =
      roleChanged || resetPermsToRolePreset
        ? getDefaultPermissionsForRole(check.parsed.staffRole)
        : {
            canCheckout: editingMember.canCheckout,
            canRefund: editingMember.canRefund,
            canManageInventory: editingMember.canManageInventory,
            canViewAnalytics: editingMember.canViewAnalytics,
            canManageUsers: check.parsed.staffRole === 'Admin' ? editingMember.canManageUsers : false,
            canManageCloudApi: editingMember.canManageCloudApi,
          };

    onUpdateStaff(editingMember.id, {
      ...check.parsed,
      ...basePerms,
    });
    setEditingMember(null);
    setEditErrors([]);
  };

  return (
    <div className="p-5 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[#1F1F1F] dark:text-neutral-100 tracking-tight">
            Manajemen CRUD Karyawan &amp; Matriks Hak Akses (RBAC)
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Tambah, edit, nonaktifkan, atau hapus akun staf kasir, manajer, dan gudang dari Mode Admin.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <label htmlFor="staff-search" className="sr-only">
            Cari nama atau email staf
          </label>
          <input
            id="staff-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, email, atau peran..."
            className="w-full pl-10 pr-4 py-2 rounded-full bg-white dark:bg-[#181B20] border border-neutral-200 dark:border-neutral-800 text-[13px] focus:outline-none focus:border-[#FF9E67]"
          />
        </div>
      </div>

      {/* Interactive Permission & CRUD Matrix */}
      <div className="bg-white dark:bg-[#181B20] rounded-2xl border border-neutral-200/70 dark:border-neutral-800 overflow-x-auto">
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF9E67]" />
            <h2 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
              Daftar Staf &amp; Matriks Izin ({filteredStaff.length})
            </h2>
          </div>
          <span className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium">
            Mode Admin Terverifikasi
          </span>
        </div>

        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 text-[11.5px]">
              <th className="py-3 px-5 font-medium">Nama Staf · Email · Shift</th>
              {PERMISSION_COLUMNS.map((col) => (
                <th key={col.key} className="py-3 px-2 font-medium text-center whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              <th className="py-3 px-5 font-medium text-right">Sesi &amp; CRUD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
            {filteredStaff.map((member) => {
              const isCurrent = member.id === activeStaffId;
              const deleteCheck = canDeleteStaffMember(staffList, member.id);
              return (
                <tr key={member.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30">
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {member.name}
                      {!member.active && (
                        <span className="ml-2 text-[11px] font-normal text-red-500">
                          (Nonaktif)
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-neutral-400">
                      <span>{member.email}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{member.staffRole}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{member.shiftLabel}</span>
                    </div>
                  </td>

                  {PERMISSION_COLUMNS.map((col) => {
                    const enabled = col.key === 'canManageUsers' && member.staffRole !== 'Admin'
                      ? false
                      : member[col.key];
                    const disableUserPermForNonAdmin =
                      col.key === 'canManageUsers' && member.staffRole !== 'Admin';
                    return (
                      <td key={col.key} className="py-3.5 px-2 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`${col.label} untuk ${member.name}`}
                          disabled={disableUserPermForNonAdmin}
                          onClick={() => onTogglePermission(member.id, col.key)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors inline-flex items-center disabled:opacity-35 cursor-pointer ${
                            enabled ? 'bg-[#FF9E67]' : 'bg-neutral-200 dark:bg-neutral-700'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                    );
                  })}

                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!member.active}
                        onClick={() => onSelectActiveStaff(member.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors disabled:opacity-40 cursor-pointer ${
                          isCurrent
                            ? 'bg-[#333333] text-white dark:bg-neutral-100 dark:text-neutral-900'
                            : 'border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-[#FF9E67]'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isCurrent ? 'Aktif' : 'Pakai'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(member)}
                        aria-label={`Edit staf ${member.name}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-[12px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#FF9E67] cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        disabled={!deleteCheck.allowed}
                        title={deleteCheck.reason || `Hapus staf ${member.name}`}
                        aria-label={`Hapus staf ${member.name}`}
                        onClick={() => setDeleteTarget(member)}
                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-600 hover:border-red-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add New Staff Member Form */}
      <form
        onSubmit={handleAdd}
        className="bg-white dark:bg-[#181B20] rounded-2xl p-6 border border-neutral-200/70 dark:border-neutral-800 space-y-4"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#FF9E67]" />
          <h2 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
            Tambah Akun Karyawan Baru
          </h2>
        </div>

        {createErrors.length > 0 && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-[12.5px] text-red-600 dark:text-red-400 space-y-1">
            {createErrors.map((err) => (
              <p key={err}>{err}</p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
          <div>
            <label htmlFor="staff-name" className="block font-medium mb-1">
              Nama Lengkap
            </label>
            <input
              id="staff-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rina Wulandari"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
            />
          </div>

          <div>
            <label htmlFor="staff-email" className="block font-medium mb-1">
              Email Kerja
            </label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rina@purrcoffee.id"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
            />
          </div>

          <div>
            <label htmlFor="staff-role" className="block font-medium mb-1">
              Peran Karyawan
            </label>
            <select
              id="staff-role"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
            >
              <option value="Cashier">Cashier (Kasir)</option>
              <option value="Manager">Manager (Supervisor)</option>
              <option value="Inventory">Inventory (Gudang)</option>
              <option value="Admin">Admin (Pemilik)</option>
            </select>
          </div>

          <div>
            <label htmlFor="staff-shift" className="block font-medium mb-1">
              Jadwal Shift
            </label>
            <input
              id="staff-shift"
              type="text"
              value={shiftLabel}
              onChange={(e) => setShiftLabel(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-6 py-2.5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13px] font-semibold cursor-pointer"
        >
          Tambahkan Karyawan
        </button>
      </form>

      {/* Edit Staff Modal */}
      {editingMember && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-staff-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setEditingMember(null)}
            aria-hidden="true"
          />
          <form
            onSubmit={handleEditSubmit}
            className="relative z-10 w-full max-w-md rounded-3xl bg-white dark:bg-[#1B1E24] border border-neutral-200 dark:border-neutral-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2
                id="edit-staff-modal-title"
                className="text-[17px] font-bold text-neutral-900 dark:text-neutral-100"
              >
                Edit Profil Karyawan
              </h2>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                aria-label="Tutup form edit staf"
                className="p-1.5 rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-[12px] text-red-600 dark:text-red-400 space-y-1">
                {editErrors.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            )}

            <div className="space-y-3 text-[13px]">
              <div>
                <label htmlFor="edit-staff-name" className="block font-medium mb-1">
                  Nama Lengkap
                </label>
                <input
                  id="edit-staff-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div>
                <label htmlFor="edit-staff-email" className="block font-medium mb-1">
                  Email Kerja
                </label>
                <input
                  id="edit-staff-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-staff-role" className="block font-medium mb-1">
                    Peran
                  </label>
                  <select
                    id="edit-staff-role"
                    value={editRole}
                    onChange={(e) => {
                      setEditRole(e.target.value as StaffRole);
                      setResetPermsToRolePreset(true);
                    }}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="Manager">Manager</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-staff-status" className="block font-medium mb-1">
                    Status Akun
                  </label>
                  <select
                    id="edit-staff-status"
                    value={editActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditActive(e.target.value === 'active')}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="edit-staff-shift" className="block font-medium mb-1">
                  Jadwal Shift
                </label>
                <input
                  id="edit-staff-shift"
                  type="text"
                  value={editShift}
                  onChange={(e) => setEditShift(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 rounded-full text-[13px] text-neutral-600 dark:text-neutral-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] text-white text-[13px] font-semibold cursor-pointer"
              >
                Simpan Perubahan Staf
              </button>
            </div>
          </form>
        </div>
      )}

      {/* In-App Delete Staff Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-staff-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setDeleteTarget(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white dark:bg-[#1B1E24] border border-neutral-200 dark:border-neutral-800 p-6 space-y-4 shadow-2xl">
            <h2
              id="delete-staff-modal-title"
              className="text-[17px] font-bold text-neutral-900 dark:text-neutral-100"
            >
              Hapus Akun Karyawan?
            </h2>
            <p className="text-[13px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Akun <strong>{deleteTarget.name}</strong> ({deleteTarget.staffRole} · {deleteTarget.email}) akan dihapus dari daftar operator kasir.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-700 text-[13px] font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteStaff(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold cursor-pointer"
              >
                Konfirmasi Hapus Staf
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
