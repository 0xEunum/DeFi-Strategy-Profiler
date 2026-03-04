import {
  type Runtime,
  type EVMLog,
  bytesToHex,
  hexToBase64,
  TxStatus,
  getNetwork,
  cre,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, decodeEventLog, parseAbiParameters } from "viem";
import type { Config } from "../Config";
import { SIMULATION_REGISTRY_EVENT_ABI } from "../contracts/constents";

// ─────────────────────────────────────────────────────────────────────────────
// Triggered by: SimulationQueued(runId, strategy, caller, explorerUrl)
// Action:       Validate payload → encode JobReport → writeReport → JobQueue
// ─────────────────────────────────────────────────────────────────────────────
export const onSimulationQueued = (
  runtime: Runtime<Config>,
  log: EVMLog,
): string => {
  runtime.log(`[listener-workflow] SimulationQueued detected`);

  const sepoliaConfig = runtime.config.evm[0];

  // ── 1. Decode the event log ────────────────────────────────────────────
  const topics = log.topics.map((t) => bytesToHex(t) as `0x${string}`);
  const data = bytesToHex(log.data) as `0x${string}`;

  const decoded = decodeEventLog({
    abi: SIMULATION_REGISTRY_EVENT_ABI,
    topics,
    data,
    eventName: "SimulationQueued",
  });

  const { runId, strategy, caller, explorerUrl } = decoded.args;

  runtime.log(`   runId       : ${runId}`);
  runtime.log(`   strategy    : ${strategy}`);
  runtime.log(`   caller      : ${caller}`);
  runtime.log(`   explorerUrl : ${explorerUrl}`);

  // ── 2. Validate ────────────────────────────────────────────────────────
  if (!runId || runId === 0n) {
    throw new Error(`[listener-workflow] Invalid runId: ${runId}`);
  }
  if (!strategy || strategy === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      `[listener-workflow] Invalid strategy address: ${strategy}`,
    );
  }
  if (!explorerUrl || explorerUrl.length === 0) {
    throw new Error(`[listener-workflow] Empty explorerUrl`);
  }

  // ── 3. Get network + EVM client ────────────────────────────────────────
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: sepoliaConfig.chainSelectorName,
    isTestnet: true,
  });
  if (!network) {
    throw new Error(
      `[listener-workflow] Network not found: ${sepoliaConfig.chainSelectorName}`,
    );
  }

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector,
  );

  // ── 4. ABI-encode JobEnqueued struct ────────────────────────────────────
  // Must match SimulationJobQueue.JobEnqueued field order exactly
  const encodedData = encodeAbiParameters(
    parseAbiParameters(
      "uint256 runId, address strategy, address caller, string explorerUrl",
    ),
    [runId, strategy, caller, explorerUrl],
  );

  runtime.log(`[listener-workflow] Encoded JobEnqueued for runId ${runId}`);

  // ── 5. Generate CRE-signed report ─────────────────────────────────────
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(encodedData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  // ── 6. Write to SimulationJobQueue via CRE Forwarder ──────────────────
  runtime.log(
    `[listener-workflow] Writing JobEnqueued to SimulationJobQueue...`,
  );

  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: sepoliaConfig.jobQueueAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: sepoliaConfig.gasLimit,
      },
    })
    .result();

  // ── 7. Handle result ──────────────────────────────────────────────────
  if (writeResult.txStatus === TxStatus.SUCCESS) {
    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
    runtime.log(`[listener-workflow] ✅ JobEnqueued written! tx: ${txHash}`);
    return txHash;
  }

  if (writeResult.txStatus === TxStatus.REVERTED) {
    throw new Error(
      `[listener-workflow] writeReport reverted: ${writeResult.errorMessage}`,
    );
  }

  throw new Error(
    `[listener-workflow] writeReport failed with status: ${writeResult.txStatus}`,
  );
};
