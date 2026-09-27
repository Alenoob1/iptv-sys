const usernameAlphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const passwordAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function pick(alphabet: string, length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let value = "";
  for (const byte of bytes) value += alphabet[byte % alphabet.length] ?? "x";
  return value;
}

export function generateUsername() {
  return `fib${pick(usernameAlphabet, 6)}`;
}

export function generatePassword() {
  return pick(passwordAlphabet, 10);
}

export function playlistUrl(username: string, password: string) {
  const base = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const user = encodeURIComponent(username);
  const pass = encodeURIComponent(password);
  return `${base}/functions/v1/playlist?username=${user}&password=${pass}`;
}

export async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}
