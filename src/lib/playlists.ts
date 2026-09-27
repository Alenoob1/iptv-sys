import type { ParsedChannel } from "./m3u";
import { supabase } from "./supabase";
import type { Channel, Playlist } from "../types";

export async function importPlaylist(options: {
  name: string;
  sourceLabel: string;
  channels: ParsedChannel[];
  existingId?: string;
}) {
  let playlistId = options.existingId;

  if (!playlistId) {
    const { data, error } = await supabase
      .from("playlists")
      .insert({ name: options.name, source_label: options.sourceLabel, channel_count: options.channels.length })
      .select("id")
      .single();
    if (error) throw error;
    playlistId = (data as { id: string }).id;
  } else {
    const removed = await supabase.from("channels").delete().eq("playlist_id", playlistId);
    if (removed.error) throw removed.error;
    const updated = await supabase
      .from("playlists")
      .update({
        name: options.name,
        source_label: options.sourceLabel,
        channel_count: options.channels.length,
        imported_at: new Date().toISOString(),
      })
      .eq("id", playlistId);
    if (updated.error) throw updated.error;
  }

  const rows = options.channels.map((channel) => ({
    playlist_id: playlistId,
    name: channel.name.slice(0, 200),
    group_title: (channel.group_title || "General").slice(0, 120),
    logo_url: channel.logo_url,
    stream_url: channel.stream_url,
    tvg_id: channel.tvg_id,
  }));

  const size = 400;
  for (let index = 0; index < rows.length; index += size) {
    const inserted = await supabase.from("channels").insert(rows.slice(index, index + size));
    if (inserted.error) throw inserted.error;
  }

  return playlistId;
}

export async function fetchChannelsForPlan(planId: string | null) {
  let groups: string[] = [];
  if (planId) {
    const grouped = await supabase.from("plan_groups").select("group_title").eq("plan_id", planId);
    if (grouped.error) throw grouped.error;
    groups = ((grouped.data ?? []) as { group_title: string }[]).map((row) => row.group_title);
  }

  const channels: Channel[] = [];
  const pageSize = 1000;
  for (let page = 0; page < 8; page += 1) {
    const from = page * pageSize;
    const result = await supabase.from("channels").select("name, group_title, logo_url, stream_url, tvg_id").range(from, from + pageSize - 1);
    if (result.error) throw result.error;
    const rows = (result.data ?? []) as Channel[];
    channels.push(...rows);
    if (rows.length < pageSize) break;
  }

  if (groups.length === 0) return channels;
  const allowed = new Set(groups);
  return channels.filter((channel) => allowed.has(channel.group_title));
}

export function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export type { Playlist };
