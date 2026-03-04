import {
  EVMClient,
  HTTPClient,
  getNetwork,
  bytesToHex,
  hexToBase64,
  encodeCallMsg,
  blockNumber,
  prepareReportRequest,
  consensusIdenticalAggregation,
  TxStatus,
  LATEST_BLOCK_NUMBER,
  type Runtime,
  type EVMLog,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import {
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  keccak256,
  parseAbi,
  toHex,
  zeroAddress,
  Address,
} from "viem";
import { SIMULATION_JOB_QUEUE_EVENT_ABI } from "../contracts/constents";
import { SimulationReportParams } from "../contracts/constents";
import type { Config } from "../Config";

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
]);

const TOKEN_OUT_FUN_ABI = parseAbi([
  "function TOKEN_OUT() external view returns (address)",
]);

const EXECUTE_FUN_ABI = parseAbi([
  "function execute(address receiver, bytes calldata params) external payable returns (uint256 amountOut)",
]);

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const ZERO_BYTES32 = `0x${"00".repeat(32)}` as `0x${string}`;

// Handles eth_sendTransaction and eth_getTransactionReceipt on vNet admin RPC.
// For eth_call on revert path, we bypass the throw so callers can read json.error directly.
function vnetRpc(
  runtime: Runtime<Config>,
  adminRpc: string,
  method: string,
  params: unknown[],
  allowError = false, // true → return full json including .error (revert path)
): any {
  const httpClient = new HTTPClient();

  return httpClient
    .sendRequest(
      runtime,
      (
        sendRequester: HTTPSendRequester,
        rpcMethod: string,
        rpcParams: unknown[],
      ) => {
        const body = Buffer.from(
          new TextEncoder().encode(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: rpcMethod,
              params: rpcParams,
            }),
          ),
        ).toString("base64");

        const res = sendRequester
          .sendRequest({
            url: adminRpc,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            cacheSettings: { store: true, maxAge: "60s" }, // Accept cached responses up to 60 seconds old (Duration format: "60s")
          })
          .result();

        const data = JSON.parse(new TextDecoder().decode(res.body)) as any;

        if (!allowError && data.error) {
          throw new Error(
            `vnetRpc [${rpcMethod}] error: ${JSON.stringify(data.error)}`,
          );
        }

        return allowError ? data : data.result;
      },
      consensusIdenticalAggregation(),
    )(method, params)
    .result();
}

// Dedicated function to poll for a transaction receipt with retries
function pollVnetReceipt(
  runtime: Runtime<Config>,
  adminRpc: string,
  txHash: string,
): any {
  const httpClient = new HTTPClient();

  return httpClient
    .sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester, targetHash: string) => {
        const body = Buffer.from(
          new TextEncoder().encode(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_getTransactionReceipt",
              params: [targetHash],
            }),
          ),
        ).toString("base64");

        let attempt = 0;
        let finalReceipt: any = null;

        const res = sendRequester
          .sendRequest({
            url: adminRpc,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            cacheSettings: { store: false },
          })
          .result();

        const data = JSON.parse(new TextDecoder().decode(res.body)) as any;

        if (data.error) {
          throw new Error(
            `pollVnetReceipt error: ${JSON.stringify(data.error)}`,
          );
        }
        if (data.result !== null && data.result !== undefined) {
          finalReceipt = data.result;
        }

        if (finalReceipt !== null) {
          // THE CRITICAL FIX: Strip all 'null' values from the receipt
          // This removes "contractAddress": null and prevents the consensus crash
          return JSON.parse(
            JSON.stringify(finalReceipt, (key, value) =>
              value === null ? undefined : value,
            ),
          );
        }

        return { status: "pending_timeout", attemptsRan: attempt };
      },
      consensusIdenticalAggregation(),
    )(txHash)
    .result();
}

