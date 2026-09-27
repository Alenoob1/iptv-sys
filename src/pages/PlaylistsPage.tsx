import { useEffect, useMemo, useState } from "react";
import { Banner, Empty, Field, Glyph, Loading, useTitle } from "../components/ui";
import { groupCounts, parseM3u } from "../lib/m3u";
import { importPlaylist } from "../lib/playlists";
import { humanError } from "../lib/rules";
import { supabase } from "../lib/supabase";
import type { ParsedChannel } from "../lib/m3u";
import type { Channel, Playlist } from "../types";

type ChannelRow = Channel & { id: string; playlist_id: string };

const tones = ["#dbeafe", "#dcfce7", "#fce7f3", "#fef3c7", "#e0e7ff", "#ffedd5"];

function faceColor(name: string) {
  return tones[name.charCodeAt(0) % tones.length] ?? tones[0];
}

export function PlaylistsPage() {
  useTitle("Canales");
  const [lists, setLists] = useState<Playlist[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [parsed, setParsed] = useState<ParsedChannel[]>([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [show, setShow] = useState(10);
  const [page, setPage] = useState(0);
  const [auto, setAuto] = useState(false);

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    const [listsResult, channelsResult] = await Promise.all([
      supabase.from("playlists").select("*").order("imported_at", { ascending: false }),
      supabase.from("channels").select("id, playlist_id, name, group_title, logo_url, stream_url, tvg_id").range(0, 499),
    ]);
    if (!quiet) setLoading(false);
    if (listsResult.error || channelsResult.error) {
      setError(humanError(listsResult.error ?? channelsResult.error));
      return;
    }
    setLists((listsResult.data ?? []) as Playlist[]);
    setChannels((channelsResult.data ?? []) as ChannelRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => { void load(true); }, 20000);
    return () => window.clearInterval(timer);
  }, [auto]);

  const groups = useMemo(() => [...new Set(channels.map((channel) => channel.group_title))].sort((a, b) => a.localeCompare(b, "es")), [channels]);

  const visible = channels.filter((channel) => {
    if (playlistId && channel.playlist_id !== playlistId) return false;
    if (group && channel.group_title !== group) return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return channel.name.toLowerCase().includes(term) || channel.group_title.toLowerCase().includes(term);
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const next = parseM3u(text);
    if (next.length === 0) {
      setError("No se encontraron canales. El archivo debe ser un M3U con líneas #EXTINF y URLs http.");
      setParsed([]);
      return;
    }
    if (next.length > 20000) {
      setError("La lista supera 20 000 canales. Divídela antes de importarla.");
      setParsed([]);
      return;
    }
    setError(null);
    setParsed(next);
    setSourceLabel(file.name);
    if (!name) setName(file.name.replace(/\.m3u8?$/i, ""));
  }

  async function save() {
    if (parsed.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await importPlaylist({
        name: name.trim() || "Lista M3U",
        sourceLabel,
        channels: parsed,
        existingId: target || undefined,
      });
      setNotice(`${parsed.length} canales importados.`);
      setParsed([]);
      setName("");
      setTarget("");
      setImportOpen(false);
      await load();
    } catch (importError) {
      setError(humanError(importError));
    } finally {
      setBusy(false);
    }
  }

  async function remove(list: Playlist) {
    if (!window.confirm(`¿Eliminar la lista ${list.name} y sus canales?`)) return;
    const result = await supabase.from("playlists").delete().eq("id", list.id);
    if (result.error) setError(humanError(result.error));
    else {
      setNotice("Lista eliminada.");
      if (playlistId === list.id) setPlaylistId("");
      await load();
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const area = document.createElement("textarea");
      area.value = url;
      area.setAttribute("readonly", "");
      document.body.append(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      if (!copied) {
        setError(null);
        setNotice(`Enlace listo para copiar: ${url}`);
        return;
      }
    }
    setError(null);
    setNotice("Enlace del canal copiado.");
  }

  const previewGroups = groupCounts(parsed).slice(0, 8);
  const pages = Math.max(1, Math.ceil(visible.length / show));
  const pageRows = visible.slice(page * show, page * show + show);

  return (
    <section>
      <header className="sheet-top">
        <div>
          <h1>Canales</h1>
          <p>Ícono, grupo y si el canal tiene una dirección guardada.</p>
        </div>
        <div className="sheet-tools">
          <a className="btn warn icon-only" href="/lista-ejemplo.m3u" download title="Ejemplo" aria-label="Descargar ejemplo"><Glyph name="download" /></a>
          <button className="btn search icon-only" type="button" title="Actualizar" aria-label="Actualizar" onClick={() => void load()}><Glyph name="refresh" /></button>
          <button className={auto ? "btn auto on" : "btn auto"} type="button" onClick={() => setAuto((value) => !value)}>Auto</button>
          <button className="btn add" type="button" onClick={() => setImportOpen(true)}><Glyph name="plus" /> Canal</button>
          <button className="btn create" type="button" onClick={() => setImportOpen((open) => !open)}>{importOpen ? "Cerrar" : "Crear"}</button>
        </div>
      </header>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind="ok">{notice}</Banner> : null}
      {importOpen ? (
        <article className="card stack">
          <h2>Importar M3U</h2>
          <div className="grid-2">
            <Field label="Nombre">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Lista principal" />
            </Field>
            <Field label="Destino">
              <select value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">Nueva lista</option>
                {lists.map((list) => <option key={list.id} value={list.id}>Reemplazar {list.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Archivo .m3u">
            <input type="file" accept=".m3u,.m3u8,text/plain" onChange={(event) => void onFile(event.target.files?.[0])} />
          </Field>
          {parsed.length > 0 ? <p>{parsed.length} canales en {groupCounts(parsed).length} grupos. {previewGroups.map(([title]) => title).join(", ")}</p> : <p className="hint">Las direcciones de la lista de ejemplo no son transmisiones reales.</p>}
          <div className="actions">
            <button type="button" className="btn add" disabled={busy || parsed.length === 0} onClick={() => void save()}><Glyph name="plus" /> {busy ? "Importando…" : "Guardar lista"}</button>
          </div>
        </article>
      ) : null}
      <div className="sheet">
        <form className="sheet-filters" onSubmit={(event) => event.preventDefault()}>
          <input placeholder="Buscar canal" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
          <select value={playlistId} aria-label="Lista" onChange={(event) => { setPlaylistId(event.target.value); setPage(0); }}>
            <option value="">Todas las listas</option>
            {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
          <select value={group} aria-label="Grupo" onChange={(event) => { setGroup(event.target.value); setPage(0); }}>
            <option value="">Todos los grupos</option>
            {groups.map((title) => <option key={title} value={title}>{title}</option>)}
          </select>
          <select value={show} aria-label="Mostrar" onChange={(event) => { setShow(Number(event.target.value)); setPage(0); }}>
            <option value={10}>Mostrar 10</option>
            <option value={25}>Mostrar 25</option>
            <option value={50}>Mostrar 50</option>
          </select>
        </form>
        {loading ? <Loading /> : pageRows.length === 0 ? <Empty title="Sin canales" text="Importa un M3U para verlos en esta tabla." /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Ícono</th>
                  <th>Nombre</th>
                  <th>Fuente</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((channel) => {
                  const listName = lists.find((list) => list.id === channel.playlist_id)?.name ?? "Lista";
                  const ready = channel.stream_url.startsWith("http");
                  return (
                    <tr key={channel.id}>
                      <td>{channel.id.slice(0, 8)}</td>
                      <td>
                        {channel.logo_url ? <img className="channel-face" src={channel.logo_url} alt="" /> : <span className="channel-face" style={{ background: faceColor(channel.name) }}>{channel.name.slice(0, 2).toUpperCase()}</span>}
                      </td>
                      <td>
                        <div className="stream-name">
                          <strong>{channel.name}</strong>
                          <small>{channel.group_title}</small>
                        </div>
                      </td>
                      <td className="source-cell">
                        <strong>{listName}</strong>
                        <small>{channel.stream_url}</small>
                      </td>
                      <td><span className={ready ? "live up" : "live down"}>{ready ? "ACTIVO" : "CAÍDO"}</span></td>
                      <td>
                        <div className="icon-actions">
                          <button type="button" title="Copiar enlace" aria-label={`Copiar ${channel.name}`} onClick={() => void copyUrl(channel.stream_url)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="pager">
          <button type="button" className="btn small" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Anterior</button>
          <span>{page + 1} de {pages}</span>
          <button type="button" className="btn small" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
        </div>
        {lists.length > 0 ? (
          <div className="actions wrap">
            {lists.map((list) => (
              <button key={list.id} type="button" className="btn small danger" onClick={() => void remove(list)}>Quitar {list.name}</button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
