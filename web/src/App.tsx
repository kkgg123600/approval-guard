import { useState } from "react";
import { useAccount, useChainId, useChains, useConnect, useDisconnect, usePublicClient, useSwitchChain } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { scanApprovals } from "@approval-guard/core";
import { ApprovalRow } from "./ApprovalRow";

export function App() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const chains = useChains();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const [fromBlock, setFromBlock] = useState("0");

  // Cached per (chain, owner, start block); revoke rows invalidate it after a confirmed tx.
  const scan = useQuery({
    queryKey: ["approvals", chainId, address, fromBlock],
    enabled: isConnected && !!publicClient && !!address,
    queryFn: () => scanApprovals(publicClient!, address!, { fromBlock: BigInt(fromBlock || "0") }),
  });

  return (
    <main>
      <header>
        <h1>Approval Guard</h1>
        <p className="muted">Finds token approvals your wallet has granted that are still active, and revokes them.</p>
      </header>

      {!isConnected ? (
        <section className="card">
          {connectors.map((c) => (
            <button key={c.uid} onClick={() => connect({ connector: c })}>
              Connect {c.name}
            </button>
          ))}
          {connectError && <p className="error">{connectError.message}</p>}
        </section>
      ) : (
        <section className="card toolbar">
          <span className="mono">{address}</span>
          <select value={chainId} onChange={(e) => switchChain({ chainId: Number(e.target.value) as typeof chainId })}>
            {chains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label>
            from block{" "}
            <input value={fromBlock} inputMode="numeric" onChange={(e) => setFromBlock(e.target.value.replace(/\D/g, ""))} />
          </label>
          <button onClick={() => scan.refetch()} disabled={scan.isFetching}>
            {scan.isFetching ? "Scanning..." : "Rescan"}
          </button>
          <button className="secondary" onClick={() => disconnect()}>
            Disconnect
          </button>
        </section>
      )}

      {scan.error && <p className="error">Scan failed: {scan.error.message}</p>}

      {scan.data && (
        <section className="card">
          <h2>
            {scan.data.length} active approval{scan.data.length === 1 ? "" : "s"}
          </h2>
          {scan.data.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Token</th>
                  <th>Spender</th>
                  <th>Amount</th>
                  <th>Why</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {scan.data.map((a) => (
                  <ApprovalRow key={a.id} approval={a} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
