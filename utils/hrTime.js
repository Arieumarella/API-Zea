const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = process.env.TZ || "Asia/Jakarta";

function nowJakarta() {
  return dayjs().tz(TIMEZONE);
}

function toJakarta(date) {
  return dayjs(date).tz(TIMEZONE);
}

function dateString(date) {
  return dayjs(date).tz(TIMEZONE).format("YYYY-MM-DD");
}

function formatTime(date) {
  return dayjs(date).tz(TIMEZONE).format("HH:mm");
}

function timeToMinutes(timeString) {
  if (typeof timeString !== "string") return 0;
  const match = timeString.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function minutesToTime(minutes) {
  const safe = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function listDates(startDateString, endDateString) {
  const dates = [];
  let current = dayjs(startDateString).tz(TIMEZONE).startOf("day");
  const end = dayjs(endDateString).tz(TIMEZONE).startOf("day");
  while (!current.isAfter(end)) {
    dates.push(current.format("YYYY-MM-DD"));
    current = current.add(1, "day");
  }
  return dates;
}

function parseWorkDays(workDaysCsv) {
  const parts = String(workDaysCsv || "1,2,3,4,5,6").split(",");
  const set = new Set();
  parts.forEach((part) => {
    const day = parseInt(part.trim(), 10);
    if (!Number.isNaN(day) && day >= 1 && day <= 7) set.add(day);
  });
  return set;
}

function isWorkDay(dateString, workDaysCsv) {
  const workDays = parseWorkDays(workDaysCsv);
  const dayOfWeek = dayjs(dateString).tz(TIMEZONE).day();
  const isoDay = ((dayOfWeek + 6) % 7) + 1;
  return workDays.has(isoDay);
}

function listWorkDates(startDateString, endDateString, workDaysCsv, holidayDateStrings) {
  const holidays = new Set(holidayDateStrings || []);
  return listDates(startDateString, endDateString).filter(
    (date) => isWorkDay(date, workDaysCsv) && !holidays.has(date)
  );
}

function combineDateAndTime(dateString, timeString) {
  const parsed = dayjs(`${dateString} ${timeString}`, "YYYY-MM-DD HH:mm").tz(TIMEZONE, true);
  if (!parsed.isValid()) {
    return null;
  }
  return parsed.toDate();
}

function minutesBetweenInclusive(startTimeString, endTimeString) {
  const start = timeToMinutes(startTimeString);
  const end = timeToMinutes(endTimeString);
  return end > start ? end - start : 0;
}

module.exports = {
  TIMEZONE,
  nowJakarta,
  toJakarta,
  dateString,
  formatTime,
  timeToMinutes,
  minutesToTime,
  listDates,
  listWorkDates,
  isWorkDay,
  combineDateAndTime,
  minutesBetweenInclusive,
};
