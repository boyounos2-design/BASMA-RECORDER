import type { Shift, AttendanceRecord, DaySchedule, DailyReport, MonthlyReport } from '@/types';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function getDaySchedule(shift: Shift, records: AttendanceRecord[]): DaySchedule {
  return {
    shift,
    checkIn: records.find((r) => r.type === 'check-in'),
    checkOut: records.find((r) => r.type === 'check-out'),
  };
}

export function calculateDailyReport(daySchedule: DaySchedule): DailyReport {
  const { shift, checkIn, checkOut } = daySchedule;

  const shiftStartMin = timeToMinutes(shift.shiftStart);
  let shiftEndMin = timeToMinutes(shift.shiftEnd);
  if (shiftEndMin <= shiftStartMin) {
    shiftEndMin += 1440;
  }
  const scheduledDuration = shiftEndMin - shiftStartMin;

  const emptyReport: DailyReport = {
    date: shift.date,
    shiftStart: shift.shiftStart,
    shiftEnd: shift.shiftEnd,
    checkIn: '',
    checkOut: '',
    lateMinutes: 0,
    earlyMinutes: 0,
    missingMinutes: 0,
    regularPaidMinutes: 0,
    overtimeMinutes: 0,
    totalPaidMinutes: 0,
    hourlyRate: shift.hourlyRate,
    dailyPayment: 0,
  };

  if (!checkIn || !checkOut) return emptyReport;

  let checkInMin = timeToMinutes(checkIn.actualTime);
  let checkOutMin = timeToMinutes(checkOut.actualTime);

  if (checkOutMin <= checkInMin) {
    checkOutMin += 1440;
  }
  if (checkInMin < shiftStartMin && checkOutMin > shiftStartMin) {
    checkInMin += 1440;
    shiftEndMin += 1440;
  }

  const effectiveStart = Math.max(shiftStartMin, checkInMin);
  const effectiveEnd = checkOutMin;

  const overlapStart = Math.max(shiftStartMin, effectiveStart);
  const overlapEnd = Math.min(shiftEndMin, effectiveEnd);
  const regularPaidMinutes = Math.max(0, overlapEnd - overlapStart);

  const lateMinutes = Math.max(0, checkInMin - shiftStartMin);
  const earlyMinutes = Math.max(0, shiftEndMin - checkOutMin);
  const missingMinutes = Math.min(scheduledDuration, lateMinutes + earlyMinutes);
  const overtimeMinutes = Math.max(0, checkOutMin - shiftEndMin);
  const totalPaidMinutes = regularPaidMinutes + overtimeMinutes;
  const hourlyRate = shift.hourlyRate;
  const dailyPayment = minutesToDecimalHours(totalPaidMinutes) * hourlyRate;

  return {
    date: shift.date,
    shiftStart: shift.shiftStart,
    shiftEnd: shift.shiftEnd,
    checkIn: checkIn.actualTime,
    checkOut: checkOut.actualTime,
    lateMinutes,
    earlyMinutes,
    missingMinutes,
    regularPaidMinutes,
    overtimeMinutes,
    totalPaidMinutes,
    hourlyRate,
    dailyPayment: Math.round(dailyPayment * 100) / 100,
  };
}

export function calculateMonthlyReport(
  schedules: DaySchedule[],
): MonthlyReport {
  const dailyReports = schedules
    .map(calculateDailyReport)
    .filter((r) => r.totalPaidMinutes > 0);

  if (dailyReports.length === 0 && schedules.length === 0) {
    const firstShift = schedules[0]?.shift;
    return {
      year: 0,
      month: 0,
      totalShifts: 0,
      totalRegularMinutes: 0,
      totalOvertimeMinutes: 0,
      totalMissingMinutes: 0,
      totalPayment: 0,
      dailyReports: [],
    };
  }

  const year = parseInt(schedules[0]?.shift.date.slice(0, 4) || '0');
  const month = parseInt(schedules[0]?.shift.date.slice(5, 7) || '1');

  const totalRegularMinutes = dailyReports.reduce((s, r) => s + r.regularPaidMinutes, 0);
  const totalOvertimeMinutes = dailyReports.reduce((s, r) => s + r.overtimeMinutes, 0);
  const totalMissingMinutes = dailyReports.reduce((s, r) => s + r.missingMinutes, 0);
  const totalPayment = Math.round(dailyReports.reduce((s, r) => s + r.dailyPayment, 0) * 100) / 100;

  return {
    year,
    month,
    totalShifts: schedules.length,
    totalRegularMinutes,
    totalOvertimeMinutes,
    totalMissingMinutes,
    totalPayment,
    dailyReports,
  };
}

export { minutesToHours };
