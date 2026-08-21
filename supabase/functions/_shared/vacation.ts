export interface Vacation {
  from: string;
  to: string;
}

export function isVacationOn(vacation: Vacation | null, dateISO: string): boolean {
  if (!vacation?.from || !vacation?.to) return false;
  return dateISO >= vacation.from && dateISO <= vacation.to;
}

export function vacationPolicy(vacation: Vacation | null, today: string): "pause" | null {
  return isVacationOn(vacation, today) ? "pause" : null;
}