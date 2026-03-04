import { cre, getNetwork, Runner } from "@chainlink/cre-sdk";
import { keccak256, toHex } from "viem";
import type { Config } from "../Config";
import { onJobEnqueued } from "./logCallback";

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

  // Topic0 = keccak256("JobEnqueued(uint256,address,address,string)")
  const jobEnqueuedTopic = keccak256(
    toHex("JobEnqueued(uint256,address,address,string)"),
  );

  const logTrigger = evmClient.logTrigger({
    addresses: [sepoliaConfig.jobQueueAddress],
    topics: [
      { values: [jobEnqueuedTopic] }, // topic0 — event signature
    ],
  });

  return [cre.handler(logTrigger, onJobEnqueued)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
