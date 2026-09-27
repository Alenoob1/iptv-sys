import { createClient } from "npm:@supabase/supabase-js@2";

type Channel = {
  name: string;
  group_title: string;
  logo_url: string | null;
  stream_url: string;
  tvg_id: string | null;
};

function clean(value: string) {
  return value.replace(/[\r\n"]/g, " ").trim();
}

function sameSecret(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

function json(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json("", 204);
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const marker = parts.lastIndexOf("playlist");
  let username = url.searchParams.get("username") ?? "";
  let password = url.searchParams.get("password") ?? "";
  if (!username && marker >= 0 && parts.length >= marker + 3) {
    username = decodeURIComponent(parts[marker + 1] ?? "");
    password = decodeURIComponent((parts[marker + 2] ?? "").replace(/\.m3u8?$/i, ""));
  }
  if (!username || !password) return json("No autorizado", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json("Servicio no configurado", 500);

  const supabase = createClient(supabaseUrl, serviceKey);
  const userResult = await supabase.from("iptv_users").select("id, line_password, status").eq("username", username).maybeSingle();
  const user = userResult.data as { id: string; line_password: string; status: string } | null;
  if (!user || user.status !== "activo" || !sameSecret(user.line_password, password)) return json("No autorizado", 403);

  const today = new Date().toISOString().slice(0, 10);
  const subResult = await supabase
    .from("subscriptions")
    .select("plan_id, status, starts_at, ends_at")
    .eq("iptv_user_id", user.id)
    .eq("status", "activa")
    .lte("starts_at", today)
    .gte("ends_at", today)
    .limit(1);
  const subscription = (subResult.data ?? [])[0] as { plan_id: string } | undefined;
  if (!subscription) return json("Suscripción no vigente", 403);

  const groupResult = await supabase.from("plan_groups").select("group_title").eq("plan_id", subscription.plan_id);
  const allowed = new Set(((groupResult.data ?? []) as { group_title: string }[]).map((row) => row.group_title));

  const channels: Channel[] = [];
  for (let page = 0; page < 20; page += 1) {
    const from = page * 1000;
    const result = await supabase.from("channels").select("name, group_title, logo_url, stream_url, tvg_id").range(from, from + 999);
    if (result.error) return json("No se pudo armar la lista", 500);
    const chunk = (result.data ?? []) as Channel[];
    channels.push(...chunk);
    if (chunk.length < 1000) break;
  }

  const lines = ["#EXTM3U"];
  for (const channel of channels) {
    if (allowed.size > 0 && !allowed.has(channel.group_title)) continue;
    const logo = channel.logo_url ? ` tvg-logo="${clean(channel.logo_url)}"` : "";
    const tvg = channel.tvg_id ? ` tvg-id="${clean(channel.tvg_id)}"` : "";
    lines.push(`#EXTINF:-1${tvg}${logo} group-title="${clean(channel.group_title) || "General"}",${clean(channel.name)}`);
    lines.push(channel.stream_url);
  }

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "audio/x-mpegurl; charset=utf-8",
      "content-disposition": `attachment; filename="${username}.m3u"`,
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
});
