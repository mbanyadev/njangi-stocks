import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { factoryAbi, stockAbi, usdcAbi } from "./abi.js";
import { CHAIN_ID, DEMO_USDC, FACTORY, USDC } from "./config.js";
import { friendlyError } from "./errors.js";
import { formatScore, formatUsdc, shortAddr } from "./format.js";
import { CircleDetail, CircleList, CreateForm } from "./ui.jsx";
import { wagmiConfig } from "./wagmi.js";

const queryClient = new QueryClient();

export default function LiveRoot() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <LiveApp />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function LiveApp() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync, isPending: writing } = useWriteContract();
  const [chainId, setChainId] = useState(undefined);
  const [bundle, setBundle] = useState(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window !== "undefined" && window.ethereum?.request) {
          const id = await window.ethereum.request({ method: "eth_chainId" });
          if (!cancelled) setChainId(Number(id));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  async function refresh() {
    if (!publicClient) return;
    const count = Number(
      await publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: "circleCount" })
    );
    const circles = [];
    for (let id = 0; id < count; id += 1) {
      const view = await publicClient.readContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "getCircle",
        args: [BigInt(id)],
      });
      const members = await publicClient.readContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "membersOf",
        args: [BigInt(id)],
      });
      const recipient = await publicClient.readContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "currentRecipient",
        args: [BigInt(id)],
      });
      const due =
        view.started && view.currentRound
          ? await publicClient.readContract({
              address: FACTORY,
              abi: factoryAbi,
              functionName: "dueAt",
              args: [BigInt(id), view.currentRound],
            })
          : 0n;
      const late =
        view.started && view.currentRound
          ? await publicClient.readContract({
              address: FACTORY,
              abi: factoryAbi,
              functionName: "lateAfter",
              args: [BigInt(id), view.currentRound],
            })
          : 0n;
      const paid = {};
      const reps = {};
      const usdcBal = {};
      const stockBal = {};
      for (const m of members) {
        paid[m.toLowerCase()] = await publicClient.readContract({
          address: FACTORY,
          abi: factoryAbi,
          functionName: "hasPaid",
          args: [BigInt(id), m, view.currentRound || 1n],
        });
        reps[m.toLowerCase()] = await publicClient.readContract({
          address: FACTORY,
          abi: factoryAbi,
          functionName: "reputation",
          args: [m],
        });
        usdcBal[m.toLowerCase()] = await publicClient.readContract({
          address: USDC,
          abi: usdcAbi,
          functionName: "balanceOf",
          args: [m],
        });
        if (view.stockToken && view.stockToken !== "0x0000000000000000000000000000000000000000") {
          stockBal[m.toLowerCase()] = await publicClient.readContract({
            address: view.stockToken,
            abi: stockAbi,
            functionName: "balanceOf",
            args: [m],
          });
        }
      }
      circles.push({
        id,
        name: view.name,
        members: members.map((m) => m.toLowerCase()),
        contribution: view.contribution.toString(),
        period: Number(view.period),
        startTime: Number(view.startTime),
        currentRound: Number(view.currentRound),
        payoutKind: Number(view.payoutKind),
        stockToken: view.stockToken,
        stockPrice: view.stockPrice.toString(),
        minReputation: Number(view.minReputation),
        started: view.started,
        closed: view.closed,
        recipient,
        due: Number(due),
        late: Number(late),
        paid,
        reps,
        usdcBal,
        stockBal,
      });
    }
    let myUsdc = 0n;
    let myScore = 0;
    if (address) {
      myUsdc = await publicClient.readContract({
        address: USDC,
        abi: usdcAbi,
        functionName: "balanceOf",
        args: [address],
      });
      myScore = Number(
        await publicClient.readContract({
          address: FACTORY,
          abi: factoryAbi,
          functionName: "reputation",
          args: [address],
        })
      );
    }
    setBundle({ circles, myUsdc, myScore });
  }

  useEffect(() => {
    refresh().catch((err) => setError(friendlyError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, address]);

  async function send(label, fn) {
    setError("");
    setNotice("");
    setBusy(label);
    try {
      if (chainId && chainId !== CHAIN_ID) {
        await switchChain({ chainId: CHAIN_ID });
      }
      await fn();
      setNotice(`${label} confirmed.`);
      await refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy("");
    }
  }

  const injected = connectors.find((c) => c.id === "injected") || connectors[0];
  const onRightChain = !chainId || chainId === CHAIN_ID;
  const circles = bundle?.circles ?? [];
  const circle = circles[selected];

  return (
    <>
      <div className="account-bar card">
        {isConnected ? (
          <>
            <div>
              <strong>{shortAddr(address)}</strong>
              <div className="muted">
                {formatUsdc(bundle?.myUsdc ?? 0)} · reputation {formatScore(bundle?.myScore ?? 0)}
              </div>
            </div>
            <div className="row">
              {!onRightChain && (
                <button className="secondary" disabled={switching} onClick={() => switchChain({ chainId: CHAIN_ID })}>
                  Switch to Base Sepolia
                </button>
              )}
              <button className="ghost" onClick={() => disconnect()}>
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Connect an injected wallet on Base Sepolia to create a circle or pay in.</p>
            <button disabled={connecting || !injected} onClick={() => connect({ connector: injected, chainId: CHAIN_ID })}>
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          </>
        )}
      </div>
      <div className="toolbar">
        <button
          className="secondary"
          disabled={!isConnected || !!busy || writing}
          onClick={() =>
            send("Faucet", async () => {
              const hash = await writeContractAsync({
                address: USDC,
                abi: usdcAbi,
                functionName: "faucet",
                args: [DEMO_USDC],
                chainId: CHAIN_ID,
              });
              await publicClient.waitForTransactionReceipt({ hash });
            })
          }
        >
          {busy === "Faucet" ? "Minting…" : "Get 1,000 mock USDC"}
        </button>
        <button className="ghost" onClick={() => refresh().catch((err) => setError(friendlyError(err)))}>
          Refresh
        </button>
      </div>
      {notice && <p className="ok">{notice}</p>}
      {error && <p className="err">{error}</p>}
      <div className="workspace">
        <CircleList
          circles={circles}
          selected={selected}
          onSelect={setSelected}
          recipientOf={(c) => c.recipient}
        />
        {circle ? (
          <CircleDetail
            circle={circle}
            account={address || ""}
            reputationOf={(addr) => Number(circle.reps[addr.toLowerCase()] ?? 0)}
            usdcOf={(addr) => circle.usdcBal[addr.toLowerCase()] ?? 0n}
            stockOf={(addr) => circle.stockBal[addr.toLowerCase()] ?? 0n}
            hasPaid={(addr, round) => Boolean(circle.paid[addr.toLowerCase()]) && !!round}
            recipient={circle.recipient}
            due={circle.due}
            late={circle.late}
            payouts={[]}
            clock={Math.floor(Date.now() / 1000)}
            onJoin={() =>
              send("Join", async () => {
                const hash = await writeContractAsync({
                  address: FACTORY,
                  abi: factoryAbi,
                  functionName: "join",
                  args: [BigInt(circle.id)],
                  chainId: CHAIN_ID,
                });
                await publicClient.waitForTransactionReceipt({ hash });
              })
            }
            onStart={() =>
              send("Start", async () => {
                const hash = await writeContractAsync({
                  address: FACTORY,
                  abi: factoryAbi,
                  functionName: "start",
                  args: [BigInt(circle.id)],
                  chainId: CHAIN_ID,
                });
                await publicClient.waitForTransactionReceipt({ hash });
              })
            }
            onPay={() =>
              send("Pay", async () => {
                const allowance = await publicClient.readContract({
                  address: USDC,
                  abi: usdcAbi,
                  functionName: "allowance",
                  args: [address, FACTORY],
                });
                if (allowance < BigInt(circle.contribution)) {
                  const approveHash = await writeContractAsync({
                    address: USDC,
                    abi: usdcAbi,
                    functionName: "approve",
                    args: [FACTORY, 2n ** 256n - 1n],
                    chainId: CHAIN_ID,
                  });
                  await publicClient.waitForTransactionReceipt({ hash: approveHash });
                }
                const hash = await writeContractAsync({
                  address: FACTORY,
                  abi: factoryAbi,
                  functionName: "pay",
                  args: [BigInt(circle.id)],
                  chainId: CHAIN_ID,
                });
                await publicClient.waitForTransactionReceipt({ hash });
              })
            }
          />
        ) : (
          <section className="card empty">
            <h2>No on-chain circles yet</h2>
            <p>Create one below after you connect on Base Sepolia and mint mock USDC.</p>
          </section>
        )}
      </div>
      <CreateForm
        account={address}
        onCreate={(input) =>
          send("Create circle", async () => {
            const hash = await writeContractAsync({
              address: FACTORY,
              abi: factoryAbi,
              functionName: "createCircle",
              args: [
                input.name,
                input.members,
                BigInt(input.contribution),
                BigInt(input.period),
                Number(input.payoutKind),
                BigInt(input.stockPrice || 0),
                BigInt(input.minReputation || 0),
              ],
              chainId: CHAIN_ID,
            });
            await publicClient.waitForTransactionReceipt({ hash });
            await refresh();
            setSelected(Number((await publicClient.readContract({
              address: FACTORY,
              abi: factoryAbi,
              functionName: "circleCount",
            })) - 1n));
          })
        }
      />
    </>
  );
}
