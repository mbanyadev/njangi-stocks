const MESSAGES = {
  BadArgs: "Check the name, members, contribution and period.",
  NotMember: "This account is not a member of the circle.",
  AlreadyMember: "This account is already in the circle.",
  AlreadyPaid: "This account has already paid this round.",
  NotStarted: "The circle has not started yet.",
  AlreadyStarted: "The circle has already started.",
  Closed: "This circle is finished.",
  TransferFailed: "Not enough USDC, or the transfer was rejected.",
  ReputationTooLow: "This account's reputation is too low to join or start this circle.",
};

export function friendlyError(err) {
  const text = [
    err?.code,
    err?.shortMessage,
    err?.message,
    err?.cause?.name,
    err?.name,
    String(err ?? ""),
  ]
    .filter(Boolean)
    .join(" ");
  for (const [code, message] of Object.entries(MESSAGES)) {
    if (text.includes(code)) return message;
  }
  if (/user rejected|denied|User rejected/i.test(text)) return "The wallet rejected the request.";
  if (/switch.*chain|Chain not configured|correct network/i.test(text)) {
    return "Switch your wallet to Base Sepolia and try again.";
  }
  return err?.shortMessage || err?.message || "Something went wrong.";
}
