import { z } from "zod";

// ── Sepolia chain config ───────────────────────────────────────────────────
// Used by both listener-workflow and executor-workflow.
// - registryAddress : SimulationRegistry — writeReport target
// - jobQueueAddress : SimulationJobQueue — logTrigger source
// - gasLimit        : gas units for sepoliaClient.writeReport()
const sepoliaSchema = z.object({
  chainSelectorName: z.literal("ethereum-testnet-sepolia"),
  registryAddress: z.string(),
  jobQueueAddress: z.string(),
  gasLimit: z.string(),
});

// ── Mainnet fork (vNet) config ────────────────────────────────────────────
// Used only by executor-workflow.
// - executorAddress    : vNet unlocked account — signs eth_sendTransaction
// - executionEthAmount : ETH in wei sent as msg.value to strategy.execute()
// - gasLimit           : gas units for strategy.execute() on vNet (NOT wei)
const mainnetVnetSchema = z.object({
  chainSelectorName: z.literal("ethereum-mainnet"),
  executorAddress: z.string(),
  executionEthAmount: z.string(),
  gasLimit: z.string(),
});

// ── Root schema — mirrors config.staging.json exactly ─────────────────────
// z.tuple enforces positional types:
//   evm[0] is always Sepolia  (compile-time guaranteed)
//   evm[1] is always mainnet  (compile-time guaranteed)
export const configSchema = z.object({
  evm: z.tuple([sepoliaSchema, mainnetVnetSchema]),
});

// ── Exported types ────────────────────────────────────────────────────────
export type Config = z.infer<typeof configSchema>;
export type SepoliaConfig = z.infer<typeof sepoliaSchema>;
export type MainnetVnetConfig = z.infer<typeof mainnetVnetSchema>;
