import { useEffect } from "react";
import { formatUnits, maxUint256 } from "viem";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { buildRevokeTx, type ActiveApproval } from "@approval-guard/core";

const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

function amount(a: ActiveApproval): string {
  if (a.kind === "operator") return "All tokens";
  if (a.kind === "erc721-token") return `#${a.tokenId}`;
  if (a.allowance === maxUint256) return "Unlimited";
  return formatUnits(a.allowance ?? 0n, a.decimals ?? 18);
}

export function ApprovalRow({ approval: a }: { approval: ActiveApproval }) {
  const queryClient = useQueryClient();
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();
  const receipt = useWaitForTransactionReceipt({ hash });

  // Rescan once the revoke is mined, so the table reflects chain state, not optimism.
  useEffect(() => {
    if (receipt.isSuccess) queryClient.invalidateQueries({ queryKey: ["approvals"] });
  }, [receipt.isSuccess, queryClient]);

  const busy = isPending || receipt.isLoading;
  return (
    <tr>
      <td>
        <span className={`badge ${a.risk}`}>{a.risk}</span>
      </td>
      <td>
        {a.symbol} <span className="mono muted">{short(a.token)}</span>
      </td>
      <td className="mono">
        {short(a.spender)} {!a.spenderIsContract && <span className="badge medium">EOA</span>}
      </td>
      <td>{amount(a)}</td>
      <td className="muted small">{a.reasons.join(" ")}</td>
      <td>
        <button onClick={() => sendTransaction(buildRevokeTx(a))} disabled={busy}>
          {isPending ? "Confirm in wallet" : receipt.isLoading ? "Revoking..." : "Revoke"}
        </button>
        {error && <div className="error small">{error.message.split("\n")[0]}</div>}
      </td>
    </tr>
  );
}
