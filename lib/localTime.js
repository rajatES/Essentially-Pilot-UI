// Converting between an <input type="datetime-local"> value and an instant.
//
// These two are inverses, and they exist as a pair because getting one of them
// wrong is invisible until someone notices a post went out at the wrong time.
//
// The trap: a datetime-local input's value is a NAIVE wall-clock string —
// "2026-09-23T16:30", no timezone. Sending that to the API as-is looks fine and
// is silently wrong, because `new Date("2026-09-23T16:30")` is resolved against
// whatever timezone the parser is in. In the browser that is the viewer's zone;
// on our server it is UTC (the container runs TZ=UTC). So a user in IST picking
// 4:30 pm had it stored as 16:30Z and read back as 10:00 pm — the exact bug
// this file was added to fix. The shift is silent and always equals the
// viewer's UTC offset.
//
// So: parse the naive string in the BROWSER, where local means the user's zone,
// and send an offset-qualified ISO string. Every caller that hands a
// datetime-local value to the API goes through localInputToIso().

// Instant -> the "YYYY-MM-DDTHH:MM" a datetime-local input expects, in the
// viewer's timezone.
export function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

// A datetime-local value -> a full UTC ISO string. Returns null for an empty or
// unparseable value, so callers can omit the field rather than send a bad one.
export function localInputToIso(value) {
  if (!value) return null;
  const d = new Date(value); // naive string: the browser resolves it as LOCAL
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
