export type JobReport = {
  runId: bigint;
  strategy: string;
  caller: string;
  explorerUrl: string;
};
export const SimulationReportParams = [
  {
    name: "report",
    type: "tuple",
    components: [
      { name: "runId", type: "uint256" },
      { name: "chainId", type: "uint64" },
      { name: "forkBlock", type: "uint64" },
      { name: "tenderlyRunId", type: "bytes32" },
      { name: "commitHash", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOut", type: "uint256" },
      { name: "gasUsed", type: "uint256" },
      { name: "effectiveGasPrice", type: "uint256" },
      { name: "totalCostInTokenIn", type: "uint256" },
      { name: "paramsHash", type: "bytes32" },
      { name: "success", type: "bool" },
      { name: "revertReasonHash", type: "bytes32" },
    ],
  },
] as const;

// ── SimulationQueued ABI (for decoding the log) ────────────────────────────
export const SIMULATION_REGISTRY_EVENT_ABI = [
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

// ── JobEnqueued ABI (for decoding the log) ────────────────────────────
export const SIMULATION_JOB_QUEUE_EVENT_ABI = [
  {
    name: "JobEnqueued",
    type: "event",
    inputs: [
      {
        name: "runId",
        type: "uint256",
        indexed: true,
      },
      {
        name: "strategy",
        type: "address",
        indexed: true,
      },
      {
        name: "caller",
        type: "address",
        indexed: true,
      },
      {
        name: "explorerUrl",
        type: "string",
        indexed: false,
      },
    ],
  },
] as const;
