import type { Address, Hex } from "viem";

export type ApprovalKind = "erc20" | "erc721-token" | "operator";
export type RiskLevel = "high" | "medium" | "low";

/** A candidate approval reconstructed from event logs, before checking live state. */
export type ApprovalCandidate =
  | { kind: "erc20"; token: Address; spender: Address }
  | { kind: "erc721-token"; token: Address; spender: Address; tokenId: bigint }
  | { kind: "operator"; token: Address; spender: Address };

/** An approval confirmed to still be active on-chain. */
export type ActiveApproval = ApprovalCandidate & {
  id: string;
  symbol: string;
  /** ERC-20 only: current allowance in base units. */
  allowance?: bigint;
  decimals?: number;
  spenderIsContract: boolean;
  risk: RiskLevel;
  reasons: string[];
};

/** A raw log as returned by eth_getLogs. */
export type RpcLog = {
  address: Address;
  topics: Hex[];
  data: Hex;
  blockNumber: Hex | null;
};
