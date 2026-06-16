'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { db, getShiftsByMonth } from '@/lib/db';
import { t } from '@/lib/i18n';
import type { Shift } from '@/types';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getMonthDates(year: number, month: number) {
  const days = getDaysInMonth(year, month);
  const firstDay = new Date(year, month - 1, 1).getDay();
  return { days, firstDay };
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const monthAr = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const SHIFT_TYPES = [
  { key: 'night', label: 'nightShift', start: '20:00', end: '08:00', icon: '🌙' },
  { key: 'afternoon', label: 'afternoonShift', start: '13:30', end: '20:00', icon: '☀️' },
  { key: 'long', label: 'longShift', start: '08:00', end: '20:00', icon: '🔆' },
];

function matchesShiftType(s: Shift, type: typeof SHIFT_TYPES[0]) {
  return s.shiftStart === type.start && s.shiftEnd === type.end;
}

export default function SchedulePage() {
  const { locale, refreshShifts, defaultRate } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthShifts, setMonthShifts] = useState<Shift[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formStart, setFormStart] = useState('20:00');
  const [formEnd, setFormEnd] = useState('08:00');
  const [formRate, setFormRate] = useState(String(defaultRate));

  const loadShifts = useCallback(async () => {
    const shifts = await getShiftsByMonth(year, month);
    setMonthShifts(shifts);
  }, [year, month]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  useEffect(() => {
    setFormRate(String(defaultRate));
  }, [defaultRate]);

  function openEditForm(shift: Shift) {
    setFormDate(shift.date);
    setFormStart(shift.shiftStart);
    setFormEnd(shift.shiftEnd);
    setFormRate(String(shift.hourlyRate));
    setEditingShift(shift);
    setSelectedDate(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!formDate || !formStart || !formEnd || !formRate) return;
    const data = {
      date: formDate,
      shiftStart: formStart,
      shiftEnd: formEnd,
      hourlyRate: parseFloat(formRate),
    };
    if (editingShift) {
      await db.shifts.update(editingShift.id!, data);
    } else {
      await db.shifts.add(data);
    }
    setShowForm(false);
    setEditingShift(null);
    await loadShifts();
    await refreshShifts();
  }

  async function handleDelete(id: number) {
    if (!confirm(t('confirmDelete', locale))) return;
    await db.shifts.delete(id);
    const recs = await db.attendanceRecords.where('shiftId').equals(id).toArray();
    await db.attendanceRecords.bulkDelete(recs.map((r) => r.id!));
    await loadShifts();
    await refreshShifts();
  }

  async function quickAddShift(type: typeof SHIFT_TYPES[0], date: string) {
    const exists = monthShifts.some((s) => s.date === date && matchesShiftType(s, type));
    if (exists) return;
    await db.shifts.add({
      date,
      shiftStart: type.start,
      shiftEnd: type.end,
      hourlyRate: defaultRate,
    });
    await loadShifts();
    await refreshShifts();
  }

  const { days, firstDay } = getMonthDates(year, month);
  const shiftsByDate = new Map<string, Shift[]>();
  monthShifts.forEach((s) => {
    const list = shiftsByDate.get(s.date) || [];
    list.push(s);
    shiftsByDate.set(s.date, list);
  });

  const selectedShifts = selectedDate ? (shiftsByDate.get(selectedDate) || []) : [];

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else { setMonth(month - 1); }
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else { setMonth(month + 1); }
    setSelectedDate(null);
  }

  const dayNames = locale === 'ar'
    ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthNames = locale === 'ar' ? monthAr : months;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">{t('schedule', locale)}</h1>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="px-3 py-1.5 border-2 border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-100">‹</button>
          <div className="font-semibold text-slate-700">
            {monthNames[month - 1]} {year}
          </div>
          <button onClick={nextMonth} className="px-3 py-1.5 border-2 border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-100">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2">
          {dayNames.map((d) => (<div key={d}>{d}</div>))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayShifts = shiftsByDate.get(dateStr) || [];
            const isSelected = selectedDate === dateStr;
            return (
              <div
                key={day}
                className={`aspect-square rounded-lg border p-1 text-xs flex flex-col cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-100 border-blue-400'
                    : dayShifts.length > 0
                      ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                      : 'border-slate-100 hover:bg-slate-50'
                }`}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              >
                <span className="font-medium text-slate-600">{day}</span>
                {dayShifts.map((s) => (
                  <span key={s.id} className="text-[8px] text-blue-600 leading-tight truncate">
                    {s.shiftStart === '20:00' ? '🌙' : s.shiftStart === '08:00' ? '🔆' : s.shiftStart === '13:30' ? '☀️' : s.shiftStart}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-lg">{selectedDate}</h2>
              <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {SHIFT_TYPES.map((type) => {
                const exists = selectedShifts.some((s) => matchesShiftType(s, type));
                return (
                  <button
                    key={type.key}
                    onClick={() => quickAddShift(type, selectedDate)}
                    disabled={exists}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      exists
                        ? 'bg-emerald-50 border-emerald-300 opacity-60'
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50 active:scale-95'
                    }`}
                  >
                    <div className="text-2xl mb-1">{exists ? '✓' : type.icon}</div>
                    <div className="text-xs font-semibold text-slate-800">{t(type.label, locale)}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{type.start}→{type.end}</div>
                  </button>
                );
              })}
            </div>

            {selectedShifts.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                {selectedShifts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg p-2">
                    <span className="font-medium text-slate-700">
                      {s.shiftStart === '20:00' ? '🌙 ' : s.shiftStart === '08:00' ? '🔆 ' : s.shiftStart === '13:30' ? '☀️ ' : ''}
                      {s.shiftStart}→{s.shiftEnd} · {s.hourlyRate} EGP
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => openEditForm(s)} className="px-2 py-1 border border-slate-300 rounded hover:bg-slate-100">✏️</button>
                      <button onClick={() => s.id && handleDelete(s.id)} className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedDate && monthShifts.length === 0 && (
        <div className="card p-6 text-center text-slate-500">
          {t('noShifts', locale)}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-slate-800">{t('editShift', locale)}</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('date', locale)}</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('shiftStart', locale)}</label>
              <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('shiftEnd', locale)}</label>
              <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('hourlyRate', locale)}</label>
              <input type="number" value={formRate} onChange={(e) => setFormRate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm" min="0" step="0.5" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">{t('save', locale)}</button>
              <button onClick={() => { setShowForm(false); setEditingShift(null); }} className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100">{t('cancel', locale)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
