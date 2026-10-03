import { createPublicClient, formatUnits, http, maxUint256, type Address } from "viem";
import type { ActiveApproval } from "@approval-guard/core";

// JSON-RPC batching: concurrent reads are grouped into one HTTP request.
export function publicClientFor(rpcUrl: string) {
  return createPublicClient({ transport: http(rpcUrl, { batch: true }) });
}

export function short(addr: Address): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function describeAmount(a: ActiveApproval): string {
  if (a.kind === "operator") return "ALL tokens";
  if (a.kind === "erc721-token") return `token #${a.tokenId}`;
  if (a.allowance === maxUint256) return "unlimited";
  return formatUnits(a.allowance ?? 0n, a.decimals ?? 18);
}

/** JSON.stringify cannot serialise bigint; render it as a decimal string. */
export function toJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}
