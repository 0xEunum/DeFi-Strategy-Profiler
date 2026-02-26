import { readFileSync, existsSync, readdirSync } from "fs";
import * as path from "path";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
} from "viem";
import { requireEnv } from "../utils";
import type { SimulationRequest } from "../types";
import { SIMULATION_REGISTRY_ABI } from "../abis/simulationRegistry_abi";

const CONTRACTS = path.resolve(__dirname, "../../contracts");

function readSepoliaBroadcastAddresses(): {
  registry: `0x${string}`;
  jobQueue: `0x${string}`;
} {
  return {
    registry: findContractAddressFromBroadcast(
      "DeploySepolia.s.sol",
      11155111,
      "SimulationRegistry",
    ),
    jobQueue: findContractAddressFromBroadcast(
      "DeploySepolia.s.sol",
      11155111,
      "SimulationJobQueue",
    ),
  };
}

function findContractAddressFromBroadcast(
  scriptName: string, // e.g. "DeploySepolia.s.sol"
  chainId: number, // e.g. 11155111
  contractName: string, // e.g. "SimulationRegistry"
): `0x${string}` {
  const broadcastDir = path.join(
    CONTRACTS,
    `broadcast/${scriptName}/${chainId}`,
  );

  if (!existsSync(broadcastDir)) {
    throw new Error(
      `Broadcast dir missing: ${broadcastDir}\nDeploy contracts on chain ${chainId} first`,
    );
  }

  // Get all run json files, sorted newest first (by filename timestamp)
  const files = readdirSync(broadcastDir)
    .filter((f) => f.endsWith(".json") && f !== "run-latest.json")
    .sort()
    .reverse(); // newest timestamp first

  // Also check run-latest.json first as fast path
  const allFiles = ["run-latest.json", ...files];

  for (const file of allFiles) {
    const filePath = path.join(broadcastDir, file);
    if (!existsSync(filePath)) continue;

    const broadcast = JSON.parse(readFileSync(filePath, "utf8"));
    const tx = broadcast.transactions?.find(
      (t: any) =>
        t.contractName === contractName && t.transactionType === "CREATE",
    );

    if (tx?.contractAddress) {
      return tx.contractAddress as `0x${string}`;
    }
  }

  throw new Error(
    `Could not find ${contractName} in any broadcast file under:\n${broadcastDir}`,
  );
}

function getChain(chainId: number, rpcUrl: string) {
  return defineChain({
    id: chainId,
    name: chainId === 11155111 ? "sepolia" : "vnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

function getSignedClients(rpcUrl: string, chainId: number) {
  const chain = getChain(chainId, rpcUrl);
  const account = privateKeyToAccount(
    requireEnv("PRIVATE_KEY") as `0x${string}`,
  );
  const wallet = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
  const pub = createPublicClient({ chain, transport: http(rpcUrl) });
  return { wallet, pub, account };
}

function getPublicClient(rpcUrl: string, chainId: number) {
  const chain = getChain(chainId, rpcUrl);
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

export async function requestSimulation(
  strategyAddr: string,
  explorerUrl: string,
): Promise<SimulationRequest> {
  const { registry } = readSepoliaBroadcastAddresses();
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const { wallet, pub, account } = getSignedClients(rpcUrl, 11155111);

  const hash = await wallet.writeContract({
    address: registry,
    abi: SIMULATION_REGISTRY_ABI,
    functionName: "requestSimulation",
    args: [strategyAddr as `0x${string}`, explorerUrl],
    account,
  });

  const receipt = await pub.waitForTransactionReceipt({ hash });
  const runId = BigInt(receipt.logs[0]?.topics[1] ?? "0x0");

  return {
    runId,
    txHash: receipt.transactionHash,
    strategyAddr,
    explorerUrl,
    sepoliaEtherscanUrl: `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`,
  };
}

export async function pollForReport(
  runId: bigint,
  timeoutMs = 120_000,
  intervalMs = 5_000,
): Promise<{ identity: any; outcome: any }> {
  const { registry } = readSepoliaBroadcastAddresses();
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const pub = getPublicClient(rpcUrl, 11155111);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const identity = (await pub.readContract({
      address: registry,
      abi: SIMULATION_REGISTRY_ABI,
      functionName: "getRunIdentity",
      args: [runId],
    })) as any;

    // status: 0=Pending, 1=Success, 2=Failed
    if (identity.status > 0) {
      const outcome = (await pub.readContract({
        address: registry,
        abi: SIMULATION_REGISTRY_ABI,
        functionName: "getRunOutcome",
        args: [runId],
      })) as any;

      return { identity, outcome };
    }

    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    "⏰ Timeout: CRE did not complete simulation within 2 minutes",
  );
}

export function printReport({
  identity,
  outcome,
}: {
  identity: any;
  outcome: any;
}) {
  const status = identity.status === 1 ? "✅ SUCCESS" : "❌ FAILED";
  const isNumber = (v: any) => v !== undefined && v !== null;

  console.log("\n📊 SIMULATION REPORT");
  console.log("────────────────────────────────────");
  console.log(`Status:       ${status}`);
  console.log(`Strategy:     ${identity.strategy}`);
  console.log(`Caller:       ${identity.caller}`);
  console.log(
    `Chain:        ${identity.chainId} (fork block ${identity.forkBlock})`,
  );
  console.log(
    `Gas Used:     ${isNumber(outcome.gasUsed) ? outcome.gasUsed.toString() : "N/A"}`,
  );
  console.log(
    `Gas Price:    ${isNumber(outcome.effectiveGasPrice) ? outcome.effectiveGasPrice.toString() : "N/A"} wei`,
  );
  console.log(
    `Total Cost:   ${isNumber(outcome.totalCostInTokenIn) ? outcome.totalCostInTokenIn.toString() : "N/A"}`,
  );
  console.log(
    `Amount In:    ${isNumber(outcome.amountIn) ? outcome.amountIn.toString() : "N/A"}`,
  );
  console.log(
    `Amount Out:   ${isNumber(outcome.amountOut) ? outcome.amountOut.toString() : "N/A"}`,
  );
  if (identity.status === 2) {
    console.log(`Revert Hash:  ${outcome.revertReasonHash ?? "N/A"}`);
  }
  console.log(`Explorer:     ${identity.explorerUrl}`);
  console.log("────────────────────────────────────");
}
