import { encodeFunctionData, zeroAddress, type Address, type Hex } from "viem";
import { revokeAbi } from "./abi.js";
import type { ApprovalCandidate } from "./types.js";

export type RevokeTx = { to: Address; data: Hex };

/** ABI-encoded calldata that cancels the approval when sent by its owner. */
export function revokeCalldata(a: ApprovalCandidate): Hex {
  switch (a.kind) {
    case "erc20":
      return encodeFunctionData({ abi: revokeAbi, functionName: "approve", args: [a.spender, 0n] });
    case "erc721-token":
      // Per-token approvals are cleared by approving the zero address.
      return encodeFunctionData({ abi: revokeAbi, functionName: "approve", args: [zeroAddress, a.tokenId] });
    case "operator":
      return encodeFunctionData({ abi: revokeAbi, functionName: "setApprovalForAll", args: [a.spender, false] });
  }
}

/**
 * The transaction that cancels an approval. It can be passed unchanged to viem's
 * walletClient.sendTransaction or wagmi's sendTransaction.
 */
export function buildRevokeTx(a: ApprovalCandidate): RevokeTx {
  return { to: a.token, data: revokeCalldata(a) };
}
