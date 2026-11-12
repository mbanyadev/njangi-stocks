const env = import.meta.env ?? {};
export const FACTORY = (env.VITE_FACTORY_ADDRESS || "").trim();
export const USDC = (env.VITE_USDC_ADDRESS || "").trim();
export const CHAIN_ID = 84532;
export const EXPLORER = "https://sepolia.basescan.org";
export const REPO = "https://github.com/mbanyadev/njangi-stocks";
export const LIVE = "https://mbanyadev.github.io/njangi-stocks/";

export const ON_TIME = 10;
export const LATE = -15;
export const COMPLETED = 20;

// Fixed demo accounts so the in-browser walkthrough needs no wallet.
export const DEMO_ACCOUNTS = [
  { name: "Ama", address: "0x1111111111111111111111111111111111111111" },
  { name: "Bih", address: "0x2222222222222222222222222222222222222222" },
  { name: "Chi", address: "0x3333333333333333333333333333333333333333" },
];

export const DEMO_USDC = 1_000n * 1_000_000n; // 1,000 USDC, 6 decimals
