# Njangi Stocks

A rotating savings circle on [Base](https://www.base.org/), built for the [Stocks Maxxing](https://www.base.org/stocksmaxxing) season, **Programmable Stock Markets** track.

Friends, traders or colleagues pay a fixed amount in USDC on a schedule. When the round is complete, the member whose turn it is receives the pot in USDC, or as fractional mock stock tokens (a testnet stand-in for a tokenized stock, minted at a fixed demo price). Reputation is public and can gate a later circle. There is no human treasurer.

**Live demo:** https://mbanyadev.github.io/njangi-stocks/

Builder: **Mbanya Dev**.

## This is a demo

It is not an offer or solicitation to buy any security, including any tokenized stock. It is not available to US persons. Projects that enable trading for US users are out of scope for this season. The mock stock token is not real equity and has no rights in any public company.

The first screen of the app checks region and asks for a confirmation before anyone can use the demo. That is a demo-level block, not legal advice.

## Try it (do this, see that)

The live site runs a full in-browser demo of the same rules as the Solidity contracts, so you can walk the happy path without a wallet or testnet gas.

1. Confirm you are not a US person and enter the demo.
2. Click **Load sample circles**. You will see *Bamenda Traders* (stock payout) and *Douala Market* (USDC payout).
3. You start as **Ama**. Open *Bamenda Traders* and click **Start circle**.
4. Click **Pay 25 USDC**, then switch to **Bih** and pay, then **Chi** and pay.
5. When Chi’s payment lands, the pot buys mock stock at 25 USDC a share and **Ama receives 3 nSTOCK**. Each on-time payment is +10 reputation; Ama also gets +20 for the payout.
6. Open *Douala Market* to see the same flow pay out in USDC instead. Use **Advance time by one period** twice, then pay, to see a late payment (−15).

If a factory is later deployed to Base Sepolia, the **Wallet on Base Sepolia** tab will talk to those contracts. Until then that tab stays off, and the interactive demo is the way to try the product.

## How a circle works

1. Create a circle with at least two members, a contribution, a period, and a payout kind (USDC or mock stock). You can also set a minimum reputation score.
2. Other people may join until a member starts the circle. Starting fails if any listed member is below the minimum score.
3. Each member pays the same USDC amount for the current round. A payment is late after the due time plus one period of grace.
4. When the last payment of the round lands, the contract pays the member whose turn it is:
   - **USDC:** the pot is transferred to that member.
   - **Stock:** the pot is locked in the factory (a demo “purchase”) and the factory mints fractional mock shares to that member at the circle’s fixed price.
5. After the last member has received a payout, the circle closes.

Reputation: **+10** on time, **−15** late, **+20** for receiving a payout.

## Repo layout

- `contracts/src/NjangiStocksFactory.sol` — create, join, start, pay, automatic payout, reputation gate
- `contracts/src/MockStockToken.sol` — testnet stock stand-in, minted by the factory
- `contracts/src/MockUsdc.sol` — 6-decimal testnet USDC with a faucet
- `contracts/test/` — Foundry tests for the happy path, stock minting, late payments, and the reputation gate
- `contracts/script/Deploy.s.sol` — Base Sepolia deploy script (reads `PRIVATE_KEY` from the environment; never commit a key)
- `web/` — Vite + React app, with a US-person gate, an interactive demo, and a wallet tab for Base Sepolia

## Develop

Contracts, with [Foundry](https://book.getfoundry.sh/getting-started/installation):

```bash
git clone --recursive https://github.com/mbanyadev/njangi-stocks.git
# or, after a normal clone:
forge install
forge test
```

Web:

```bash
cd web
npm install
npm run dev
```

The Vite base path is `/njangi-stocks/` for GitHub Pages. After a Sepolia deploy, set `VITE_FACTORY_ADDRESS` and `VITE_USDC_ADDRESS` in `web/.env.local` (that file is gitignored) and rebuild.

To publish the web app:

```bash
./scripts/deploy-pages.sh
```

Deploy only to **Base Sepolia** unless a mainnet deploy has been approved. Do not spend mainnet funds. Do not commit private keys, `.env` files, or keystores.

## Demo video

Any demo for the Base submission will be narrated by the builder in her own voice. No AI voiceover.
