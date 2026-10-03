import { parseArgs } from "node:util";
import { createWalletClient, http, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildRevokeTx, scanApprovals, type RiskLevel } from "@approval-guard/core";
import { publicClientFor } from "./shared.js";

const { values } = parseArgs({
  options: {
    rpc: { type: "string", default: process.env.RPC_URL ?? "http://127.0.0.1:8545" },
    id: { type: "string", multiple: true },
    "min-risk": { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

// The key comes from the environment only, so it never lands in shell history.
const pk = process.env.PRIVATE_KEY;
if (!pk || !isHex(pk)) {
  console.error("Set PRIVATE_KEY in the environment (the owner of the approvals).");
  process.exit(1);
}
if (!values.id && !values["min-risk"]) {
  console.error("Usage: pnpm revoke (--id <approval-id>... | --min-risk high|medium|low) [--dry-run] [--rpc <url>]");
  process.exit(1);
}

const account = privateKeyToAccount(pk);
const publicClient = publicClientFor(values.rpc);
const wallet = createWalletClient({ account, transport: http(values.rpc) });

const order: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const minRisk = values["min-risk"] as RiskLevel | undefined;
const approvals = (await scanApprovals(publicClient, account.address)).filter(
  (a) => values.id?.includes(a.id) || (minRisk !== undefined && order[a.risk] >= order[minRisk]),
);

if (approvals.length === 0) {
  console.log("Nothing to revoke.");
  process.exit(0);
}

for (const a of approvals) {
  const tx = buildRevokeTx(a);
  if (values["dry-run"]) {
    console.log(`[dry-run] ${a.id}\n  to:   ${tx.to}\n  data: ${tx.data}`);
    continue;
  }
  // Simulate first: a revert here costs nothing, a revert on-chain costs gas.
  await publicClient.call({ account: account.address, to: tx.to, data: tx.data });
  // chain: null lets viem read the chain id from the RPC instead of a hardcoded chain.
  const hash = await wallet.sendTransaction({ ...tx, chain: null });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`revoked ${a.id}  tx ${hash}  status ${receipt.status}`);
}
