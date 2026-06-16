'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { db, getShiftsByDate } from '@/lib/db';
import { getDaySchedule, calculateMonthlyReport, minutesToHours } from '@/lib/calculations';
import { t } from '@/lib/i18n';

function recordTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { locale, isLoggedIn, login, logout, shifts, records, refreshShifts, refreshRecords } = useApp();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTime = recordTime();

  const [monthly, setMonthly] = useState<any>(null);
  const [todayShifts, setTodayShifts] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthShifts = await db.shifts
        .filter((s) => s.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
        .sortBy('date');
      const monthRecords = await db.attendanceRecords
        .filter((r) => r.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
        .toArray();
      const schedules = monthShifts.map((s) =>
        getDaySchedule(s, monthRecords.filter((r) => r.shiftId === s.id))
      );
      setMonthly(calculateMonthlyReport(schedules));

      const todayScheduled = await getShiftsByDate(today);
      const todayAtt = monthRecords.filter((r) => r.date === today);
      setTodayShifts(todayScheduled.map((s) => ({
        ...s,
        checkIn: todayAtt.find((r) => r.shiftId === s.id && r.type === 'check-in'),
        checkOut: todayAtt.find((r) => r.shiftId === s.id && r.type === 'check-out'),
      })));
    }
    load();
  }, [shifts, records, today, now]);

  async function handleLogin() {
    await login();
    const current = recordTime();
    const todayScheduled = await getShiftsByDate(today);
    let count = 0;
    for (const s of todayScheduled) {
      const existing = await db.attendanceRecords
        .where('shiftId').equals(s.id!)
        .and((r) => r.type === 'check-in')
        .first();
      if (!existing) {
        await db.attendanceRecords.add({
          shiftId: s.id!,
          date: today,
          actualTime: current,
          type: 'check-in',
          deviceTimestamp: new Date().toISOString(),
        });
        count++;
      }
    }
    await refreshRecords();
    setMessage(`${t('checkInRecorded', locale)}: ${current}${count > 1 ? ` (${count} shifts)` : ''}`);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleLogout() {
    const current = recordTime();
    const todayScheduled = await getShiftsByDate(today);
    let count = 0;
    for (const s of todayScheduled) {
      const checkIn = await db.attendanceRecords
        .where('shiftId').equals(s.id!)
        .and((r) => r.type === 'check-in')
        .first();
      const existingOut = await db.attendanceRecords
        .where('shiftId').equals(s.id!)
        .and((r) => r.type === 'check-out')
        .first();
      if (checkIn && !existingOut) {
        await db.attendanceRecords.add({
          shiftId: s.id!,
          date: today,
          actualTime: current,
          type: 'check-out',
          deviceTimestamp: new Date().toISOString(),
        });
        count++;
      }
    }
    await logout();
    await refreshRecords();
    setMessage(`${t('checkOutRecorded', locale)}: ${current}${count > 1 ? ` (${count} shifts)` : ''}`);
    setTimeout(() => setMessage(''), 3000);
  }

  const hasTodayShifts = todayShifts.length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('homeWelcome', locale)}</h1>
        <p className="text-slate-500 mt-1">{t('homeDesc', locale)}</p>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        {!isLoggedIn ? (
          <button
            onClick={handleLogin}
            className="w-48 h-48 rounded-full bg-blue-500 text-white text-2xl font-bold shadow-lg hover:bg-blue-600 active:bg-blue-700 transition-all active:scale-95 flex items-center justify-center"
          >
            {t('login', locale)}
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="w-48 h-48 rounded-full bg-red-500 text-white text-2xl font-bold shadow-lg hover:bg-red-600 active:bg-red-700 transition-all active:scale-95 flex items-center justify-center"
          >
            {t('logout', locale)}
          </button>
        )}

        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium">
            {message}
          </div>
        )}

        {!hasTodayShifts && (
          <p className="text-sm text-slate-400">
            {t('noShifts', locale)} — <Link href="/schedule" className="text-blue-500 underline">{t('addShift', locale)}</Link>
          </p>
        )}
      </div>

      {hasTodayShifts && (
        <div className="card p-4">
          <h2 className="font-semibold text-slate-700 mb-3">{t('today', locale)} — {today}</h2>
          <div className="space-y-2">
            {todayShifts.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg p-2">
                <span className="text-slate-700">{s.shiftStart} → {s.shiftEnd}</span>
                <div className="flex gap-3 text-xs">
                  <span className={s.checkIn ? 'text-emerald-600 font-medium' : 'text-slate-300'}>
                    {t('checkIn', locale)}: {s.checkIn?.actualTime || '--'}
                  </span>
                  <span className={s.checkOut ? 'text-red-500 font-medium' : 'text-slate-300'}>
                    {t('checkOut', locale)}: {s.checkOut?.actualTime || '--'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl mb-1">📅</div>
          <div className="text-2xl font-bold text-blue-600">{monthly?.totalShifts ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">{t('shiftsThisMonth', locale)}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl mb-1">⏱️</div>
          <div className="text-2xl font-bold text-emerald-600">{minutesToHours(monthly?.totalRegularMinutes ?? 0)}</div>
          <div className="text-xs text-slate-500 mt-1">{t('workedHoursThisMonth', locale)}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl mb-1">💰</div>
          <div className="text-2xl font-bold text-amber-600">{monthly?.totalPayment ?? 0} {t('egp', locale)}</div>
          <div className="text-xs text-slate-500 mt-1">{t('earnedThisMonth', locale)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/schedule" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <span className="text-3xl">📅</span>
          <div>
            <div className="font-semibold text-slate-800">{t('schedule', locale)}</div>
            <div className="text-xs text-slate-500">{t('addShift', locale)}</div>
          </div>
        </Link>
        <Link href="/attendance" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <span className="text-3xl">⏰</span>
          <div>
            <div className="font-semibold text-slate-800">{t('attendance', locale)}</div>
            <div className="text-xs text-slate-500">{t('attendance', locale)}</div>
          </div>
        </Link>
        <Link href="/reports" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <span className="text-3xl">📋</span>
          <div>
            <div className="font-semibold text-slate-800">{t('reports', locale)}</div>
            <div className="text-xs text-slate-500">{t('monthlyReport', locale)}</div>
          </div>
        </Link>
        <Link href="/settings" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <span className="text-3xl">⚙️</span>
          <div>
            <div className="font-semibold text-slate-800">{t('settings', locale)}</div>
            <div className="text-xs text-slate-500">{t('language', locale)}</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
