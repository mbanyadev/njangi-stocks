import { lazy, Suspense, useEffect, useState } from "react";
import {
  DEMO_ACCOUNTS,
  DEMO_USDC,
  EXPLORER,
  FACTORY,
  LIVE,
  REPO,
  USDC,
} from "./config.js";
import { friendlyError } from "./errors.js";
import {
  advanceTime,
  createCircle,
  currentRecipient,
  dueAt,
  emptyState,
  faucet,
  getReputation,
  getStockBalance,
  getUsdc,
  hasPaid,
  join,
  lateAfter,
  loadSample,
  loadState,
  pay,
  saveState,
  start,
} from "./mock.js";
import { AccountBar, CircleDetail, CircleList, CreateForm } from "./ui.jsx";

const LiveApp = lazy(() => import("./LiveApp.jsx"));

const US_CODES = new Set(["US", "USA"]);

export default function App() {
  const [allowed, setAllowed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [geoPending, setGeoPending] = useState(true);
  const [geoFailed, setGeoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3500);
    (async () => {
      try {
        const res = await fetch("https://ipwho.is/", { signal: ctl.signal });
        const data = await res.json();
        const code = String(data.country_code || data.country || "").toUpperCase();
        if (!cancelled && US_CODES.has(code)) setBlocked(true);
      } catch {
        if (!cancelled) setGeoFailed(true);
      } finally {
        if (!cancelled) setGeoPending(false);
        clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      ctl.abort();
      clearTimeout(timer);
    };
  }, []);

  if (blocked) {
    return (
      <div className="gate">
        <h1>Not available in the United States</h1>
        <p>
          Njangi Stocks is a demo of a rotating savings circle on Base. It is not
          available to US persons or to people using it from the United States,
          and it is not an offer or solicitation to buy any security, including
          any tokenized stock.
        </p>
      </div>
    );
  }

  if (!allowed) {
    return <Gate pending={geoPending} geoFailed={geoFailed} onEnter={() => setAllowed(true)} />;
  }

  return <Shell />;
}

function Gate({ pending, geoFailed, onEnter }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="gate">
      <h1>Before you continue</h1>
      <p>
        Njangi Stocks is a demo of a rotating savings circle that can pay out in
        USDC or in a <em>mock</em> fractional stock token. It is not an offer or
        solicitation to buy any security, including any tokenized stock, and it
        is not available to US persons.
      </p>
      <p>
        You must not use this app if you are a US person, are located in the
        United States, or would be using it to trade tokenized stocks for US
        users.
      </p>
      {pending && <p className="muted">Checking that this demo is available in your region…</p>}
      {geoFailed && (
        <p className="warn">
          We could not confirm your region automatically. Please only continue if
          you are not a US person and you are not using this app from the United
          States.
        </p>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(e) => setChecked(e.target.checked)}
        />
        I confirm I am not a US person and I am not using this app from the
        United States.
      </label>
      <p>
        <button disabled={!checked || pending} onClick={onEnter}>
          Enter the demo
        </button>
      </p>
    </div>
  );
}

function Shell() {
  const [mode, setMode] = useState("demo");
  return (
    <>
      <header>
        <div>
          <strong>Njangi Stocks</strong>
          <div className="tagline">A savings circle that can hold a share of a stock, without a treasurer.</div>
        </div>
        <span>Base Sepolia demo · Mbanya Dev</span>
      </header>
      <main>
        <section className="hero">
          <h1>Friends pay in USDC. The pot can come back as USDC, or as a fraction of a stock.</h1>
          <p>
            In Cameroon and similar African markets, a njangi is a rotating savings
            circle. This demo keeps that social model and removes the human
            treasurer. When a round is complete, the member whose turn it is is
            paid in USDC, or the pot buys mock fractional stock tokens at a fixed
            demo price and those shares go to that member.
          </p>
          <p className="banner">
            Demo only. Not available to US persons. Not an offer of securities.
            Mock stock tokens are for this hackathon and are not real equities.
            They give no rights in any public company.
          </p>
        </section>

        <div className="tabs" role="tablist">
          <button
            className={mode === "demo" ? "tab on" : "tab"}
            onClick={() => setMode("demo")}
          >
            Interactive demo
          </button>
          <button
            className={mode === "live" ? "tab on" : "tab"}
            onClick={() => setMode("live")}
            disabled={!FACTORY}
            title={FACTORY ? "Use a wallet on Base Sepolia" : "No factory deployed on Base Sepolia yet"}
          >
            Wallet on Base Sepolia
          </button>
        </div>

        {mode === "live" && FACTORY ? (
          <Suspense fallback={<p className="muted">Loading wallet tools…</p>}>
            <LiveApp />
          </Suspense>
        ) : (
          <DemoApp />
        )}

        <HowItWorks />
      </main>
      <footer>
        Built by Mbanya Dev for Base Stocks Maxxing, Programmable Stock Markets
        track.{" "}
        <a href={REPO}>Source</a>
        {" · "}
        <a href={LIVE}>Live demo</a>
        . Any recorded demo is narrated by the builder in her own voice.
      </footer>
    </>
  );
}

function HowItWorks() {
  return (
    <section className="grid">
      <article className="card">
        <h2>How a circle works</h2>
        <ol>
          <li>Create a circle and list the members, or let people join before it starts.</li>
          <li>A member starts the circle. Everyone pays the same USDC amount each round.</li>
          <li>
            When the last payment lands, the pot is paid to that turn’s member,
            as USDC or as mock stock minted at a fixed demo price.
          </li>
          <li>
            On-time payments add +10 to a public reputation score, late payments
            subtract 15, and receiving a payout adds +20. A later circle can
            require a minimum score.
          </li>
        </ol>
      </article>
      <article className="card">
        <h2>Contracts</h2>
        <p>
          The Solidity factory, a mock USDC token with a faucet, and a per-circle
          mock stock token live in this repository. They are written for{" "}
          <strong>Base Sepolia</strong> only.
        </p>
        <p>
          Factory:{" "}
          {FACTORY ? (
            <a href={`${EXPLORER}/address/${FACTORY}`}><code>{FACTORY}</code></a>
          ) : (
            <code>not deployed yet — use the interactive demo</code>
          )}
        </p>
        {USDC && (
          <p>
            Mock USDC:{" "}
            <a href={`${EXPLORER}/address/${USDC}`}><code>{USDC}</code></a>
          </p>
        )}
      </article>
    </section>
  );
}

function DemoApp() {
  const [state, setState] = useState(() => loadState());
  const [account, setAccount] = useState(DEMO_ACCOUNTS[0].address);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    if (selected >= state.circles.length) setSelected(Math.max(0, state.circles.length - 1));
  }, [state.circles.length, selected]);

  function update(mutator) {
    setError("");
    setNotice("");
    try {
      const next = structuredClone(state);
      const result = mutator(next);
      setState(next);
      return result;
    } catch (err) {
      setError(friendlyError(err));
      return undefined;
    }
  }

  const circle = state.circles[selected];

  return (
    <>
      <AccountBar
        accounts={DEMO_ACCOUNTS}
        current={account}
        onSwitch={setAccount}
        usdc={getUsdc(state, account)}
        score={getReputation(state, account)}
        demo
      />
      <div className="toolbar">
        <button className="secondary" onClick={() => update((s) => faucet(s, account, DEMO_USDC))}>
          Get 1,000 mock USDC
        </button>
        <button
          className="ghost"
          onClick={() => {
            const next = loadSample(emptyState());
            setState(next);
            setSelected(0);
            setError("");
            setNotice("Loaded two sample circles: Bamenda Traders (stock) and Douala Market (USDC).");
          }}
        >
          Load sample circles
        </button>
        <button
          className="ghost"
          onClick={() => update((s) => advanceTime(s, circle ? Number(circle.period) : 120))}
        >
          Advance time by one period
        </button>
        <button
          className="ghost"
          onClick={() => {
            setState(emptyState());
            setSelected(0);
            setError("");
            setNotice("Demo reset.");
          }}
        >
          Reset demo
        </button>
      </div>
      {notice && <p className="ok">{notice}</p>}
      {error && <p className="err">{error}</p>}
      <div className="workspace">
        <CircleList
          circles={state.circles}
          selected={selected}
          onSelect={setSelected}
          recipientOf={currentRecipient}
        />
        {circle ? (
          <CircleDetail
            circle={circle}
            account={account}
            reputationOf={(addr) => getReputation(state, addr)}
            usdcOf={(addr) => getUsdc(state, addr)}
            stockOf={(addr) => getStockBalance(state, circle.stockToken, addr)}
            hasPaid={(addr, round) => hasPaid(state, circle.id, addr, round)}
            recipient={currentRecipient(circle)}
            due={dueAt(circle, circle.currentRound)}
            late={lateAfter(circle, circle.currentRound)}
            payouts={state.payouts.filter((p) => p.id === circle.id)}
            clock={state.useClock ? state.clock : Math.floor(Date.now() / 1000)}
            onJoin={() => update((s) => join(s, circle.id, account))}
            onStart={() => update((s) => start(s, circle.id, account))}
            onPay={() => update((s) => pay(s, circle.id, account))}
          />
        ) : (
          <section className="card empty">
            <h2>No circles yet</h2>
            <p>Load the sample circles, or create one below. Switch between Ama, Bih and Chi to pay as each member.</p>
          </section>
        )}
      </div>
      <CreateForm
        defaultMembers={DEMO_ACCOUNTS}
        account={account}
        onCreate={(input) => {
          const id = update((s) => createCircle(s, input, account));
          if (id !== undefined) {
            setSelected(id);
            setNotice(`Created “${input.name}”.`);
          }
        }}
      />
    </>
  );
}
