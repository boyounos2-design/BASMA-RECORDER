export interface Shift {
  id?: number;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  hourlyRate: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AttendanceRecord {
  id?: number;
  shiftId: number;
  date: string;
  actualTime: string;
  type: 'check-in' | 'check-out';
  deviceTimestamp: string;
  createdAt?: Date;
}

export interface Setting {
  id?: number;
  key: string;
  value: string;
}

export interface ReminderConfig {
  id?: number;
  type: 'check-in' | 'check-out';
  minutesBefore: number;
  enabled: boolean;
}

export interface DaySchedule {
  shift: Shift;
  checkIn?: AttendanceRecord;
  checkOut?: AttendanceRecord;
}

export interface DailyReport {
  date: string;
  shiftStart: string;
  shiftEnd: string;
  checkIn: string;
  checkOut: string;
  lateMinutes: number;
  earlyMinutes: number;
  missingMinutes: number;
  regularPaidMinutes: number;
  overtimeMinutes: number;
  totalPaidMinutes: number;
  hourlyRate: number;
  dailyPayment: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  totalShifts: number;
  totalRegularMinutes: number;
  totalOvertimeMinutes: number;
  totalMissingMinutes: number;
  totalPayment: number;
  dailyReports: DailyReport[];
}
