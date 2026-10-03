import type { Address, PublicClient } from "viem";
import { toHex } from "viem";
import { erc20Abi, erc721Abi } from "./abi.js";
import { APPROVAL_FOR_ALL_TOPIC, APPROVAL_TOPIC, addressTopic, candidateId, candidatesFromLogs } from "./logs.js";
import { assessRisk } from "./risk.js";
import type { ActiveApproval, ApprovalCandidate, RpcLog } from "./types.js";

export type ScanOptions = {
  fromBlock?: bigint;
  /** Public RPC providers cap eth_getLogs ranges, so large scans are split into chunks. */
  blockChunk?: bigint;
};

/** Fetches every Approval / ApprovalForAll log where `owner` is the first indexed argument. */
export async function fetchApprovalLogs(
  client: PublicClient,
  owner: Address,
  { fromBlock = 0n, blockChunk = 50_000n }: ScanOptions = {},
): Promise<RpcLog[]> {
  const latest = await client.getBlockNumber();
  const logs: RpcLog[] = [];

  for (let start = fromBlock; start <= latest; start += blockChunk) {
    const end = start + blockChunk - 1n < latest ? start + blockChunk - 1n : latest;
    // Raw JSON-RPC call: topic0 may be either event; topic1 must equal the owner.
    // No address filter, so approvals on *any* token contract are found.
    const chunk = (await client.request({
      method: "eth_getLogs",
      params: [
        {
          fromBlock: toHex(start),
          toBlock: toHex(end),
          topics: [[APPROVAL_TOPIC, APPROVAL_FOR_ALL_TOPIC], addressTopic(owner)],
        },
      ],
    })) as RpcLog[];
    logs.push(...chunk);
  }
  return logs;
}

async function safeRead<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Checks one candidate against current chain state. Returns null if it is no longer active. */
async function resolveCandidate(
  client: PublicClient,
  owner: Address,
  c: ApprovalCandidate,
): Promise<ActiveApproval | null> {
  let allowance: bigint | undefined;
  let decimals: number | undefined;

  if (c.kind === "erc20") {
    allowance = await client.readContract({ address: c.token, abi: erc20Abi, functionName: "allowance", args: [owner, c.spender] });
    if (allowance === 0n) return null;
    decimals = await safeRead(() => client.readContract({ address: c.token, abi: erc20Abi, functionName: "decimals" }), 18);
  } else if (c.kind === "erc721-token") {
    // Transferring an NFT clears its approval without emitting an Approval event,
    // so both the owner and the approved address must be re-read.
    const [currentOwner, approved] = await Promise.all([
      safeRead(() => client.readContract({ address: c.token, abi: erc721Abi, functionName: "ownerOf", args: [c.tokenId] }), null),
      safeRead(() => client.readContract({ address: c.token, abi: erc721Abi, functionName: "getApproved", args: [c.tokenId] }), null),
    ]);
    if (currentOwner?.toLowerCase() !== owner.toLowerCase()) return null;
    if (approved?.toLowerCase() !== c.spender.toLowerCase()) return null;
  } else {
    const active = await client.readContract({ address: c.token, abi: erc721Abi, functionName: "isApprovedForAll", args: [owner, c.spender] });
    if (!active) return null;
  }

  const [symbol, code] = await Promise.all([
    safeRead(() => client.readContract({ address: c.token, abi: erc20Abi, functionName: "symbol" }), "???"),
    client.getCode({ address: c.spender }),
  ]);
  const spenderIsContract = code !== undefined && code !== "0x";
  const { risk, reasons } = assessRisk(c, { allowance, spenderIsContract });

  return { ...c, id: candidateId(c), symbol, allowance, decimals, spenderIsContract, risk, reasons };
}

const RISK_ORDER = { high: 0, medium: 1, low: 2 } as const;

/** Full pipeline: logs -> candidates -> live state -> risk-sorted active approvals. */
export async function scanApprovals(client: PublicClient, owner: Address, opts?: ScanOptions): Promise<ActiveApproval[]> {
  const logs = await fetchApprovalLogs(client, owner, opts);
  const candidates = candidatesFromLogs(logs);
  const resolved = await Promise.all(candidates.map((c) => resolveCandidate(client, owner, c)));
  return resolved
    .filter((a): a is ActiveApproval => a !== null)
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
}
