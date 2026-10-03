import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, http, maxUint256, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { buildRevokeTx, scanApprovals } from "../src/index.js";

// End-to-end: real anvil node, real contracts deployed by script/Seed.s.sol.
const PORT = 8546;
const RPC = `http://127.0.0.1:${PORT}`;
// anvil's first default account; a public test key, never use it on a real network.
const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const CONTRACTS_DIR = fileURLToPath(new URL("../../contracts", import.meta.url));

let anvil: ChildProcess;
const account = privateKeyToAccount(PK);
const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: foundry, transport: http(RPC) });

beforeAll(async () => {
  anvil = spawn("anvil", ["--port", String(PORT), "--silent"]);
  for (let i = 0; i < 50; i++) {
    try {
      await publicClient.getChainId();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  execFileSync("forge", ["script", "script/Seed.s.sol", "--rpc-url", RPC, "--broadcast", "--private-key", PK], {
    cwd: CONTRACTS_DIR,
    stdio: "ignore",
  });
}, 60_000);

afterAll(() => {
  anvil?.kill();
});

describe("scanApprovals against a seeded anvil chain", () => {
  it("finds exactly the live approvals and ignores revoked ones", async () => {
    const found = await scanApprovals(publicClient, account.address);
    const summary = found.map((a) => `${a.kind}:${a.risk}`).sort();
    expect(summary).toEqual(["erc20:high", "erc20:medium", "erc721-token:medium", "operator:high"]);

    const unlimited = found.find((a) => a.kind === "erc20" && a.risk === "high");
    expect(unlimited?.allowance).toBe(maxUint256);
    const limited = found.find((a) => a.kind === "erc20" && a.risk === "medium");
    expect(limited?.allowance).toBe(parseUnits("250", 18));
    expect(limited?.spenderIsContract).toBe(false);
  });

  it("revoking every approval leaves nothing to report", async () => {
    for (const a of await scanApprovals(publicClient, account.address)) {
      const hash = await walletClient.sendTransaction(buildRevokeTx(a));
      await publicClient.waitForTransactionReceipt({ hash });
    }
    expect(await scanApprovals(publicClient, account.address)).toEqual([]);
  });
});
