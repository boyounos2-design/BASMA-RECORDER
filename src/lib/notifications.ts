import type { Locale } from './i18n';
import { t } from './i18n';

export function requestNotificationPermission() {
  if ('Notification' in window) {
    return Notification.requestPermission();
  }
  return Promise.resolve('denied' as NotificationPermission);
}

export function sendNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

export function scheduleReminder(
  targetTime: string,
  minutesBefore: number,
  type: 'check-in' | 'check-out',
  locale: Locale,
) {
  const now = new Date();
  const [h, m] = targetTime.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);

  let reminderTime = new Date(target.getTime() - minutesBefore * 60000);

  if (reminderTime <= now) {
    return null;
  }

  const timeout = reminderTime.getTime() - now.getTime();

  const message =
    type === 'check-in'
      ? `${t('checkIn', locale)} ${t('reminder', locale)}`
      : `${t('checkOut', locale)} ${t('reminder', locale)}`;

  return setTimeout(() => {
    sendNotification(
      t('reminder', locale),
      `${message}: ${targetTime}`,
    );
  }, timeout);
}

export function scheduleShiftReminders(
  shiftStart: string,
  shiftEnd: string,
  checkInBefore: number,
  checkOutBefore: number,
  enabled: boolean,
  locale: Locale,
) {
  if (!enabled) return [];

  const timers: NodeJS.Timeout[] = [];

  const checkInTimer = scheduleReminder(shiftStart, checkInBefore, 'check-in', locale);
  if (checkInTimer) timers.push(checkInTimer);

  const checkOutTimer = scheduleReminder(shiftEnd, checkOutBefore, 'check-out', locale);
  if (checkOutTimer) timers.push(checkOutTimer);

  return timers;
}
