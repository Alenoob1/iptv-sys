export function todayISO() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(iso: string, days: number) {
  const parts = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  const parts = value.slice(0, 10).split("-").map(Number);
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return value;
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" }).format(new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1));
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function money(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(Number.isNaN(amount) ? 0 : amount);
}

export function daysUntil(iso: string | null) {
  if (!iso) return null;
  const parts = iso.slice(0, 10).split("-").map(Number);
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  const target = new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function dueLabel(iso: string | null) {
  const days = daysUntil(iso);
  if (days === null) return "Sin vigencia";
  if (days < 0) return `Venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  return `Vence en ${days} días`;
}
