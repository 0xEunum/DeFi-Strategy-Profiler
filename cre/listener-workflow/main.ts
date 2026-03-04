import { cre, getNetwork, Runner } from "@chainlink/cre-sdk";
import { keccak256, toHex } from "viem";
import type { Config } from "../Config";
import { onSimulationQueued } from "./logCallback";

export const initWorkflow = (config: Config) => {
  const sepoliaConfig = config.evm[0];
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: sepoliaConfig.chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(`Network not found: ${sepoliaConfig.chainSelectorName}`);
  }

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector,
  );

  // Topic0 = keccak256("SimulationQueued(uint256,address,address,string)")
  const simulationQueuedTopic = keccak256(
    toHex("SimulationQueued(uint256,address,address,string)"),
  );

  const logTrigger = evmClient.logTrigger({
    addresses: [sepoliaConfig.registryAddress],
    topics: [
      { values: [simulationQueuedTopic] }, // topic0 — event signature
    ],
  });

  return [cre.handler(logTrigger, onSimulationQueued)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
