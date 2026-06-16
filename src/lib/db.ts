import Dexie, { type Table } from 'dexie';
import type { Shift, AttendanceRecord, Setting, ReminderConfig } from '@/types';

class AttendanceDB extends Dexie {
  shifts!: Table<Shift, number>;
  attendanceRecords!: Table<AttendanceRecord, number>;
  settings!: Table<Setting, number>;
  reminderConfigs!: Table<ReminderConfig, number>;

  constructor() {
    super('BasmaAttendance');
    this.version(1).stores({
      shifts: '++id, date',
      attendanceRecords: '++id, shiftId, date, type',
      settings: '++id, key',
      reminderConfigs: '++id, type',
    });
  }
}

export const db = new AttendanceDB();

export async function getShiftsByMonth(year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return db.shifts
    .filter((s) => s.date.startsWith(prefix))
    .sortBy('date');
}

export async function getShiftsByDate(date: string) {
  return db.shifts.where('date').equals(date).toArray();
}

export async function getAttendanceByShiftId(shiftId: number) {
  return db.attendanceRecords
    .where('shiftId')
    .equals(shiftId)
    .toArray();
}

export async function getAttendanceByDate(date: string) {
  return db.attendanceRecords.where('date').equals(date).toArray();
}

export async function getAttendanceByMonth(year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return db.attendanceRecords
    .filter((r) => r.date.startsWith(prefix))
    .toArray();
}

export async function getSetting(key: string): Promise<string | null> {
  const setting = await db.settings.where('key').equals(key).first();
  return setting?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const existing = await db.settings.where('key').equals(key).first();
  if (existing) {
    await db.settings.update(existing.id!, { value });
  } else {
    await db.settings.add({ key, value });
  }
}

export async function exportAllData() {
  const shifts = await db.shifts.toArray();
  const records = await db.attendanceRecords.toArray();
  const settings = await db.settings.toArray();
  const reminders = await db.reminderConfigs.toArray();
  return JSON.stringify({ shifts, records, settings, reminders }, null, 2);
}

export async function importAllData(json: string) {
  const data = JSON.parse(json);
  await db.transaction('rw', db.shifts, db.attendanceRecords, db.settings, db.reminderConfigs, async () => {
    await db.shifts.clear();
    await db.attendanceRecords.clear();
    await db.settings.clear();
    await db.reminderConfigs.clear();
    if (data.shifts) await db.shifts.bulkAdd(data.shifts);
    if (data.records) await db.attendanceRecords.bulkAdd(data.records);
    if (data.settings) await db.settings.bulkAdd(data.settings);
    if (data.reminders) await db.reminderConfigs.bulkAdd(data.reminders);
  });
}
