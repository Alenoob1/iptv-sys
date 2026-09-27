import type { Channel } from "../types";

export type ParsedChannel = Channel;

export function parseM3u(text: string): ParsedChannel[] {
  const lines = text.split(/\r?\n/);
  const channels: ParsedChannel[] = [];
  let pending: ParsedChannel | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const group = /group-title="([^"]*)"/i.exec(line)?.[1]?.trim() || "General";
      const logo = /tvg-logo="([^"]*)"/i.exec(line)?.[1]?.trim() || null;
      const tvg = /tvg-id="([^"]*)"/i.exec(line)?.[1]?.trim() || null;
      const comma = line.lastIndexOf(",");
      const name = (comma >= 0 ? line.slice(comma + 1) : "Canal").trim() || "Canal";
      pending = { name, group_title: group, logo_url: logo, stream_url: "", tvg_id: tvg };
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!pending) continue;
    if (!/^https?:\/\//i.test(line)) {
      pending = null;
      continue;
    }
    channels.push({ ...pending, stream_url: line });
    pending = null;
  }

  return channels;
}

function clean(value: string) {
  return value.replace(/[\r\n"]/g, " ").trim();
}

export function toM3u(channels: Channel[]) {
  const lines = ["#EXTM3U"];
  for (const channel of channels) {
    const logo = channel.logo_url ? ` tvg-logo="${clean(channel.logo_url)}"` : "";
    const tvg = channel.tvg_id ? ` tvg-id="${clean(channel.tvg_id)}"` : "";
    lines.push(`#EXTINF:-1${tvg}${logo} group-title="${clean(channel.group_title) || "General"}",${clean(channel.name)}`);
    lines.push(channel.stream_url);
  }
  return lines.join("\n");
}

export function groupCounts(channels: ParsedChannel[]) {
  const counts = new Map<string, number>();
  for (const channel of channels) {
    counts.set(channel.group_title, (counts.get(channel.group_title) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
}
