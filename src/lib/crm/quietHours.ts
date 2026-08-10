export const CRM_TIME_ZONE = "America/Sao_Paulo";

function hourInTimeZone(value: Date, timeZone = CRM_TIME_ZONE) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value).find(part => part.type === "hour")?.value;
  return Number(hour ?? 0);
}

export function isWithinQuietHours(input: {
  date: Date;
  startHour: number;
  endHour: number;
  timeZone?: string;
}) {
  if (input.startHour === input.endHour) return false;
  const hour = hourInTimeZone(input.date, input.timeZone);
  return input.startHour < input.endHour
    ? hour >= input.startHour && hour < input.endHour
    : hour >= input.startHour || hour < input.endHour;
}

export function moveAfterQuietHours(input: {
  date: Date;
  startHour: number;
  endHour: number;
  timeZone?: string;
}) {
  if (!isWithinQuietHours(input)) return new Date(input.date);

  const candidate = new Date(input.date);
  candidate.setUTCSeconds(0, 0);
  for (let minute = 0; minute <= 24 * 60; minute += 1) {
    if (!isWithinQuietHours({ ...input, date: candidate })) return candidate;
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }

  return new Date(input.date);
}
