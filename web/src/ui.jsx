import { useMemo, useState } from "react";
import { formatDuration, formatScore, formatShares, formatUsdc, formatWhen, shortAddr } from "./format.js";

export function AccountBar({ accounts, current, onSwitch, usdc, score, demo }) {
  return (
    <div className="account-bar card">
      <div>
        <div className="muted">{demo ? "Acting as" : "Connected"}</div>
        <strong>{shortAddr(current)}</strong>
      </div>
      <div className="pills">
        {accounts.map((a) => (
          <button
            key={a.address}
            className={a.address.toLowerCase() === current.toLowerCase() ? "pill on" : "pill"}
            onClick={() => onSwitch(a.address)}
          >
            {a.name}
          </button>
        ))}
      </div>
      <div className="balances">
        <span>{formatUsdc(usdc)}</span>
        <span className={Number(score) < 0 ? "score bad" : "score"}>
          Reputation {formatScore(score)}
        </span>
      </div>
    </div>
  );
}

export function CircleList({ circles, selected, onSelect, recipientOf }) {
  return (
    <section className="card">
      <h2>Circles</h2>
      {circles.length === 0 && <p className="muted">None yet.</p>}
      <ul className="circle-list">
        {circles.map((c, i) => (
          <li key={c.id ?? i}>
            <button className={i === selected ? "row-btn on" : "row-btn"} onClick={() => onSelect(i)}>
              <span>
                <strong>{c.name}</strong>
                <span className="muted">
                  {" "}
                  · {c.payoutKind === 1 ? "Stock" : "USDC"} · {c.members.length} members
                </span>
              </span>
              <StatusPill circle={c} recipient={recipientOf(c)} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function statusLabel(circle) {
  if (circle.closed) return "Closed";
  if (!circle.started) return "Open";
  return `Round ${circle.currentRound} of ${circle.members.length}`;
}

function StatusPill({ circle, recipient }) {
  return (
    <span className={`status ${circle.closed ? "closed" : circle.started ? "live" : "open"}`}>
      {statusLabel(circle)}
      {circle.started && !circle.closed && recipient ? ` · ${shortAddr(recipient)}’s turn` : ""}
    </span>
  );
}

export function CircleDetail({
  circle,
  account,
  reputationOf,
  usdcOf,
  stockOf,
  hasPaid: paidFn,
  recipient,
  due,
  late,
  payouts,
  clock,
  onJoin,
  onStart,
  onPay,
}) {
  const isMember = circle.members.some((m) => m.toLowerCase() === (account || "").toLowerCase());
  const round = Number(circle.currentRound) || 0;
  const alreadyPaid = isMember && round > 0 && paidFn(account, round);
  const isRecipient = recipient && account && recipient.toLowerCase() === account.toLowerCase();

  return (
    <section className="card">
      <div className="card-head">
        <h2>{circle.name}</h2>
        <StatusPill circle={circle} recipient={recipient} />
      </div>
      <p>
        Contribution {formatUsdc(circle.contribution)} every {formatDuration(circle.period)}. Payout in{" "}
        {circle.payoutKind === 1
          ? `mock stock at ${formatUsdc(circle.stockPrice)} per share`
          : "USDC"}
        . Minimum reputation {formatScore(circle.minReputation)}.
      </p>
      {circle.started && !circle.closed && (
        <p className="muted">
          This round is due {formatWhen(due)}. A payment is late after {formatWhen(late)}.
          {clock && late && clock > late ? " The grace period has already passed." : ""}
          {isRecipient ? " It is your turn to receive the pot." : recipient ? ` ${shortAddr(recipient)} receives this round.` : ""}
        </p>
      )}
      <ul className="members">
        {circle.members.map((m, i) => {
          const paid = circle.started && paidFn(m, round);
          const turn = recipient && recipient.toLowerCase() === m.toLowerCase();
          return (
            <li key={m} className={turn ? "member turn" : "member"}>
              <span>
                <strong>{shortAddr(m)}</strong>
                {turn && !circle.closed && <em> this turn</em>}
                <span className="muted"> · {formatUsdc(usdcOf(m))}</span>
                {circle.payoutKind === 1 && (
                  <span className="muted"> · {formatShares(stockOf(m))} nSTOCK</span>
                )}
              </span>
              <span className="chips">
                {circle.started && !circle.closed && (
                  <span className={paid ? "chip yes" : "chip wait"}>{paid ? "Paid" : "Waiting"}</span>
                )}
                <span className={reputationOf(m) < 0 ? "chip bad" : "chip"}>{formatScore(reputationOf(m))}</span>
                <span className="muted">#{i + 1}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {payouts?.length > 0 && (
        <div className="payouts">
          <h3>Payouts</h3>
          <ul>
            {payouts.map((p) => (
              <li key={`${p.round}-${p.recipient}`}>
                Round {p.round}: {shortAddr(p.recipient)} received{" "}
                {p.kind === 1 ? `${formatShares(p.amount)} nSTOCK` : formatUsdc(p.amount)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="row">
        {!circle.started && !circle.closed && !isMember && (
          <button onClick={onJoin}>Join circle</button>
        )}
        {!circle.started && !circle.closed && isMember && (
          <button onClick={onStart}>Start circle</button>
        )}
        {circle.started && !circle.closed && isMember && (
          <button onClick={onPay} disabled={alreadyPaid}>
            {alreadyPaid ? "Paid this round" : `Pay ${formatUsdc(circle.contribution)}`}
          </button>
        )}
      </div>
    </section>
  );
}

export function CreateForm({ defaultMembers, account, onCreate }) {
  const [name, setName] = useState("Bamenda Traders");
  const [selected, setSelected] = useState(() => (defaultMembers || []).map((a) => a.address));
  const [extra, setExtra] = useState("");
  const [contribution, setContribution] = useState("25");
  const [period, setPeriod] = useState("120");
  const [kind, setKind] = useState("1");
  const [stockPrice, setStockPrice] = useState("25");
  const [minRep, setMinRep] = useState("0");

  const members = useMemo(() => {
    const fromExtra = extra
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^0x[a-fA-F0-9]{40}$/.test(s));
    const set = new Set([...selected, ...fromExtra].map((s) => s.toLowerCase()));
    return [...set];
  }, [selected, extra]);

  function submit(e) {
    e.preventDefault();
    const contrib = BigInt(Math.round(Number(contribution) * 1_000_000));
    const price = kind === "1" ? BigInt(Math.round(Number(stockPrice) * 1_000_000)) : 0n;
    onCreate({
      name,
      members,
      contribution: contrib.toString(),
      period: Number(period),
      payoutKind: Number(kind),
      stockPrice: price.toString(),
      minReputation: Number(minRep),
      creator: account,
    });
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Start a circle</h2>
      <label htmlFor="name">Circle name</label>
      <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />

      {defaultMembers ? (
        <>
          <span className="label">Members</span>
          <div className="pills">
            {defaultMembers.map((a) => {
              const on = selected.some((s) => s.toLowerCase() === a.address.toLowerCase());
              return (
                <button
                  type="button"
                  key={a.address}
                  className={on ? "pill on" : "pill"}
                  onClick={() =>
                    setSelected((cur) =>
                      on ? cur.filter((s) => s.toLowerCase() !== a.address.toLowerCase()) : [...cur, a.address]
                    )
                  }
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <label htmlFor="members">Member addresses (one per line)</label>
          <textarea
            id="members"
            rows={4}
            placeholder={"0x…\n0x…"}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            required
          />
        </>
      )}
      {defaultMembers && (
        <>
          <label htmlFor="extra">Extra member address (optional)</label>
          <input id="extra" placeholder="0x…" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </>
      )}

      <div className="fields">
        <div>
          <label htmlFor="amount">Contribution (USDC)</label>
          <input id="amount" type="number" min="0.000001" step="any" value={contribution} onChange={(e) => setContribution(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="period">Period</label>
          <select id="period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="120">2 minutes (good for a demo)</option>
            <option value="3600">1 hour</option>
            <option value="86400">1 day</option>
            <option value="604800">7 days</option>
          </select>
        </div>
        <div>
          <label htmlFor="kind">Payout</label>
          <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="0">USDC</option>
            <option value="1">Fractional mock stock</option>
          </select>
        </div>
        {kind === "1" && (
          <div>
            <label htmlFor="price">Mock stock price (USDC per share)</label>
            <input id="price" type="number" min="0.000001" step="any" value={stockPrice} onChange={(e) => setStockPrice(e.target.value)} required />
          </div>
        )}
        <div>
          <label htmlFor="minRep">Minimum reputation</label>
          <input id="minRep" type="number" step="1" value={minRep} onChange={(e) => setMinRep(e.target.value)} />
        </div>
      </div>
      <p className="muted">{members.length} member{members.length === 1 ? "" : "s"} selected. You need at least two.</p>
      <p>
        <button type="submit" disabled={members.length < 2 || !name}>
          Create circle
        </button>
      </p>
    </form>
  );
}
