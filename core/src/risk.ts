import type { ApprovalCandidate, RiskLevel } from "./types.js";

// Allowances at or above 2^128 are treated as "unlimited". Wallets and dApps
// usually request type(uint256).max, but some use other huge sentinel values.
export const UNLIMITED_THRESHOLD = 2n ** 128n;

export function assessRisk(
  c: ApprovalCandidate,
  ctx: { allowance?: bigint; spenderIsContract: boolean },
): { risk: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  let risk: RiskLevel = "low";
  const raise = (level: RiskLevel) => {
    const order = { low: 0, medium: 1, high: 2 };
    if (order[level] > order[risk]) risk = level;
  };

  if (c.kind === "erc20" && ctx.allowance !== undefined && ctx.allowance >= UNLIMITED_THRESHOLD) {
    raise("high");
    reasons.push("Unlimited allowance: covers the current balance and any future deposits.");
  }
  if (c.kind === "operator") {
    raise("high");
    reasons.push("Operator approval: the spender can move every token in this collection, including ones received later.");
  }
  if (!ctx.spenderIsContract) {
    raise("medium");
    reasons.push("Spender is an EOA (no code). Legitimate protocols are contracts; EOA approvals are typical of phishing.");
  }
  if (reasons.length === 0) reasons.push("Limited approval to a contract.");
  return { risk, reasons };
}
