import {
  BarChart3,
  BookOpen,
  Boxes,
  Home,
  KeyRound,
  Lock,
  Moon,
  Receipt,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import type { NavSection } from '../types';

interface SidebarProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  ordersCount: number;
  lowStockCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  isAdminUnlocked: boolean;
  demoPin: string;
  canViewAnalytics: boolean;
  onRequestUnlockAdmin: () => void;
  onLockAdmin: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeNav,
  onSelectNav,
  ordersCount,
  lowStockCount,
  darkMode,
  onToggleDarkMode,
  isAdminUnlocked,
  demoPin,
  canViewAnalytics,
  onRequestUnlockAdmin,
  onLockAdmin,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const primaryItems: {
    id: NavSection;
    label: string;
    icon: typeof Home;
    badge?: number;
    badgeAlert?: boolean;
  }[] = [
    { id: 'pos', label: 'Home page', icon: Home },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Boxes,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeAlert: true,
    },
    { id: 'orders', label: 'My orders', icon: Receipt, badge: ordersCount },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const secondaryItems: { id: NavSection; label: string; icon: typeof Users }[] = [
    { id: 'users', label: 'Multi-User', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'api', label: 'API & Docs', icon: BookOpen },
  ];

  const handleSelect = (id: NavSection) => {
    onSelectNav(id);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#181B20] border-r border-neutral-100 dark:border-neutral-800/80 select-none">
      {/* Brand Wordmark matching Purr'Coffee reference */}
      <div className="flex items-center justify-between px-7 pt-7 pb-8">
        <button
          type="button"
          onClick={() => handleSelect('pos')}
          className="text-[22px] font-bold tracking-tight whitespace-nowrap shrink-0 text-left focus:outline-none"
        >
          <span className="text-[#FF9E67]">Purr&apos;</span>
          <span className="text-[#1F1F1F] dark:text-neutral-100">Coffee</span>
        </button>
        {mobileOpen && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Primary POS Nav */}
      <nav aria-label="Primary POS navigation" className="px-0 space-y-1">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.id;
          const isAnalyticsLocked =
            item.id === 'analytics' && !isAdminUnlocked && !canViewAnalytics;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`relative w-full flex items-center justify-between px-7 py-3 text-[14px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'text-[#FF9E67]'
                  : 'text-[#4B4B4B] dark:text-neutral-400 hover:text-[#1F1F1F] dark:hover:text-neutral-100'
              }`}
            >
              <span className="flex items-center gap-3.5">
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    active ? 'text-[#FF9E67]' : 'text-[#555555] dark:text-neutral-400'
                  }`}
                />
                <span>{item.label}</span>
              </span>

              {isAnalyticsLocked ? (
                <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden="true" />
              ) : (
                typeof item.badge === 'number' &&
                item.badge > 0 && (
                  <span
                    className={`tabular-nums text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      item.badgeAlert
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                        : 'bg-[#FF9E67] text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )
              )}

              {active && (
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-1.5 bottom-1.5 w-[3.5px] rounded-l-full bg-[#FF9E67]"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="my-5 mx-7 border-t border-neutral-100 dark:border-neutral-800" />

      {/* Secondary System Nav (Admin Restricted) */}
      <nav aria-label="Workspace and developer navigation" className="space-y-1">
        {secondaryItems.map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`relative w-full flex items-center justify-between px-7 py-3 text-[14px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'text-[#FF9E67]'
                  : 'text-[#4B4B4B] dark:text-neutral-400 hover:text-[#1F1F1F] dark:hover:text-neutral-100'
              }`}
            >
              <span className="flex items-center gap-3.5">
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    active ? 'text-[#FF9E67]' : 'text-[#555555] dark:text-neutral-400'
                  }`}
                />
                <span>{item.label}</span>
              </span>
              {!isAdminUnlocked && (
                <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden="true" />
              )}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-1.5 bottom-1.5 w-[3.5px] rounded-l-full bg-[#FF9E67]"
                />
              )}
            </button>
          );
        })}

        {/* Dark mode toggle integrated cleanly in sidebar */}
        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
          className="w-full flex items-center justify-between px-7 py-3 text-[14px] font-medium text-[#4B4B4B] dark:text-neutral-400 hover:text-[#1F1F1F] dark:hover:text-neutral-100 transition-colors whitespace-nowrap cursor-pointer"
        >
          <span className="flex items-center gap-3.5">
            <span className="w-6 h-6 rounded-full bg-[#FF9E67] text-white flex items-center justify-center shrink-0">
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </span>
            <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
          </span>
        </button>
      </nav>

      {/* Bottom PIN-Only Admin Security Gate + Demo PIN Display */}
      <div className="mt-auto px-5 pb-6 pt-4">
        {isAdminUnlocked ? (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="truncate">Mode Admin Aktif</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
              <span>PIN Demo:</span>
              <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">
                {demoPin}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onLockAdmin();
                onCloseMobile();
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#333333] hover:bg-neutral-800 text-white text-[12px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              Kunci Admin
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#FFF6F0] dark:bg-[#221D1A] border border-[#FF9E67]/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 font-medium">
                <KeyRound className="w-3.5 h-3.5 text-[#FF9E67] shrink-0" />
                <span>PIN Demo</span>
              </span>
              <span className="font-mono font-bold text-[13px] tracking-wider text-[#1F1F1F] dark:text-white tabular-nums">
                {demoPin}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                onRequestUnlockAdmin();
                onCloseMobile();
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#FF9E67] hover:bg-[#f58d52] text-white flex items-center justify-center gap-2 text-[12.5px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Buka Mode Admin</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[220px] xl:w-[232px] shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[264px] max-w-[82vw] h-full">{navContent}</div>
        </div>
      )}
    </>
  );
}
