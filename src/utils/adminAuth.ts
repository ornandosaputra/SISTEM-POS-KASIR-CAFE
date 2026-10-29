import type { NavSection, StaffMemberRecord } from '../types';
import { hasPermission } from './posLogic';

export const MAX_ADMIN_ATTEMPTS = 3;
export const ADMIN_LOCKOUT_DURATION_MS = 30_000;
export const ADMIN_CONFIG_STORAGE_KEY = 'purrcoffee_admin_security_v1';

export const OWNER_BOOTSTRAP_EMAIL = 'ornandosaputra0@gmail.com';
export const DEFAULT_ADMIN_EMAIL = 'purrcof@gmail.com';
export const DEFAULT_ADMIN_PIN = '123456';
export const DEFAULT_ADMIN_PASSWORD = 'Admin123!';

export interface AdminSecurityConfig {
  email: string;
  pinHash: string;
  passwordHash: string;
  demoPin: string;
  updatedAtMs: number;
}

export interface AdminLockoutState {
  failedAttempts: number;
  lockedUntilMs: number;
}

export interface AuthAttemptResult {
  ok: boolean;
  error?: string;
  nextLockout: AdminLockoutState;
}

/**
 * Deterministic FNV-1a + round-mixed digest for synchronous PIN verification
 * across both browser runtime and Node unit tests.
 */
