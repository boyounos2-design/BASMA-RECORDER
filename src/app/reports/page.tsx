'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import { getDaySchedule, calculateMonthlyReport, minutesToHours } from '@/lib/calculations';
import { t } from '@/lib/i18n';
import type { DailyReport } from '@/types';

export default function ReportsPage() {
  const { locale, shifts, records } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<any>(null);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);

  const loadReport = useCallback(async () => {
    const monthShifts = await db.shifts
      .filter((s) => s.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
      .sortBy('date');
    const monthRecords = await db.attendanceRecords
      .filter((r) => r.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
      .toArray();
    const schedules = monthShifts.map((s) =>
      getDaySchedule(s, monthRecords.filter((r) => r.shiftId === s.id))
    );
    const r = calculateMonthlyReport(schedules);
    setReport(r);
    setDailyReports(r.dailyReports);
  }, [year, month]);

  useEffect(() => {
    loadReport();
  }, [loadReport, shifts, records]);

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else { setMonth(month - 1); }
  }

  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else { setMonth(month + 1); }
  }

  function exportPDF() {
    import('jspdf').then(({ default: JSPDF }) => {
      const doc = new JSPDF();
      const mName = `${year}-${String(month).padStart(2, '0')}`;
      doc.setFontSize(16);
      doc.text(`${t('monthlyReport', locale)} - ${mName}`, 14, 20);
      doc.setFontSize(12);
      let y = 35;
      doc.text(`${t('totalShifts', locale)}: ${report.totalShifts}`, 14, y); y += 8;
      doc.text(`${t('totalWorkingHours', locale)}: ${minutesToHours(report.totalRegularMinutes)}`, 14, y); y += 8;
      doc.text(`${t('totalOvertime', locale)}: ${minutesToHours(report.totalOvertimeMinutes)}`, 14, y); y += 8;
      doc.text(`${t('totalMissedHours', locale)}: ${minutesToHours(report.totalMissingMinutes)}`, 14, y); y += 8;
      doc.text(`${t('totalSalary', locale)}: ${report.totalPayment} ${t('egp', locale)}`, 14, y); y += 12;

      doc.setFontSize(10);
      dailyReports.forEach((r) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(`${r.date} | ${r.shiftStart}-${r.shiftEnd} | ${t('checkIn', locale)}:${r.checkIn || '--'} | ${t('checkOut', locale)}:${r.checkOut || '--'} | ${t('paidHours', locale)}:${minutesToHours(r.totalPaidMinutes)} | ${r.dailyPayment} ${t('egp', locale)}`, 14, y);
        y += 6;
      });
      doc.save(`attendance-${mName}.pdf`);
    });
  }

  function exportExcel() {
    import('xlsx').then((XLSX) => {
      const rows = dailyReports.map((r) => ({
        [t('date', locale)]: r.date,
        [t('shiftStart', locale)]: r.shiftStart,
        [t('shiftEnd', locale)]: r.shiftEnd,
        [t('checkIn', locale)]: r.checkIn || '--',
        [t('checkOut', locale)]: r.checkOut || '--',
        [t('lateBy', locale)]: minutesToHours(r.lateMinutes),
        [t('earlyBy', locale)]: minutesToHours(r.earlyMinutes),
        [t('paidHours', locale)]: minutesToHours(r.totalPaidMinutes),
        [t('overtimeHours', locale)]: minutesToHours(r.overtimeMinutes),
        [t('totalPayment', locale)]: `${r.dailyPayment} ${t('egp', locale)}`,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `attendance-${year}-${String(month).padStart(2, '0')}.xlsx`);
    });
  }

  const monthNames = locale === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">{t('reports', locale)}</h1>
        {report && report.totalShifts > 0 && (
          <div className="flex gap-2">
            <button onClick={exportPDF} className="px-3 py-1.5 border-2 border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-100">PDF</button>
            <button onClick={exportExcel} className="px-3 py-1.5 border-2 border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-100">Excel</button>
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="px-3 py-1.5 border-2 border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-100">‹</button>
          <div className="font-semibold text-slate-700">
            {monthNames[month - 1]} {year}
          </div>
          <button onClick={nextMonth} className="px-3 py-1.5 border-2 border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-100">›</button>
        </div>

        {report && report.totalShifts > 0 ? (
          <>
            <div className="grid grid-cols-5 gap-2 mb-4">
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{report.totalShifts}</div>
                <div className="text-[10px] text-slate-500">{t('totalShifts', locale)}</div>
              </div>
              <div className="text-center p-2 bg-emerald-50 rounded-lg">
                <div className="text-lg font-bold text-emerald-600">{minutesToHours(report.totalRegularMinutes)}</div>
                <div className="text-[10px] text-slate-500">{t('totalWorkingHours', locale)}</div>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded-lg">
                <div className="text-lg font-bold text-amber-600">{minutesToHours(report.totalOvertimeMinutes)}</div>
                <div className="text-[10px] text-slate-500">{t('totalOvertime', locale)}</div>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-600">{minutesToHours(report.totalMissingMinutes)}</div>
                <div className="text-[10px] text-slate-500">{t('totalMissedHours', locale)}</div>
              </div>
              <div className="text-center p-2 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">{report.totalPayment} {t('egp', locale)}</div>
                <div className="text-[10px] text-slate-500">{t('totalSalary', locale)}</div>
              </div>
            </div>

            <div className="space-y-1 max-h-96 overflow-y-auto">
              {dailyReports.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-700">{r.date}</span>
                    <span className="text-slate-400 mx-1">|</span>
                    <span className="text-slate-600">{r.shiftStart}-{r.shiftEnd}</span>
                  </div>
                  <div className="flex gap-3 text-slate-500 flex-shrink-0">
                    <span>{t('checkIn', locale)}: <b className={r.checkIn ? 'text-emerald-600' : 'text-red-400'}>{r.checkIn || '--'}</b></span>
                    <span>{t('checkOut', locale)}: <b className={r.checkOut ? 'text-emerald-600' : 'text-red-400'}>{r.checkOut || '--'}</b></span>
                    <span className="text-blue-600 font-medium">{minutesToHours(r.totalPaidMinutes)}</span>
                    <span className="text-purple-600 font-medium">{r.dailyPayment} {t('egp', locale)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-slate-500 py-6">{t('noData', locale)}</div>
        )}
      </div>
    </div>
  );
}
