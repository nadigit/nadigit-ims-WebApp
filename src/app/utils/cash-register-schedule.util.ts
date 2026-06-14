/** Helpers for cash register opening/closing schedule (LocalTime strings ↔ Date for p-calendar timeOnly). */

export function timeStringToDate(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

export function dateToLocalTimeString(date: Date): string {
  return date.toTimeString().split(' ')[0];
}

export function parseCashRegisterSchedule(
  openingTime?: string | Date | null,
  closingTime?: string | Date | null
): { openingTime?: Date; closingTime?: Date } {
  const result: { openingTime?: Date; closingTime?: Date } = {};
  if (openingTime) {
    result.openingTime = typeof openingTime === 'string' ? timeStringToDate(openingTime) : new Date(openingTime);
  }
  if (closingTime) {
    result.closingTime = typeof closingTime === 'string' ? timeStringToDate(closingTime) : new Date(closingTime);
  }
  return result;
}

export function buildCashRegisterSchedulePayload(
  openingTime?: Date | null,
  closingTime?: Date | null
): { openingTime: string; closingTime: string } | null {
  if (!openingTime || !closingTime) {
    return null;
  }
  return {
    openingTime: dateToLocalTimeString(new Date(openingTime)),
    closingTime: dateToLocalTimeString(new Date(closingTime)),
  };
}
