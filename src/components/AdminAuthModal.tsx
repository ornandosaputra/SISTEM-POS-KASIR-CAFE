import { useEffect, useState } from 'react';
import { Delete, KeyRound, Lock, ShieldAlert, X } from 'lucide-react';
import {
  getRemainingLockoutSeconds,
  verifyAdminPinAttempt,
  type AdminLockoutState,
  type AdminSecurityConfig,
} from '../utils/adminAuth';

interface AdminAuthModalProps {
  open: boolean;
  reasonLabel: string;
  config: AdminSecurityConfig;
  lockout: AdminLockoutState;
  onUpdateLockout: (next: AdminLockoutState) => void;
  onSuccessUnlock: () => void;
  onClose: () => void;
}

export function AdminAuthModal({
  open,
  reasonLabel,
  config,
  lockout,
  onUpdateLockout,
  onSuccessUnlock,
  onClose,
}: AdminAuthModalProps) {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!open) {
      setPinInput('');
      setErrorMsg('');
      return;
    }
    setNowTick(Date.now());
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const remainingLockSecs = getRemainingLockoutSeconds(lockout, nowTick);
  const isLockedOut = remainingLockSecs > 0;

  const submitPin = (candidatePin: string) => {
    const result = verifyAdminPinAttempt(candidatePin, config, lockout, Date.now());
    onUpdateLockout(result.nextLockout);
    if (!result.ok) {
      setErrorMsg(result.error || 'Verifikasi PIN Admin gagal.');
      setPinInput('');
      return;
    }
    setPinInput('');
    setErrorMsg('');
    onSuccessUnlock();
  };

  const handlePinFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPin(pinInput);
  };

  const handleDigitPress = (digit: string) => {
    if (isLockedOut || pinInput.length >= 6) return;
    const nextPin = `${pinInput}${digit}`;
    setPinInput(nextPin);
    setErrorMsg('');
    if (nextPin.length === 6) {
      submitPin(nextPin);
    }
  };

  const handleBackspace = () => {
    if (isLockedOut) return;
    setPinInput((prev) => prev.slice(0, -1));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white dark:bg-[#181B20] border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FF9E67]/15 text-[#FF9E67] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="admin-auth-modal-title"
                className="text-[17px] font-bold text-[#1F1F1F] dark:text-neutral-100"
              >
                Verifikasi PIN Mode Admin
              </h2>
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {reasonLabel || 'Masukkan 6 digit PIN keamanan untuk membuka akses Administrator.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup verifikasi Admin"
            className="p-1.5 rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Demo PIN Banner Card */}
        <div className="rounded-2xl bg-[#FFF6F0] dark:bg-[#241E1A] border border-[#FF9E67]/30 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <KeyRound className="w-4 h-4 text-[#FF9E67] shrink-0" />
            <div className="text-[12px]">
              <span className="text-neutral-600 dark:text-neutral-300 font-medium">
                PIN Demo Admin:{' '}
              </span>
              <span className="font-mono font-bold text-[14px] tracking-wider text-[#1F1F1F] dark:text-white tabular-nums">
                {config.demoPin}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={isLockedOut}
            onClick={() => {
              setErrorMsg('');
              setPinInput(config.demoPin);
            }}
            className="px-3 py-1 rounded-xl bg-white dark:bg-[#181B20] border border-[#FF9E67]/40 hover:border-[#FF9E67] text-[11.5px] font-semibold text-[#FF9E67] transition-colors disabled:opacity-45 shrink-0 cursor-pointer"
          >
            Isi PIN
          </button>
        </div>

        {/* Lockout / Error Alert */}
        {(isLockedOut || errorMsg) && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-[12.5px] text-red-600 dark:text-red-400"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {isLockedOut ? (
                <p className="font-semibold tabular-nums">
                  Proteksi Keamanan Aktif — Akses dikunci sementara ({remainingLockSecs} detik tersisa).
                </p>
              ) : (
                <p className="font-medium">{errorMsg}</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handlePinFormSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-pin-input"
              className="block text-[12.5px] font-medium text-neutral-600 dark:text-neutral-300 mb-2 text-center"
            >
              Masukkan 6 digit PIN Administrator
            </label>

            {/* 6-slot visual mask */}
            <div className="flex items-center justify-center gap-2.5 mb-3" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((slot) => {
                const filled = slot < pinInput.length;
                return (
                  <div
                    key={slot}
                    className={`w-10 h-11 rounded-xl border flex items-center justify-center transition-colors ${
                      filled
                        ? 'border-[#FF9E67] bg-[#FF9E67]/10 text-[#FF9E67]'
                        : 'border-neutral-200 dark:border-neutral-700 bg-[#F8F8FA] dark:bg-[#22262E]'
                    }`}
                  >
                    {filled && <span className="w-2.5 h-2.5 rounded-full bg-[#FF9E67]" />}
                  </div>
                );
              })}
            </div>

            <input
              id="admin-pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              disabled={isLockedOut}
              value={pinInput}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPinInput(digitsOnly);
                setErrorMsg('');
              }}
              placeholder="Ketik 6 digit PIN"
              className="w-full px-4 py-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] border border-neutral-200 dark:border-neutral-700 text-center font-mono text-[15px] tracking-widest tabular-nums focus:outline-none focus:border-[#FF9E67] disabled:opacity-50"
            />
          </div>

          {/* Touch Numeric Keypad for POS Terminal */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={isLockedOut}
                onClick={() => handleDigitPress(digit)}
                className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] hover:bg-neutral-200/70 dark:hover:bg-neutral-700 text-[16px] font-bold text-[#1F1F1F] dark:text-neutral-100 tabular-nums transition-colors disabled:opacity-45 cursor-pointer"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              disabled={isLockedOut || pinInput.length === 0}
              onClick={() => setPinInput('')}
              className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] hover:bg-neutral-200/70 dark:hover:bg-neutral-700 text-[12px] font-semibold text-neutral-500 dark:text-neutral-300 transition-colors disabled:opacity-45 cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={isLockedOut}
              onClick={() => handleDigitPress('0')}
              className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] hover:bg-neutral-200/70 dark:hover:bg-neutral-700 text-[16px] font-bold text-[#1F1F1F] dark:text-neutral-100 tabular-nums transition-colors disabled:opacity-45 cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              disabled={isLockedOut || pinInput.length === 0}
              onClick={handleBackspace}
              aria-label="Hapus digit terakhir"
              className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#22262E] hover:bg-neutral-200/70 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition-colors disabled:opacity-45 cursor-pointer"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          <button
            type="submit"
            disabled={isLockedOut || pinInput.length !== 6}
            className="w-full py-3 px-5 rounded-full bg-[#FF9E67] hover:bg-[#f58d52] disabled:opacity-45 text-white text-[13.5px] font-semibold transition-colors cursor-pointer"
          >
            Buka Mode Admin
          </button>
        </form>

        <p className="text-[11.5px] text-center text-neutral-400">
          Karyawan/staf kasir tanpa PIN tidak dapat mengakses Mode Admin.
        </p>
      </div>
    </div>
  );
}
