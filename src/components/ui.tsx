import { useEffect, type ReactNode } from "react";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Fibcom IPTV`;
  }, [title]);
}

const glyphs = {
  plus: "M12 5v14M5 12h14",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3",
  download: "M12 4v10M8 10l4 4 4-4M5 19h14",
  refresh: "M20 12a8 8 0 1 1-2.2-5.5M20 4v5h-5",
  upload: "M12 16V6M8 10l4-4 4 4M5 19h14",
} as const;

export function Glyph({ name }: { name: keyof typeof glyphs }) {
  return (
    <svg className="btn-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={glyphs[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Banner({ kind, children }: { kind: "error" | "ok" | "info"; children: ReactNode }) {
  return <div className={`banner ${kind}`}>{children}</div>;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return <p className="loading">{label}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="badge muted">Sin suscripción</span>;
  return <span className={`badge ${value}`}>{value}</span>;
}

export function PageHead({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  useTitle(title);
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {text ? <p>{text}</p> : null}
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </header>
  );
}
