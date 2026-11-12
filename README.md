# Njangi Stocks

A rotating savings circle on Base, built for the [Stocks Maxxing](https://www.base.org/stocksmaxxing) season, **Programmable Stock Markets** track.

Friends, traders or colleagues pay a fixed amount in USDC on a schedule. When the round is complete, the member whose turn it is receives the pot in USDC, or as fractional mock stock tokens (a testnet stand-in for a tokenized stock). Reputation is public. There is no human treasurer.

**This is a demo.** It is not an offer or solicitation to buy any security, including any tokenized stock. It is not available to US persons. Projects that enable trading for US users are out of scope for this season. The mock stock token is not real equity and has no rights in any public company.

Builder: **Mbanya Dev**. Local scaffold only until Maureen approves a public GitHub repo and a push.

Live app (once Pages is enabled): `https://mbanyadev.github.io/njangi-stocks/`

## Status

Contracts and a web UI have been scaffolded. They have not been deployed to Base Sepolia yet, and this repo has not been pushed.

## Repo layout

- `contracts/src/NjangiStocksFactory.sol` — create a circle, join, start, pay, automatic payout, reputation
- `contracts/src/MockStockToken.sol` — testnet stock stand-in, minted by the factory at a fixed demo price
- `contracts/src/MockUsdc.sol` — 6-decimal testnet USDC with a faucet, so the demo does not depend on a public faucet
- `web/` — Vite + React app, with a US-person gate on the first screen

## Contracts, in brief

A circle needs at least two members, a contribution amount, and a period. Payout is either `Usdc` or `Stock`. In the stock path, the factory deploys a mock stock token and, when a round is fully paid, mints shares to the current recipient at `stockPrice` instead of transferring the USDC. Payments after the due date plus one period are late (`-15` reputation); on-time payments are `+10`; receiving a payout is `+20`.

## Develop

Contracts (once [Foundry](https://book.getfoundry.sh/getting-started/installation) is installed):

```bash
forge build
# after installing forge-std into lib/:
# forge test
```

Web:

```bash
cd web
npm install
npm run dev
```

Set `VITE_FACTORY_ADDRESS` in `web/.env.local` after a Sepolia deploy. The Vite base path is `/njangi-stocks/` for GitHub Pages.

Deploy only to **Base Sepolia** unless Maureen has approved a mainnet deploy. Do not spend her funds.

## Demo video

Any demo for the Base submission will be narrated by the builder in her own voice. No AI voiceover.
