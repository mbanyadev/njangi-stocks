import { COMPLETED, DEMO_ACCOUNTS, DEMO_USDC, LATE, ON_TIME } from "./config.js";

export const STORAGE_KEY = "njangi-stocks-demo-v1";
const LATE_GRACE = 1n;

function norm(address) {
  return (address || "").toLowerCase();
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function emptyState() {
  const usdc = {};
  for (const a of DEMO_ACCOUNTS) usdc[norm(a.address)] = DEMO_USDC.toString();
  return {
    clock: nowSeconds(),
    useClock: false, // when true, "Advance time" moves clock instead of wall time
    usdc,
    factoryUsdc: "0",
    reputation: {},
    circles: [],
    paidRound: {}, // { [id]: { [member]: round } }
    collected: {},
    payouts: [],
    payments: [],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.circles)) return emptyState();
    return parsed;
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clockOf(state) {
  return state.useClock ? Number(state.clock) : nowSeconds();
}

function fail(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

function asBig(v) {
  return BigInt(v ?? 0);
}

export function getReputation(state, address) {
  return Number(state.reputation[norm(address)] ?? 0);
}

export function getUsdc(state, address) {
  return asBig(state.usdc[norm(address)] ?? 0);
}

export function getStockBalance(state, token, address) {
  const t = state.tokens?.[token];
  if (!t) return 0n;
  return asBig(t.balances[norm(address)] ?? 0);
}

export function dueAt(circle, round) {
  if (!circle.started || !round) return 0;
  return Number(circle.startTime) + Number(round) * Number(circle.period);
}

export function lateAfter(circle, round) {
  const due = dueAt(circle, round);
  if (!due) return 0;
  return due + Number(circle.period) * Number(LATE_GRACE);
}

export function currentRecipient(circle) {
  if (!circle.currentRound || !circle.members.length) return "";
  const idx = (Number(circle.currentRound) - 1) % circle.members.length;
  return circle.members[idx];
}

export function hasPaid(state, id, member, round) {
  const last = Number(state.paidRound[String(id)]?.[norm(member)] ?? 0);
  return last >= Number(round) && Number(round) !== 0;
}

export function faucet(state, address, amount = DEMO_USDC) {
  const key = norm(address);
  state.usdc[key] = (asBig(state.usdc[key]) + asBig(amount)).toString();
  return state;
}

export function createCircle(state, input, creator) {
  const name = (input.name || "").trim();
  const members = (input.members || []).map(norm);
  const contribution = asBig(input.contribution);
  const period = Number(input.period);
  const payoutKind = Number(input.payoutKind);
  const stockPrice = asBig(input.stockPrice || 0);
  const minReputation = Number(input.minReputation || 0);
  if (!name || members.length < 2 || contribution === 0n || !period) fail("BadArgs");
  if (payoutKind === 1 && stockPrice === 0n) fail("BadArgs");
  const seen = new Set();
  for (const m of members) {
    if (!m || m === "0x0000000000000000000000000000000000000000") fail("BadArgs");
    if (seen.has(m)) fail("BadArgs");
    seen.add(m);
  }
  const id = state.circles.length;
  let stockToken = "";
  if (payoutKind === 1) {
    stockToken = `demo-stock-${id}`;
    state.tokens = state.tokens || {};
    state.tokens[stockToken] = {
      name: `${name} Share`,
      symbol: "nSTOCK",
      total: "0",
      balances: {},
    };
  }
  state.circles.push({
    id,
    name,
    members,
    contribution: contribution.toString(),
    period,
    startTime: 0,
    currentRound: 0,
    payoutKind,
    stockToken,
    stockPrice: stockPrice.toString(),
    minReputation,
    started: false,
    closed: false,
    creator: norm(creator),
  });
  return id;
}

export function join(state, id, account) {
  const c = state.circles[id];
  if (!c) fail("BadArgs");
  const who = norm(account);
  if (c.closed) fail("Closed");
  if (c.started) fail("AlreadyStarted");
  if (c.members.includes(who)) fail("AlreadyMember");
  if (getReputation(state, who) < c.minReputation) fail("ReputationTooLow");
  c.members.push(who);
}

export function start(state, id, account) {
  const c = state.circles[id];
  if (!c) fail("BadArgs");
  const who = norm(account);
  if (c.closed) fail("Closed");
  if (c.started) fail("AlreadyStarted");
  if (c.members.length < 2) fail("BadArgs");
  if (!c.members.includes(who)) fail("NotMember");
  for (const m of c.members) {
    if (getReputation(state, m) < c.minReputation) fail("ReputationTooLow");
  }
  c.started = true;
  c.startTime = clockOf(state);
  c.currentRound = 1;
}

export function pay(state, id, account) {
  const c = state.circles[id];
  if (!c) fail("BadArgs");
  const who = norm(account);
  if (!c.started) fail("NotStarted");
  if (c.closed) fail("Closed");
  if (!c.members.includes(who)) fail("NotMember");
  const round = Number(c.currentRound);
  if (hasPaid(state, id, who, round)) fail("AlreadyPaid");
  const bal = getUsdc(state, who);
  const contribution = asBig(c.contribution);
  if (bal < contribution) fail("TransferFailed");
  state.usdc[who] = (bal - contribution).toString();
  state.factoryUsdc = (asBig(state.factoryUsdc) + contribution).toString();
  state.paidRound[String(id)] = state.paidRound[String(id)] || {};
  state.paidRound[String(id)][who] = round;
  state.collected[String(id)] = state.collected[String(id)] || {};
  const collected = asBig(state.collected[String(id)][String(round)]) + contribution;
  state.collected[String(id)][String(round)] = collected.toString();

  const late = clockOf(state) > lateAfter(c, round);
  const delta = late ? LATE : ON_TIME;
  state.reputation[who] = getReputation(state, who) + delta;
  state.payments.push({ id, member: who, round, late, at: clockOf(state) });

  const potNeeded = contribution * BigInt(c.members.length);
  if (collected === potNeeded) payout(state, c);
}

function payout(state, c) {
  const recipient = currentRecipient(c);
  const pot = asBig(state.collected[String(c.id)][String(c.currentRound)]);
  let amount = pot.toString();
  if (c.payoutKind === 0) {
    state.factoryUsdc = (asBig(state.factoryUsdc) - pot).toString();
    state.usdc[recipient] = (getUsdc(state, recipient) + pot).toString();
  } else {
    const shares = (pot * 10n ** 18n) / asBig(c.stockPrice);
    const token = state.tokens[c.stockToken];
    token.total = (asBig(token.total) + shares).toString();
    token.balances[recipient] = (asBig(token.balances[recipient]) + shares).toString();
    amount = shares.toString();
  }
  state.reputation[recipient] = getReputation(state, recipient) + COMPLETED;
  state.payouts.push({
    id: c.id,
    round: c.currentRound,
    recipient,
    kind: c.payoutKind,
    amount,
    at: clockOf(state),
  });
  if (c.currentRound >= c.members.length) c.closed = true;
  else c.currentRound += 1;
}

export function advanceTime(state, seconds) {
  if (!state.useClock) {
    state.useClock = true;
    state.clock = nowSeconds();
  }
  state.clock = Number(state.clock) + Number(seconds);
  return state;
}

export function loadSample(state) {
  const next = emptyState();
  const members = DEMO_ACCOUNTS.map((a) => a.address);
  createCircle(
    next,
    {
      name: "Bamenda Traders",
      members,
      contribution: (25n * 1_000_000n).toString(),
      period: 120,
      payoutKind: 1,
      stockPrice: (25n * 1_000_000n).toString(),
      minReputation: 0,
    },
    members[0]
  );
  createCircle(
    next,
    {
      name: "Douala Market",
      members,
      contribution: (25n * 1_000_000n).toString(),
      period: 7 * 24 * 60 * 60,
      payoutKind: 0,
      stockPrice: "0",
      minReputation: 0,
    },
    members[0]
  );
  next.clock = state.clock;
  next.useClock = state.useClock;
  return next;
}
