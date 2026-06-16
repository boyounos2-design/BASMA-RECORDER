'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { db, getShiftsByDate } from '@/lib/db';
import { getDaySchedule, calculateDailyReport, minutesToHours } from '@/lib/calculations';
import { requestNotificationPermission } from '@/lib/notifications';
import { t } from '@/lib/i18n';
import type { Shift, AttendanceRecord } from '@/types';

export default function AttendancePage() {
  const { locale, isLoggedIn, login, logout, refreshRecords } = useApp();
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<number, AttendanceRecord[]>>({});
  const [message, setMessage] = useState('');
  const [monthHistory, setMonthHistory] = useState<any[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  function recordTime() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }

  async function refreshShifts() {
    const n = new Date();
    const d = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    const shifts = await getShiftsByDate(d);
    if (!mountedRef.current) return;
    setTodayShifts(shifts);
    const map: Record<number, AttendanceRecord[]> = {};
    for (const s of shifts) {
      map[s.id!] = await db.attendanceRecords.where('shiftId').equals(s.id!).toArray();
    }
    if (mountedRef.current) setAttendanceMap(map);
  }

  async function refreshHistory() {
    const n = new Date();
    const year = n.getFullYear();
    const month = String(n.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${month}`;
    const monthShifts = await db.shifts
      .filter((s) => s.date.startsWith(prefix))
      .sortBy('date');
    const monthRecords = await db.attendanceRecords
      .filter((r) => r.date.startsWith(prefix))
      .toArray();
    if (!mountedRef.current) return;
    const byDate: Record<string, typeof monthShifts> = {};
    for (const s of monthShifts) {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    }
    const sortedDates = Object.keys(byDate).sort().reverse();
    const history = sortedDates.map((date) => ({
      date,
      shifts: byDate[date].map((s) => {
        const recs = monthRecords.filter((r) => r.shiftId === s.id);
        return { ...s, checkIn: recs.find((r) => r.type === 'check-in'), checkOut: recs.find((r) => r.type === 'check-out') };
      }),
    }));
    if (mountedRef.current) setMonthHistory(history);
  }

  useEffect(() => {
    refreshShifts();
    refreshHistory();
    requestNotificationPermission();
  }, []);

  async function handleLogin() {
    await login();
    const n = new Date();
    const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    const current = recordTime();
    const shifts = await getShiftsByDate(today);
    const added: { shiftId: number; time: string }[] = [];
    for (const s of shifts) {
      const existing = await db.attendanceRecords.where('shiftId').equals(s.id!).filter((r) => r.type === 'check-in').first();
      if (!existing) {
        await db.attendanceRecords.add({
          shiftId: s.id!,
          date: today,
          actualTime: current,
          type: 'check-in',
          deviceTimestamp: new Date().toISOString(),
        });
        added.push({ shiftId: s.id!, time: current });
      }
    }
    if (added.length > 0 || shifts.length > 0) {
      setMonthHistory((prev) => {
        const prefix = today.slice(0, 7);
        const existing = prev.filter((d) => d.date.startsWith(prefix));
        const todayEntry = existing.find((d) => d.date === today);
        if (todayEntry) {
          todayEntry.shifts = todayEntry.shifts.map((s: any) => {
            const match = added.find((a) => a.shiftId === s.id);
            if (match && !s.checkIn) s.checkIn = { actualTime: match.time };
            return s;
          });
          return existing;
        }
        const newDay = {
          date: today,
          shifts: shifts.map((s) => {
            const match = added.find((a) => a.shiftId === s.id);
            return { ...s, checkIn: match ? { actualTime: match.time } : undefined, checkOut: undefined };
          }),
        };
        return [newDay, ...existing];
      });
    }
    await refreshShifts();
    await refreshRecords();
    setMessage(`${t('checkInRecorded', locale)}: ${current}${added.length > 1 ? ` (${added.length} shifts)` : ''}`);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleLogout() {
    const n = new Date();
    const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    const current = recordTime();
    const shifts = await getShiftsByDate(today);
    const added: { shiftId: number; time: string }[] = [];
    for (const s of shifts) {
      const checkIn = await db.attendanceRecords.where('shiftId').equals(s.id!).filter((r) => r.type === 'check-in').first();
      const existingOut = await db.attendanceRecords.where('shiftId').equals(s.id!).filter((r) => r.type === 'check-out').first();
      if (checkIn && !existingOut) {
        await db.attendanceRecords.add({
          shiftId: s.id!,
          date: today,
          actualTime: current,
          type: 'check-out',
          deviceTimestamp: new Date().toISOString(),
        });
        added.push({ shiftId: s.id!, time: current });
      }
    }
    if (added.length > 0 || shifts.length > 0) {
      setMonthHistory((prev) => {
        const prefix = today.slice(0, 7);
        const existing = prev.filter((d) => d.date.startsWith(prefix));
        const todayEntry = existing.find((d) => d.date === today);
        if (todayEntry) {
          todayEntry.shifts = todayEntry.shifts.map((s: any) => {
            const match = added.find((a) => a.shiftId === s.id);
            if (match && !s.checkOut) s.checkOut = { actualTime: match.time };
            return s;
          });
          return existing;
        }
        const newDay = {
          date: today,
          shifts: shifts.map((s) => {
            const match = added.find((a) => a.shiftId === s.id);
            return { ...s, checkIn: undefined, checkOut: match ? { actualTime: match.time } : undefined };
          }),
        };
        return [newDay, ...existing];
      });
    }
    await logout();
    await refreshShifts();
    await refreshRecords();
    setMessage(`${t('checkOutRecorded', locale)}: ${current}${added.length > 1 ? ` (${added.length} shifts)` : ''}`);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleClearHistory() {
    setClearing(true);
    try {
      const n = new Date();
      const prefix = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
      const end = `${prefix}\uffff`;
      await db.attendanceRecords.where('date').between(prefix, end).delete();
      setMonthHistory((prev) => prev.filter((d) => !d.date.startsWith(prefix)));
      await refreshRecords();
      setMessage(`${t('clearHistorySuccess', locale)}`);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage(`${t('error', locale)}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setShowClearConfirm(false);
      setClearing(false);
    }
  }

  const hasShifts = todayShifts.length > 0;
  const hasHistoryRecords = monthHistory.some((day) => day.shifts.some((s: any) => s.checkIn || s.checkOut));

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-800">{t('attendance', locale)}</h1>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-CA')}</p>
      </div>

      <div className="flex flex-col items-center gap-4 py-6">
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

        {!hasShifts && (
          <p className="text-sm text-slate-400">
            {t('noShifts', locale)} — <Link href="/schedule" className="text-blue-500 underline">{t('addShift', locale)}</Link>
          </p>
        )}
      </div>

      {hasShifts && (
        <div className="space-y-2">
          {todayShifts.map((shift) => {
            const shiftRecords = attendanceMap[shift.id!] || [];
            const checkInRecord = shiftRecords.find((r) => r.type === 'check-in');
            const checkOutRecord = shiftRecords.find((r) => r.type === 'check-out');
            const schedule = getDaySchedule(shift, shiftRecords);
            const report = calculateDailyReport(schedule);

            return (
              <div key={shift.id} className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">
                      {shift.shiftStart} → {shift.shiftEnd}
                    </div>
                    <div className="text-xs text-slate-500">
                      {shift.hourlyRate} {t('egp', locale)}/{t('hours', locale)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-lg border p-3 text-center ${checkInRecord ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-xs text-slate-500 mb-1">{t('checkIn', locale)}</div>
                    <div className="text-lg font-bold text-slate-700">
                      {checkInRecord ? checkInRecord.actualTime : '--:--'}
                    </div>
                  </div>
                  <div className={`rounded-lg border p-3 text-center ${checkOutRecord ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-xs text-slate-500 mb-1">{t('checkOut', locale)}</div>
                    <div className="text-lg font-bold text-slate-700">
                      {checkOutRecord ? checkOutRecord.actualTime : '--:--'}
                    </div>
                  </div>
                </div>

                {checkInRecord && checkOutRecord && (
                  <div className="text-xs space-y-1 bg-slate-50 rounded-lg p-3">
                    {report.lateMinutes > 0 && (
                      <div className="text-red-600">{t('lateBy', locale)} {minutesToHours(report.lateMinutes)}</div>
                    )}
                    {report.earlyMinutes > 0 && (
                      <div className="text-yellow-600">{t('earlyBy', locale)} {minutesToHours(report.earlyMinutes)}</div>
                    )}
                    <div className="text-emerald-600">{t('paidHours', locale)}: {minutesToHours(report.totalPaidMinutes)}</div>
                    <div className="text-blue-600 font-semibold">{report.dailyPayment} {t('egp', locale)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <hr className="border-t border-slate-200 my-4" />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-800">{t('thisMonthHistory', locale)}</h2>
          {hasHistoryRecords && !clearing && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
            >
              {t('clearHistory', locale)}
            </button>
          )}
          {clearing && (
            <span className="text-xs text-slate-400">{t('loading', locale)}...</span>
          )}
        </div>

        {showClearConfirm && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-sm">
            <p className="text-red-700 mb-2">{t('clearHistoryConfirm', locale)}</p>
            <div className="flex gap-2">
              <button onClick={handleClearHistory} className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600">{t('delete', locale)}</button>
              <button onClick={() => setShowClearConfirm(false)} className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-xs font-medium hover:bg-slate-300">{t('cancel', locale)}</button>
            </div>
          </div>
        )}

        {hasHistoryRecords ? (
          <div className="space-y-2">
            {monthHistory.map((day) => {
              const dayHasRecords = day.shifts.some((s: any) => s.checkIn || s.checkOut);
              return (
                <div key={day.date} className={`card p-3 space-y-1 ${!dayHasRecords ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 text-sm">{day.date}</span>
                  </div>
                  {day.shifts.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-xs text-slate-600 ml-2">
                      <span>
                        {s.shiftStart}→{s.shiftEnd}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={s.checkIn ? 'text-emerald-600' : 'text-red-400'}>
                          {t('checkIn', locale)}: {s.checkIn ? s.checkIn.actualTime : '--'}
                        </span>
                        <span className={s.checkOut ? 'text-emerald-600' : 'text-red-400'}>
                          {t('checkOut', locale)}: {s.checkOut ? s.checkOut.actualTime : '--'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-6">{t('noAttendance', locale)}</p>
        )}
      </div>
    </div>
  );
}
