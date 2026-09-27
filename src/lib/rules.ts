import type { SubStatus, UserStatus } from "../types";

export function humanError(error: unknown) {
  const err = error as { message?: string; code?: string };
  const message = err.message ?? "No se pudo completar la operación.";
  if (err.code === "23505" || /duplicate key/i.test(message)) return "Ese dato ya está registrado.";
  if (err.code === "23503") return "No se puede completar porque hay registros relacionados.";
  if (err.code === "23514" || /check constraint/i.test(message)) return "Hay datos que no cumplen las reglas del sistema.";
  return message;
}

export function nextUserStatuses(status: UserStatus): { status: UserStatus; label: string; warning: string }[] {
  if (status === "activo") {
    return [
      { status: "suspendido", label: "Suspender", warning: "La suscripción activa pasará a suspendida y la lista M3U dejará de abrirse." },
      { status: "inactivo", label: "Desactivar", warning: "La cuenta quedará inactiva y las suscripciones abiertas se cancelarán." },
    ];
  }
  if (status === "suspendido") {
    return [
      { status: "activo", label: "Activar", warning: "Se reactivarán las suscripciones suspendidas que todavía no vencen." },
      { status: "inactivo", label: "Desactivar", warning: "La cuenta quedará inactiva y las suscripciones abiertas se cancelarán." },
    ];
  }
  return [{ status: "activo", label: "Reactivar", warning: "La cuenta volverá a estar activa. Si la suscripción fue cancelada, hay que renovarla." }];
}

export function nextSubStatuses(status: SubStatus): SubStatus[] {
  if (status === "pendiente") return ["activa", "cancelada"];
  if (status === "activa") return ["suspendida", "vencida", "cancelada"];
  if (status === "suspendida") return ["activa", "vencida", "cancelada"];
  if (status === "vencida") return ["activa", "cancelada"];
  return [];
}

export const entityLabel: Record<string, string> = {
  clients: "Cliente",
  iptv_users: "Cuenta IPTV",
  subscriptions: "Suscripción",
  plans: "Plan",
  playlists: "Lista M3U",
  profiles: "Personal",
};

export function auditSummary(detail: Record<string, unknown>) {
  const before = detail.antes;
  const after = detail.despues;
  if (!before || !after || typeof before !== "object" || typeof after !== "object") {
    return detail.antes ? "Registro eliminado" : "Registro creado";
  }
  const previous = before as Record<string, unknown>;
  const next = after as Record<string, unknown>;
  const changed = Object.keys(next).filter((key) => !["updated_at", "created_at", "line_password"].includes(key) && JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
  return changed.length > 0 ? `Cambió: ${changed.join(", ")}` : "Actualización sin cambio de datos visibles";
}
