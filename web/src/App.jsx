import { useState } from "react";

const FACTORY = import.meta.env.VITE_FACTORY_ADDRESS || "";

export default function App() {
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);

  if (!allowed) {
    return (
      <div className="gate">
        <h1>Before you continue</h1>
        <p>
          Njangi Stocks is a Base Sepolia demo of a rotating savings circle that can
          pay out in USDC or in a <em>mock</em> fractional stock token. It is not
          an offer or solicitation to buy any security, including any tokenized
          stock, and it is not available to US persons.
        </p>
        <p>
          You must not use this app if you are a US person, are located in the
          United States, or would be using it to trade tokenized stocks for US
          users.
        </p>
        <label>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ width: "auto", marginRight: "0.5rem" }}
          />
          I confirm I am not a US person and I am not using this app from the
          United States.
        </label>
        <p>
          <button disabled={!checked} onClick={() => setAllowed(true)}>
            Enter the demo
          </button>
        </p>
      </div>
    );
  }

  return (
    <>
      <header>
        <strong>Njangi Stocks</strong>
        <span>Base Sepolia demo · Mbanya Dev</span>
      </header>
      <main>
        <section className="hero">
          <h1>A savings circle that can hold a share of a stock, without a treasurer.</h1>
          <p>
            Friends, traders or colleagues in Cameroon and similar African markets
            pay a fixed amount in USDC on a schedule. When the round is complete,
            the member whose turn it is receives the pot in USDC, or as fractional
            mock stock tokens. The contract is the treasurer.
          </p>
          <p className="banner">
            Demo only, on Base Sepolia. Not available to US persons. Not an offer
            of securities. Mock stock tokens are for the hackathon demo and are
            not real equities.
          </p>
        </section>

        <section className="grid">
          <article className="card">
            <h2>How a circle works</h2>
            <ol>
              <li>Create a circle and list the members.</li>
              <li>Everyone pays the same USDC amount each round.</li>
              <li>
                When the last payment lands, the pot is paid to that turn’s
                member, as USDC or as mock stock.
              </li>
              <li>On-time and late payments update a public reputation score.</li>
            </ol>
          </article>
          <article className="card">
            <h2>Contract</h2>
            <p>
              Network: Base Sepolia. Factory:{" "}
              {FACTORY ? <code>{FACTORY}</code> : <code>not deployed yet</code>}.
            </p>
            <p>
              Wallet connect and live circle actions land once the factory is
              deployed. The contracts are in this repo under <code>contracts/</code>.
            </p>
          </article>
        </section>

        <CreateCirclePreview />
      </main>
      <footer>
        Built by Mbanya Dev for Base Stocks Maxxing, Programmable Stock Markets
        track. Source will be public on GitHub under mbanyadev when the repo is
        pushed.
      </footer>
    </>
  );
}

function CreateCirclePreview() {
  return (
    <section className="card">
      <h2>Start a circle (UI scaffold)</h2>
      <p>
        This form is the shape of the create flow. It does not send a
        transaction until a factory address is configured.
      </p>
      <label htmlFor="name">Circle name</label>
      <input id="name" placeholder="Bamenda Traders" disabled={!FACTORY} />
      <label htmlFor="amount">Contribution (USDC)</label>
      <input id="amount" placeholder="25" disabled={!FACTORY} />
      <label htmlFor="kind">Payout</label>
      <select id="kind" disabled={!FACTORY} defaultValue="stock">
        <option value="usdc">USDC</option>
        <option value="stock">Fractional mock stock</option>
      </select>
      <p>
        <button className="secondary" disabled={!FACTORY}>
          {FACTORY ? "Create circle" : "Waiting for a deployed factory"}
        </button>
      </p>
    </section>
  );
}
