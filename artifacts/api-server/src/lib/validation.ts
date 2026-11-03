/** Trim string fields before generated-schema validation. Unknown keys remain for strict rejection. */
export function trimFields(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  return Object.fromEntries(Object.entries(body).map(([key, value]) =>
    [key, typeof value === "string" ? value.trim() : value],
  ));
}

export function validVisitDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return value >= "1900-01-01" && value <= today;
}
