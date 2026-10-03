# Approval Guard

Finds the token approvals a wallet has granted that are **still active**, rates how
dangerous each one is, and revokes them — from a CLI or a React DApp.

Stale approvals are one of the most common ways users lose funds: an approval made
for a single swap stays valid forever, so if the spender is later compromised (or
was a phishing contract from the start) it can pull the user's tokens at any time,
including tokens received long after the approval was given.

## What it detects

| Approval | Standard | Default risk |
|---|---|---|
| `approve(spender, amount)` — unlimited (>= 2^128) | ERC-20 | high |
| `setApprovalForAll(operator, true)` | ERC-721 / ERC-1155 | high |
| any approval to an address with no code (EOA) | all | at least medium |
| `approve(spender, amount)` — limited, contract spender | ERC-20 | low |
| `approve(to, tokenId)` | ERC-721 | low (medium if EOA) |

## How it works

```
eth_getLogs (Approval / ApprovalForAll, topic1 = owner)
        |
        v
candidatesFromLogs   de-duplicate; ERC-20 vs ERC-721 told apart by topic count
        |
        v
resolveCandidate     re-read live state: allowance / getApproved + ownerOf / isApprovedForAll
        |
        v
assessRisk           unlimited? operator? EOA spender?
        |
        v
buildRevokeTx        approve(spender, 0) | approve(0x0, tokenId) | setApprovalForAll(op, false)
```

Points worth knowing:

- **Logs are history, not state.** An approval found in the logs may already have
  been revoked, spent, or — for NFTs — cleared by a transfer, which in
  OpenZeppelin v5 resets `getApproved` *without* emitting an `Approval` event.
  Every candidate is therefore re-checked on-chain before it is reported.
- **ERC-20 and ERC-721 share the `Approval(address,address,uint256)` signature.**
  They are told apart by the number of topics: ERC-721 indexes `tokenId`, so its
  logs have 4 topics instead of 3.
- **No token list is needed.** The log query filters on topic0 and the owner only,
  so approvals on any token contract are found.
- **RPC-aware.** Log queries are split into block ranges (providers cap
  `eth_getLogs`), and reads use JSON-RPC batching.

## Layout

```
contracts/   Foundry: demo ERC-20 / ERC-721, a "router" spender, risk tests, seed script
core/        TypeScript library (viem): log scanning, state checks, risk rules, revoke calldata
cli/         `scan` and `revoke` commands
web/         React + Vite + wagmi DApp (MetaMask), local anvil and Sepolia
```

## Quick start (local chain)

Requirements: Node 20+, pnpm, Foundry.

```bash
git clone --recursive <repo-url> && cd approval-guard
pnpm install

# 1. local chain
anvil

# 2. deploy demo contracts and create approvals (anvil default key #0)
cd contracts
forge script script/Seed.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
cd ..

# 3. scan
pnpm scan --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# 4. revoke everything rated high (key read from the environment only)
PRIVATE_KEY=0xac09... pnpm revoke --min-risk high --dry-run
PRIVATE_KEY=0xac09... pnpm revoke --min-risk high

# 5. or use the DApp: import the anvil key into MetaMask, add network
#    http://127.0.0.1:8545 (chain id 31337), then
pnpm web
```

The anvil key above is a public test key. Never send real funds to it.

## Tests

```bash
cd contracts && forge test   # approval risk scenarios against the demo contracts
pnpm test                    # unit tests + end-to-end test on a fresh anvil node
pnpm typecheck
```

The end-to-end test starts anvil, runs the seed script, checks that the scanner
reports exactly the four live approvals (and none of the revoked ones), revokes them
all, and checks that a rescan comes back empty.

## Limitations

- **Permit2 / off-chain signatures** are not covered: Permit2 allowances live in the
  Permit2 contract rather than the token, and unsigned-but-leaked permits leave no log.
- **Risk rules are heuristics.** An EOA spender is usually suspicious but not always;
  a limited approval to a malicious contract is still dangerous.
- **Full-history scans** on public RPCs are slow; use `--from-block` (CLI) or the
  "from block" field (DApp) to start from the wallet's first activity.
- Tokens that emit non-standard events are skipped.

## License

MIT
