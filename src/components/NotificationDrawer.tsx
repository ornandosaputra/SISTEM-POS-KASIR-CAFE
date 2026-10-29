import { AlertTriangle, Bell, CheckCheck, Cloud, CreditCard, X } from 'lucide-react';
import type { PushNotificationItem } from '../types';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: PushNotificationItem[];
  onMarkAllRead: () => void;
  browserPushEnabled: boolean;
  onEnableBrowserPush: () => void;
}

export function NotificationDrawer({
  open,
  onClose,
  notifications,
  onMarkAllRead,
  browserPushEnabled,
  onEnableBrowserPush,
}: NotificationDrawerProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-drawer-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-[380px] max-w-[92vw] h-full bg-white dark:bg-[#181B20] border-l border-neutral-200 dark:border-neutral-800 flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-[#FF9E67]" />
            <h2
              id="push-drawer-title"
              className="text-[16px] font-bold text-neutral-900 dark:text-neutral-100"
            >
              Notifikasi Push Real-Time
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onMarkAllRead}
              aria-label="Tandai semua sudah dibaca"
              className="p-2 rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pusat notifikasi"
              className="p-2 rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-[#F8F8FA] dark:bg-[#22262E] border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2 text-[12px]">
          <span className="text-neutral-600 dark:text-neutral-300">
            Notifikasi Desktop / Perangkat
          </span>
          <button
            type="button"
            onClick={onEnableBrowserPush}
            className="font-semibold text-[#FF9E67] hover:underline cursor-pointer"
          >
            {browserPushEnabled ? 'Aktif' : 'Izinkan Push'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-neutral-400">
              Belum ada notifikasi terbaru.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`px-6 py-4 flex items-start gap-3 ${
                  !item.read ? 'bg-[#FF9E67]/5' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    item.type === 'low_stock'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : item.type === 'transaction'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {item.type === 'low_stock' ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : item.type === 'transaction' ? (
                    <CreditCard className="w-4 h-4" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-neutral-900 dark:text-neutral-100">
                    {item.title}
                  </p>
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                    {item.message}
                  </p>
                  <span className="text-[11px] text-neutral-400 mt-1 block tabular-nums">
                    {new Date(item.createdAtMs).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
