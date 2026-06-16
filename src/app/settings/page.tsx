'use client';

import { useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { exportAllData, importAllData } from '@/lib/db';
import { t } from '@/lib/i18n';

export default function SettingsPage() {
  const {
    locale, setLocale,
    reminderCheckIn, setReminderCheckIn,
    reminderCheckOut, setReminderCheckOut,
    remindersEnabled, setRemindersEnabled,
    defaultRate, setDefaultRate,
    refreshShifts, refreshRecords,
  } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleBackup() {
    const data = await exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `basma-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert(t('backupSuccess', locale));
  }

  function handleRestore() {
    fileRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      await importAllData(text);
      await refreshShifts();
      await refreshRecords();
      alert(t('restoreSuccess', locale));
    } catch {
      alert(t('error', locale));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">{t('settings', locale)}</h1>

      <div className="card p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('language', locale)}</label>
          <div className="flex gap-2">
            <button
              onClick={() => setLocale('en')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
                locale === 'en'
                  ? 'bg-blue-500 text-white'
                  : 'border-2 border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {t('english', locale)}
            </button>
            <button
              onClick={() => setLocale('ar')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
                locale === 'ar'
                  ? 'bg-blue-500 text-white'
                  : 'border-2 border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {t('arabic', locale)}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('defaultRate', locale)}</label>
          <input
            type="number"
            value={defaultRate}
            onChange={(e) => setDefaultRate(parseFloat(e.target.value) || 110)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
            min="0"
            step="0.5"
          />
          <p className="text-xs text-slate-400 mt-1">{t('hourlyRate', locale)} {t('egp', locale)}/{t('hours', locale)}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('reminder', locale)}</label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={remindersEnabled}
                onChange={(e) => setRemindersEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700">{t('enableReminders', locale)}</span>
            </div>
            <div>
              <label className="text-xs text-slate-500">{t('reminderBeforeCheckIn', locale)}</label>
              <input
                type="number"
                value={reminderCheckIn}
                onChange={(e) => setReminderCheckIn(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                min="0"
                max="120"
                disabled={!remindersEnabled}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">{t('reminderBeforeCheckOut', locale)}</label>
              <input
                type="number"
                value={reminderCheckOut}
                onChange={(e) => setReminderCheckOut(parseInt(e.target.value) || 15)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                min="0"
                max="120"
                disabled={!remindersEnabled}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('backup', locale)} / {t('restore', locale)}</label>
          <div className="flex gap-2">
            <button onClick={handleBackup} className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">
              {t('backup', locale)}
            </button>
            <button onClick={handleRestore} className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100">
              {t('restore', locale)}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
