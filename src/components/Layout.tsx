'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { t } from '@/lib/i18n';

const navItems = [
  { href: '/', key: 'dashboard', icon: '📊' },
  { href: '/schedule', key: 'schedule', icon: '📅' },
  { href: '/attendance', key: 'attendance', icon: '⏰' },
  { href: '/reports', key: 'reports', icon: '📋' },
  { href: '/settings', key: 'settings', icon: '⚙️' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale, isLoggedIn } = useApp();

  return (
    <div className="min-h-screen flex flex-col" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-blue-600">
            {t('appName', locale)}
          </Link>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${isLoggedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {isLoggedIn ? '✓' : '○'}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
        <div className="max-w-5xl mx-auto px-2">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors text-xs ${
                    isActive
                      ? 'text-blue-600 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{t(item.key, locale)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
