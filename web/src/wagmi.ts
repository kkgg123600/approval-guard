import { createConfig, http } from "wagmi";
import { foundry, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// `injected` talks to whatever wallet the browser exposes as window.ethereum (e.g. MetaMask).
export const config = createConfig({
  chains: [foundry, sepolia],
  connectors: [injected()],
  transports: {
    [foundry.id]: http("http://127.0.0.1:8545", { batch: true }),
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL, { batch: true }),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
