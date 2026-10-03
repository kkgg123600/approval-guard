import { describe, expect, it } from "vitest";
import { pad, toHex, type Hex } from "viem";
import { APPROVAL_FOR_ALL_TOPIC, APPROVAL_TOPIC, addressTopic, candidatesFromLogs } from "../src/logs.js";
import { UNLIMITED_THRESHOLD, assessRisk } from "../src/risk.js";
import type { RpcLog } from "../src/types.js";

const TOKEN = "0x1111111111111111111111111111111111111111";
const OWNER = "0x2222222222222222222222222222222222222222";
const SPENDER = "0x3333333333333333333333333333333333333333";
const OTHER = "0x4444444444444444444444444444444444444444";

const log = (topics: Hex[], data: Hex = "0x"): RpcLog => ({ address: TOKEN, topics, data, blockNumber: "0x1" });

describe("candidatesFromLogs", () => {
  it("tells ERC-20 and ERC-721 Approval apart by topic count", () => {
    const erc20 = log([APPROVAL_TOPIC, addressTopic(OWNER), addressTopic(SPENDER)], pad(toHex(5n)));
    const erc721 = log([APPROVAL_TOPIC, addressTopic(OWNER), addressTopic(SPENDER), pad(toHex(7n))]);
    const kinds = candidatesFromLogs([erc20, erc721]).map((c) => c.kind);
    expect(kinds).toEqual(["erc20", "erc721-token"]);
  });

  it("deduplicates repeated ERC-20 approvals to the same spender", () => {
    const a = log([APPROVAL_TOPIC, addressTopic(OWNER), addressTopic(SPENDER)], pad(toHex(1n)));
    expect(candidatesFromLogs([a, a, a])).toHaveLength(1);
  });

  it("keeps only the latest approved address for an ERC-721 tokenId", () => {
    const id = pad(toHex(1n));
    const first = log([APPROVAL_TOPIC, addressTopic(OWNER), addressTopic(SPENDER), id]);
    const second = log([APPROVAL_TOPIC, addressTopic(OWNER), addressTopic(OTHER), id]);
    const [c] = candidatesFromLogs([first, second]);
    expect(c?.spender.toLowerCase()).toBe(OTHER);
  });

  it("parses ApprovalForAll as an operator approval", () => {
    const l = log([APPROVAL_FOR_ALL_TOPIC, addressTopic(OWNER), addressTopic(SPENDER)], pad(toHex(1n)));
    expect(candidatesFromLogs([l])[0]?.kind).toBe("operator");
  });
});

describe("assessRisk", () => {
  const erc20 = { kind: "erc20", token: TOKEN, spender: SPENDER } as const;

  it("flags unlimited allowances as high", () => {
    expect(assessRisk(erc20, { allowance: UNLIMITED_THRESHOLD, spenderIsContract: true }).risk).toBe("high");
  });

  it("flags EOA spenders as at least medium", () => {
    expect(assessRisk(erc20, { allowance: 1n, spenderIsContract: false }).risk).toBe("medium");
  });

  it("rates a limited approval to a contract as low", () => {
    expect(assessRisk(erc20, { allowance: 1n, spenderIsContract: true }).risk).toBe("low");
  });

  it("always rates operator approvals as high", () => {
    const op = { kind: "operator", token: TOKEN, spender: SPENDER } as const;
    expect(assessRisk(op, { spenderIsContract: true }).risk).toBe("high");
  });
});

describe("revokeCalldata", () => {
  it("encodes approve(spender, 0) for ERC-20", async () => {
    const { revokeCalldata } = await import("../src/revoke.js");
    const data = revokeCalldata({ kind: "erc20", token: TOKEN, spender: SPENDER });
    // 0x095ea7b3 = bytes4(keccak256("approve(address,uint256)"))
    expect(data.slice(0, 10)).toBe("0x095ea7b3");
    expect(data.endsWith("0".repeat(64))).toBe(true);
  });

  it("encodes setApprovalForAll(operator, false) for operators", async () => {
    const { revokeCalldata } = await import("../src/revoke.js");
    const data = revokeCalldata({ kind: "operator", token: TOKEN, spender: SPENDER });
    expect(data.slice(0, 10)).toBe("0xa22cb465");
  });
});
