'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Shift, AttendanceRecord } from '@/types';
import { db, getSetting, setSetting } from '@/lib/db';
import type { Locale } from '@/lib/i18n';

interface AppContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  shifts: Shift[];
  records: AttendanceRecord[];
  refreshShifts: () => Promise<void>;
  refreshRecords: () => Promise<void>;
  overtimeMultiplier: number;
  setOvertimeMultiplier: (v: number) => void;
  reminderCheckIn: number;
  setReminderCheckIn: (v: number) => void;
  reminderCheckOut: number;
  setReminderCheckOut: (v: number) => void;
  remindersEnabled: boolean;
  setRemindersEnabled: (v: boolean) => void;
  isLoggedIn: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  defaultRate: number;
  setDefaultRate: (v: number) => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  locale: 'en',
  setLocale: () => {},
  shifts: [],
  records: [],
  refreshShifts: async () => {},
  refreshRecords: async () => {},
  overtimeMultiplier: 1.5,
  setOvertimeMultiplier: () => {},
  reminderCheckIn: 30,
  setReminderCheckIn: () => {},
  reminderCheckOut: 15,
  setReminderCheckOut: () => {},
  remindersEnabled: true,
  setRemindersEnabled: () => {},
  isLoggedIn: false,
  login: async () => {},
  logout: async () => {},
  defaultRate: 110,
  setDefaultRate: async () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [overtimeMultiplier, setOvertimeMultiplierState] = useState(1.5);
  const [reminderCheckIn, setReminderCheckInState] = useState(30);
  const [reminderCheckOut, setReminderCheckOutState] = useState(15);
  const [remindersEnabled, setRemindersEnabledState] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [defaultRate, setDefaultRateState] = useState(110);

  useEffect(() => {
    getSetting('locale').then((v) => {
      if (v === 'ar' || v === 'en') setLocaleState(v);
    });
    getSetting('overtimeMultiplier').then((v) => {
      if (v) setOvertimeMultiplierState(parseFloat(v));
    });
    getSetting('reminderCheckIn').then((v) => {
      if (v) setReminderCheckInState(parseInt(v));
    });
    getSetting('reminderCheckOut').then((v) => {
      if (v) setReminderCheckOutState(parseInt(v));
    });
    getSetting('remindersEnabled').then((v) => {
      if (v) setRemindersEnabledState(v === 'true');
    });
    getSetting('isLoggedIn').then((v) => {
      if (v === 'true') setIsLoggedIn(true);
    });
    getSetting('defaultRate').then((v) => {
      if (v) setDefaultRateState(parseFloat(v));
    });
  }, []);

  const setLocale = useCallback(async (l: Locale) => {
    setLocaleState(l);
    await setSetting('locale', l);
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = l;
  }, []);

  const setOvertimeMultiplier = useCallback(async (v: number) => {
    setOvertimeMultiplierState(v);
    await setSetting('overtimeMultiplier', String(v));
  }, []);

  const setReminderCheckIn = useCallback(async (v: number) => {
    setReminderCheckInState(v);
    await setSetting('reminderCheckIn', String(v));
  }, []);

  const setReminderCheckOut = useCallback(async (v: number) => {
    setReminderCheckOutState(v);
    await setSetting('reminderCheckOut', String(v));
  }, []);

  const setRemindersEnabled = useCallback(async (v: boolean) => {
    setRemindersEnabledState(v);
    await setSetting('remindersEnabled', String(v));
  }, []);

  const login = useCallback(async () => {
    setIsLoggedIn(true);
    await setSetting('isLoggedIn', 'true');
  }, []);

  const logout = useCallback(async () => {
    setIsLoggedIn(false);
    await setSetting('isLoggedIn', 'false');
  }, []);

  const setDefaultRate = useCallback(async (v: number) => {
    setDefaultRateState(v);
    await setSetting('defaultRate', String(v));
  }, []);

  const refreshShifts = useCallback(async () => {
    const all = await db.shifts.toArray();
    setShifts(all);
  }, []);

  const refreshRecords = useCallback(async () => {
    const all = await db.attendanceRecords.toArray();
    setRecords(all);
  }, []);

  useEffect(() => {
    refreshShifts();
    refreshRecords();
  }, [refreshShifts, refreshRecords]);

  return (
    <AppContext.Provider
      value={{
        locale,
        setLocale,
        shifts,
        records,
        refreshShifts,
        refreshRecords,
        overtimeMultiplier,
        setOvertimeMultiplier,
        reminderCheckIn,
        setReminderCheckIn,
        reminderCheckOut,
        setReminderCheckOut,
        remindersEnabled,
        setRemindersEnabled,
        isLoggedIn,
        login,
        logout,
        defaultRate,
        setDefaultRate,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
