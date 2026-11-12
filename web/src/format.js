import { DEMO_ACCOUNTS } from "./config.js";

const names = Object.fromEntries(
  DEMO_ACCOUNTS.map((a) => [a.address.toLowerCase(), a.name])
);

export function shortAddr(address) {
  if (!address) return "";
  const name = names[address.toLowerCase()];
  if (name) return name;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatUsdc(units) {
  const n = BigInt(units ?? 0);
  const neg = n < 0n;
  const v = neg ? -n : n;
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : whole.toString();
  return `${neg ? "-" : ""}${body} USDC`;
}

export function formatShares(units) {
  const n = BigInt(units ?? 0);
  const whole = n / 10n ** 18n;
  const frac = (n % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function formatScore(score) {
  const n = Number(score ?? 0);
  return n > 0 ? `+${n}` : String(n);
}

export function formatDuration(seconds) {
  const s = Number(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} hr`;
  return `${Math.round(s / 86400)} day${s >= 172800 ? "s" : ""}`;
}

export function formatWhen(unixSeconds) {
  if (!unixSeconds) return "—";
  return new Date(Number(unixSeconds) * 1000).toLocaleString();
}