export function hashSecret(raw: string): string {
  const salted = `purrcoffee_pos_v1::${raw}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i & 0xff);
    h2 = Math.imul(h2, 0x5bd1e995);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `h1_${part1}${part2}`;
}

export function createDefaultAdminSecurityConfig(nowMs: number = 0): AdminSecurityConfig {
  return {
    email: DEFAULT_ADMIN_EMAIL,
    pinHash: hashSecret(DEFAULT_ADMIN_PIN),
    passwordHash: hashSecret(DEFAULT_ADMIN_PASSWORD),
    demoPin: DEFAULT_ADMIN_PIN,
    updatedAtMs: nowMs,
  };
}

export function loadAdminSecurityConfig(): AdminSecurityConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultAdminSecurityConfig();
  }
  try {
    const raw = window.localStorage.getItem(ADMIN_CONFIG_STORAGE_KEY);
    if (!raw) return createDefaultAdminSecurityConfig();
    const parsed = JSON.parse(raw) as Partial<AdminSecurityConfig>;
    if (typeof parsed.pinHash === 'string') {
      const validDemoPin =
        typeof parsed.demoPin === 'string' && /^\d{6}$/.test(parsed.demoPin)
          ? parsed.demoPin
          : DEFAULT_ADMIN_PIN;
      return {
        email:
          typeof parsed.email === 'string' && parsed.email.trim()
            ? parsed.email.trim().toLowerCase()
            : DEFAULT_ADMIN_EMAIL,
        pinHash: parsed.pinHash,
        passwordHash:
          typeof parsed.passwordHash === 'string'
            ? parsed.passwordHash
            : hashSecret(DEFAULT_ADMIN_PASSWORD),
        demoPin: validDemoPin,
        updatedAtMs: Number(parsed.updatedAtMs) || Date.now(),
      };
    }
  } catch {
    // Fallback to default security config if corrupted
  }
  return createDefaultAdminSecurityConfig();
}

export function saveAdminSecurityConfig(config: AdminSecurityConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ADMIN_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota restrictions
  }
}

export function getRemainingLockoutSeconds(
  lockout: AdminLockoutState,
  nowMs: number = Date.now()
): number {
  if (lockout.lockedUntilMs <= nowMs) return 0;
  return Math.max(1, Math.ceil((lockout.lockedUntilMs - nowMs) / 1000));
}

function registerFailure(
  lockout: AdminLockoutState,
  nowMs: number,
  reason: string
): AuthAttemptResult {
  const baseFailures =
    lockout.lockedUntilMs > 0 && lockout.lockedUntilMs <= nowMs ? 0 : lockout.failedAttempts;
  const nextFailures = baseFailures + 1;

  if (nextFailures >= MAX_ADMIN_ATTEMPTS) {
    const lockedUntilMs = nowMs + ADMIN_LOCKOUT_DURATION_MS;
    const secs = Math.ceil(ADMIN_LOCKOUT_DURATION_MS / 1000);
    return {
      ok: false,
      error: `${reason} Percobaan gagal ${MAX_ADMIN_ATTEMPTS}x — akses dikunci selama ${secs} detik.`,
      nextLockout: {
        failedAttempts: nextFailures,
        lockedUntilMs,
      },
    };
  }

  const remaining = MAX_ADMIN_ATTEMPTS - nextFailures;
  return {
    ok: false,
    error: `${reason} Sisa ${remaining} percobaan sebelum dikunci sementara.`,
    nextLockout: {
      failedAttempts: nextFailures,
      lockedUntilMs: 0,
    },
  };
}

export function verifyAdminPinAttempt(
  pinInput: string,
  config: AdminSecurityConfig,
  lockout: AdminLockoutState,
  nowMs: number = Date.now()
): AuthAttemptResult {
  const waitSecs = getRemainingLockoutSeconds(lockout, nowMs);
  if (waitSecs > 0) {
    return {
      ok: false,
      error: `Akses dikunci sementara karena percobaan gagal beruntun. Coba lagi dalam ${waitSecs} detik.`,
      nextLockout: lockout,
    };
  }

  const cleaned = pinInput.trim();
  if (!/^\d{6}$/.test(cleaned)) {
    return {
      ok: false,
      error: 'PIN Admin wajib terdiri dari 6 digit angka.',
      nextLockout: lockout,
    };
  }

  if (hashSecret(cleaned) !== config.pinHash) {
    return registerFailure(lockout, nowMs, 'PIN Admin tidak sesuai.');
  }

  return {
    ok: true,
    nextLockout: { failedAttempts: 0, lockedUntilMs: 0 },
  };
}

export function canSwitchStaffWithoutAuth(
  targetStaff: StaffMemberRecord,
  isAdminUnlocked: boolean
): { allowed: boolean; requiresAdminAuth: boolean } {
  if (!targetStaff.active) {
    return { allowed: false, requiresAdminAuth: false };
  }
  if (targetStaff.staffRole === 'Admin' && !isAdminUnlocked) {
    return { allowed: false, requiresAdminAuth: true };
  }
  return { allowed: true, requiresAdminAuth: false };
}

export function canAccessNavSection(
  section: NavSection,
  activeStaff: StaffMemberRecord,
  isAdminUnlocked: boolean
): boolean {
  if (isAdminUnlocked && activeStaff.staffRole === 'Admin') {
    return true;
  }

  switch (section) {
    case 'pos':
    case 'orders':
      return true;
    case 'inventory':
      // Staff can open Inventory view (read-only for Cashier, restock for Inventory),
      // while Master Product CRUD (Add/Edit/Delete SKU) strictly requires PIN Mode Admin
      return true;
    case 'analytics':
      return isAdminUnlocked || hasPermission(activeStaff, 'canViewAnalytics');
    case 'users':
    case 'settings':
    case 'api':
      // Strictly restricted to PIN-authenticated Admin Mode
      return isAdminUnlocked;
    default:
      return false;
  }
}

export function validateNewAdminPin(input: {
  currentPin: string;
  newPin: string;
  confirmPin: string;
  currentConfig: AdminSecurityConfig;
}): { valid: boolean; error?: string; updatedConfig?: AdminSecurityConfig } {
  const currentCleaned = input.currentPin.trim();
  if (hashSecret(currentCleaned) !== input.currentConfig.pinHash) {
    return {
      valid: false,
      error: 'PIN Admin saat ini tidak sesuai.',
    };
  }

  const nextPin = input.newPin.trim();
  if (!/^\d{6}$/.test(nextPin)) {
    return {
      valid: false,
      error: 'PIN Admin baru wajib terdiri dari tepat 6 digit angka.',
    };
  }

  if (nextPin !== input.confirmPin.trim()) {
    return {
      valid: false,
      error: 'Konfirmasi PIN baru tidak cocok.',
    };
  }

  return {
    valid: true,
    updatedConfig: {
      ...input.currentConfig,
      pinHash: hashSecret(nextPin),
      demoPin: nextPin,
      updatedAtMs: Date.now(),
    },
  };
}
