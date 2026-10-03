import { parseArgs } from "node:util";
import { isAddress } from "viem";
import { scanApprovals } from "@approval-guard/core";
import { describeAmount, publicClientFor, short, toJson } from "./shared.js";

const { values } = parseArgs({
  options: {
    owner: { type: "string" },
    rpc: { type: "string", default: process.env.RPC_URL ?? "http://127.0.0.1:8545" },
    "from-block": { type: "string", default: "0" },
    json: { type: "boolean", default: false },
  },
});

if (!values.owner || !isAddress(values.owner)) {
  console.error("Usage: pnpm scan --owner <address> [--rpc <url>] [--from-block <n>] [--json]");
  process.exit(1);
}

const client = publicClientFor(values.rpc);
const approvals = await scanApprovals(client, values.owner, { fromBlock: BigInt(values["from-block"]) });

if (values.json) {
  console.log(toJson(approvals));
} else if (approvals.length === 0) {
  console.log("No active approvals found.");
} else {
  console.log(`Active approvals for ${values.owner} (chain ${await client.getChainId()}):\n`);
  console.table(
    approvals.map((a) => ({
      risk: a.risk.toUpperCase(),
      type: a.kind,
      token: `${a.symbol} ${short(a.token)}`,
      spender: `${short(a.spender)}${a.spenderIsContract ? "" : " (EOA)"}`,
      amount: describeAmount(a),
      id: a.id,
    })),
  );
  for (const a of approvals) console.log(`- [${a.risk.toUpperCase()}] ${a.id}\n    ${a.reasons.join("\n    ")}`);
}
