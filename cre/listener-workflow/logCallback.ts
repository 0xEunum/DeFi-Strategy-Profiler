// // Pseudo-code inside CRE workflow
// const reportStruct = {
//   runId,
//   chainId,
//   forkBlock,
//   tenderlyRunId,
//   commitHash,
//   tokenIn,
//   tokenOut,
//   amountIn,
//   amountOut,
//   gasUsed,
//   effectiveGasPrice,
//   totalCostInTokenIn,
//   paramsHash,
//   success,
//   revertReasonHash,
// };

// const abiEncoded = encodeAbiParameters(
//   [
//     // tuple types in same order
//     {
//       type: "tuple",
//       components: [
//         { name: "runId", type: "uint256" },
//         { name: "chainId", type: "uint64" },
//         { name: "forkBlock", type: "uint64" },
//         { name: "tenderlyRunId", type: "bytes32" },
//         { name: "commitHash", type: "bytes32" },
//         { name: "tokenIn", type: "address" },
//         { name: "tokenOut", type: "address" },
//         { name: "amountIn", type: "uint256" },
//         { name: "amountOut", type: "uint256" },
//         { name: "gasUsed", type: "uint256" },
//         { name: "effectiveGasPrice", type: "uint256" },
//         { name: "totalCostInTokenIn", type: "uint256" },
//         { name: "paramsHash", type: "bytes32" },
//         { name: "success", type: "bool" },
//         { name: "revertReasonHash", type: "bytes32" },
//       ],
//     },
//   ],
//   [reportStruct],
// );

// // then call evmClient.writeReport(registryAddress, abiEncoded)

import {
  type Runtime,
  type EVMLog,
  bytesToHex,
  hexToBase64,
  TxStatus,
  getNetwork,
  cre,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, keccak256, toHex, decodeEventLog } from "viem";
import { JobReportParams } from "../contracts/abi/index";
import type { Config } from "./Config";

// ── SimulationQueued ABI (for decoding the log) ────────────────────────────
const SIMULATION_QUEUED_ABI = [
  {
    name: "SimulationQueued",
    type: "event",
    inputs: [
      { name: "runId", type: "uint256", indexed: true },
      { name: "strategy", type: "address", indexed: true },
      { name: "caller", type: "address", indexed: true },
      { name: "explorerUrl", type: "string", indexed: false },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Triggered by: SimulationQueued(runId, strategy, caller, explorerUrl)
// Action:       Validate payload → encode JobReport → writeReport → JobQueue
// ─────────────────────────────────────────────────────────────────────────────
export const onSimulationQueued = (
  runtime: Runtime<Config>,
  log: EVMLog,
): string => {
  runtime.log(`[listener-workflow] SimulationQueued detected`);

  // ── 1. Decode the event log ────────────────────────────────────────────
  const topics = log.topics.map((t) => bytesToHex(t) as `0x${string}`);
  const data = bytesToHex(log.data) as `0x${string}`;

  const decoded = decodeEventLog({
    abi: SIMULATION_QUEUED_ABI,
    data,
    topics,
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
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: true,
  });
  if (!network) {
    throw new Error(
      `[listener-workflow] Network not found: ${runtime.config.chainSelectorName}`,
    );
  }

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector,
  );

  // ── 4. ABI-encode JobReport struct ────────────────────────────────────
  // Must match SimulationJobQueue.JobReport field order exactly
  const encoded = encodeAbiParameters(JobReportParams, [
    runId,
    strategy,
    caller,
    explorerUrl,
  ]);

  runtime.log(`[listener-workflow] Encoded JobReport for runId ${runId}`);

  // ── 5. Generate CRE-signed report ─────────────────────────────────────
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(encoded),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  // ── 6. Write to SimulationJobQueue via CRE Forwarder ──────────────────
  runtime.log(`[listener-workflow] Writing JobReport to SimulationJobQueue...`);

  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.jobQueueAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: runtime.config.gasLimit,
      },
    })
    .result();

  // ── 7. Handle result ──────────────────────────────────────────────────
  if (writeResult.txStatus === TxStatus.SUCCESS) {
    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
    runtime.log(`[listener-workflow] ✅ JobReport written! tx: ${txHash}`);
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
