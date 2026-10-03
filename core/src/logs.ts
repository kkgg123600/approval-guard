import { getAddress, hexToBigInt, keccak256, pad, toBytes, type Hex } from "viem";
import type { ApprovalCandidate, RpcLog } from "./types.js";

// topic0 is the keccak256 hash of the event signature.
// ERC-20 and ERC-721 emit the *same* signature for Approval; they differ only in
// which parameters are indexed (ERC-721 indexes tokenId, so it has 4 topics).
export const APPROVAL_TOPIC = keccak256(toBytes("Approval(address,address,uint256)"));
export const APPROVAL_FOR_ALL_TOPIC = keccak256(toBytes("ApprovalForAll(address,address,bool)"));

/** Left-pads an address to a 32-byte topic so it can be used as a log filter. */
export function addressTopic(address: Hex): Hex {
  return pad(address.toLowerCase() as Hex, { size: 32 });
}

function topicToAddress(topic: Hex): `0x${string}` {
  return getAddress(`0x${topic.slice(26)}`);
}

/**
 * Turns raw logs into a de-duplicated list of approvals that *might* still be active.
 * Logs only tell us what happened; the live state is checked separately, because
 * later events (revokes, transfers) can cancel an approval.
 */
export function candidatesFromLogs(logs: RpcLog[]): ApprovalCandidate[] {
  const seen = new Map<string, ApprovalCandidate>();

  for (const log of logs) {
    const [topic0, , t2, t3] = log.topics;
    if (!topic0 || !t2) continue;
    const token = getAddress(log.address);
    const spender = topicToAddress(t2);

    if (topic0 === APPROVAL_FOR_ALL_TOPIC) {
      seen.set(`operator:${token}:${spender}`, { kind: "operator", token, spender });
    } else if (topic0 === APPROVAL_TOPIC && log.topics.length === 3) {
      seen.set(`erc20:${token}:${spender}`, { kind: "erc20", token, spender });
    } else if (topic0 === APPROVAL_TOPIC && log.topics.length === 4 && t3) {
      const tokenId = hexToBigInt(t3);
      // One approved address per tokenId: a newer log replaces the older one.
      seen.set(`erc721:${token}:${tokenId}`, { kind: "erc721-token", token, spender, tokenId });
    }
  }
  return [...seen.values()];
}

export function candidateId(c: ApprovalCandidate): string {
  return c.kind === "erc721-token"
    ? `${c.kind}:${c.token}:${c.tokenId}`
    : `${c.kind}:${c.token}:${c.spender}`;
}