export function onJobEnqueued(runtime: Runtime<Config>, log: EVMLog): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("[executor] JobEnqueued detected");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── 1. Decode event ──────────────────────────────────────────────────
  const topics = log.topics.map((t) => bytesToHex(t) as `0x${string}`);
  const data = bytesToHex(log.data) as `0x${string}`;
  const decoded = decodeEventLog({
    abi: SIMULATION_JOB_QUEUE_EVENT_ABI,
    topics,
    data,
    eventName: "JobEnqueued",
  });

  const { runId, strategy, caller, explorerUrl } = decoded.args;

  runtime.log(`   runId      : ${runId}`);
  runtime.log(`   strategy   : ${strategy}`);
  runtime.log(`caller: ${caller}`);
  runtime.log(`   explorerUrl: ${explorerUrl}`);

  // ── 2. Config + secret ───────────────────────────────────────────────
  const adminRpc = runtime.getSecret({ id: "VNET_ADMIN_RPC_URL_KEY" }).result();
  const sepoliaConfig = runtime.config.evm[0];
  const vnetConfig = runtime.config.evm[1];
  const executorAddr = vnetConfig.executorAddress as `0x${string}`;
  const amountIn = BigInt(vnetConfig.executionEthAmount);

  // Mainnet EVMClient for reads (state-sync: true vNet mirrors mainnet)
  const forkedVNet = getNetwork({
    chainFamily: "evm",
    chainSelectorName: vnetConfig.chainSelectorName,
    isTestnet: false,
  });

  if (!forkedVNet)
    throw new Error(
      "[executor] forkedVnet(ethereum-mainnet) network not found",
    );

  // Sepolia EVMClient for writeReport
  const sepoliaNetwork = getNetwork({
    chainFamily: "evm",
    chainSelectorName: sepoliaConfig.chainSelectorName,
    isTestnet: true,
  });

  if (!sepoliaNetwork)
    throw new Error(
      `[executor] Network not found: ${sepoliaConfig.chainSelectorName}`,
    );

  const forkVnetClient = new EVMClient(forkedVNet.chainSelector.selector);
  const sepoliaClient = new EVMClient(sepoliaNetwork.chainSelector.selector);

  // // ── 3. Read TOKEN_OUT via forked-mainnet EVMClient ──────────────────────────

  const tokenOutCall = forkVnetClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: strategy as `0x${string}`,
        data: encodeFunctionData({
          abi: TOKEN_OUT_FUN_ABI,
          functionName: "TOKEN_OUT",
          args: [],
        }),
      }),
    })
    .result();

  const tokenOut = decodeFunctionResult({
    abi: TOKEN_OUT_FUN_ABI,
    functionName: "TOKEN_OUT",
    data: bytesToHex(tokenOutCall.data),
  }) as string;

  // ── 4. Balance BEFORE via mainnet EVMClient ──────────────────────────
  const balBeforeCall = forkVnetClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: tokenOut as `0x${string}`,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [executorAddr],
        }),
      }),
      blockNumber: LATEST_BLOCK_NUMBER,
    })
    .result();

  const balBefore = decodeFunctionResult({
    abi: ERC20_ABI,
    functionName: "balanceOf",
    data: bytesToHex(balBeforeCall.data),
  }) as bigint;

  // ── 5. Build execute() calldata ──────────────────────────────────────
  const innerParams = encodeAbiParameters(
    [{ name: "minAmountOut", type: "uint256" }],
    [0n],
  );
  const paramsHash = keccak256(innerParams);
  const executeCalldata = encodeFunctionData({
    abi: EXECUTE_FUN_ABI,
    functionName: "execute",
    args: [executorAddr, innerParams],
  });

  // ── Step 5.5 — Fetch current gas price from vNet ──────────────────────

  const gasPriceHex = vnetRpc(runtime, adminRpc.value, "eth_gasPrice", []);

  // ── 6. strategy.execute() on vNet via adminRpc ───────────────────────
  runtime.log("[Step 6] Calling strategy.execute() on vNet...");

  const execTxHash = vnetRpc(runtime, adminRpc.value, "eth_sendTransaction", [
    {
      from: executorAddr,
      to: strategy,
      gas: toHex(BigInt(vnetConfig.gasLimit)),
      gasPrice: gasPriceHex,
      value: toHex(amountIn),
      data: executeCalldata,
    },
  ]) as `0x${string}`;

  runtime.log(`   tx: ${execTxHash}`);

  // ── 7. Poll receipt via adminRpc ─────────────────────────────────────
  runtime.log("[Step 7] Polling receipt...");
  const receipt = pollVnetReceipt(runtime, adminRpc.value, execTxHash);

  if (!receipt)
    throw new Error(`[executor] Timeout: no receipt for execute() ${receipt}`);

  const success = receipt.status === "0x1";
  const gasUsed = BigInt(receipt.gasUsed);
  const effectiveGasPrice = BigInt(receipt.effectiveGasPrice ?? "0x0");
  const forkBlock = BigInt(receipt.blockNumber ?? "0x0");
  const tenderlyRunId = execTxHash.padEnd(66, "0") as `0x${string}`;

  runtime.log(`   success: ${success} | gasUsed: ${gasUsed}`);

  // ── 8. amountOut or revertReasonHash ────────────────────────────────
  let amountOut = 0n;
  let revertReasonHash = ZERO_BYTES32;

  if (success) {
    runtime.log("[Step 8] Reading balanceAfter...");

    const balAfterCall = forkVnetClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: tokenOut as `0x${string}`,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [executorAddr],
          }),
        }),
        blockNumber: blockNumber(forkBlock),
      })
      .result();

    const balAfter = decodeFunctionResult({
      abi: ERC20_ABI,
      functionName: "balanceOf",
      data: bytesToHex(balAfterCall.data),
    }) as bigint;

    amountOut = balAfter - balBefore;
    runtime.log(`   amountOut: ${amountOut}`);
  } else {
    runtime.log("[Step 8] Reverted — replaying for revert data...");

    // allowError=true so we get full json with .error.data
    const revertJson = vnetRpc(
      runtime,
      adminRpc.value,
      "eth_call",
      [
        {
          from: executorAddr,
          to: strategy,
          value: toHex(amountIn),
          data: executeCalldata,
          gas: toHex(vnetConfig.gasLimit),
        },
        receipt.blockNumber,
      ],
      true,
    );

    const revertData = revertJson.error?.data ?? "0x";
    revertReasonHash = keccak256(revertData as `0x${string}`);
    runtime.log(`   revertReasonHash: ${revertReasonHash}`);
  }

  // ── 9. Encode SimulationReport ───────────────────────────────────────
  runtime.log("[Step 9] Encoding SimulationReport...");

  const encoded = encodeAbiParameters(SimulationReportParams, [
    {
      runId,
      chainId: 1n,
      forkBlock,
      tenderlyRunId,
      commitHash: ZERO_BYTES32,
      tokenIn: WETH,
      tokenOut,
      amountIn,
      amountOut,
      gasUsed,
      effectiveGasPrice,
      totalCostInTokenIn: gasUsed * effectiveGasPrice,
      paramsHash,
      success,
      revertReasonHash,
    },
  ]);

  // ── 10. Sign + writeReport to Sepolia Registry ───────────────────────
  runtime.log("[Step 10] Writing SimulationReport to Sepolia...");

  const writeResult = sepoliaClient
    .writeReport(runtime, {
      receiver: sepoliaConfig.registryAddress,
      report: runtime.report(prepareReportRequest(encoded)).result(),
      gasConfig: { gasLimit: sepoliaConfig.gasLimit },
    })
    .result();

  // ── 11. Return ───────────────────────────────────────────────────────
  if (writeResult.txStatus === TxStatus.SUCCESS) {
    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
    runtime.log(`[executor] ✅ SimulationReport written! tx: ${txHash}`);
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    return txHash;
  }

  if (writeResult.txStatus === TxStatus.REVERTED) {
    throw new Error(
      `[executor] writeReport reverted: ${writeResult.errorMessage}`,
    );
  }

  throw new Error(`[executor] writeReport failed: ${writeResult.txStatus}`);
}
