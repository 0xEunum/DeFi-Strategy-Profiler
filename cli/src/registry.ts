import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatEther,
  formatUnits,
  keccak256,
  toBytes,
} from "viem";
import { requireEnv } from "../utils";
import type { SimulationRequest } from "../types";
import { SIMULATION_REGISTRY_ABI } from "../abis/simulationRegistry_abi";
import { readFileSync, existsSync } from "fs";
import path from "path";

// ── Contract addresses ─────────────────────────────────────────────────────
// Default: use shared deployed contracts from root/.env
// Custom:  deploy your own SimulationRegistry + SimulationJobQueue on Sepolia,
//          then update REGISTRY_ADDRESS and JOB_QUEUE_ADDRESS in root/.env
//          and registryAddress + jobQueueAddress in cre/config.staging.json
function getContractAddresses(): {
  registry: `0x${string}`;
  jobQueue: `0x${string}`;
} {
  return {
    registry: requireEnv("REGISTRY_ADDRESS") as `0x${string}`,
    jobQueue: requireEnv("JOB_QUEUE_ADDRESS") as `0x${string}`,
  };
}

// ── Chain + client helpers ─────────────────────────────────────────────────

function sepolia(rpcUrl: string) {
  return defineChain({
    id: 11155111,
    name: "sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

function getSignedClients(rpcUrl: string) {
  const chain = sepolia(rpcUrl);
  const privateKey = requireEnv("CRE_ETH_PRIVATE_KEY");
  const account = privateKeyToAccount(`0x${privateKey}`);

  const wallet = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const pub = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  return { wallet, pub, account };
}

function getPublicClient(rpcUrl: string) {
  return createPublicClient({
    chain: sepolia(rpcUrl),
    transport: http(rpcUrl),
  });
}

const SIMULATION_QUEUED_TOPIC = keccak256(
  toBytes("SimulationQueued(uint256,address,address,string)"),
);

// ── requestSimulation ──────────────────────────────────────────────────────

export async function requestSimulation(
  strategyAddr: string,
  explorerUrl: string,
): Promise<SimulationRequest> {
  const { registry } = getContractAddresses();
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const { wallet, pub, account } = getSignedClients(rpcUrl);

  const hash = await wallet.writeContract({
    address: registry,
    abi: SIMULATION_REGISTRY_ABI,
    functionName: "requestSimulation",
    args: [strategyAddr as `0x${string}`, explorerUrl],
    account,
  });

  const receipt = await pub.waitForTransactionReceipt({ hash });

  const simLog = receipt.logs.find(
    (l) => l.topics[0] === SIMULATION_QUEUED_TOPIC,
  );
  if (!simLog) throw new Error("SimulationQueued event not found in receipt");
  const runId = BigInt(simLog.topics[1] ?? "0x0");

  return {
    runId,
    txHash: receipt.transactionHash,
    strategyAddr,
    explorerUrl,
    sepoliaEtherscanUrl: `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`,
  };
}

// ── pollForReport ──────────────────────────────────────────────────────────

export async function pollForReport(
  runId: bigint,
  timeoutMs = 300_000, // 5 minutes time-out
  intervalMs = 5_000,
): Promise<{ identity: any; outcome: any }> {
  const { registry } = getContractAddresses();
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const pub = getPublicClient(rpcUrl);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const identity = (await pub.readContract({
      address: registry,
      abi: SIMULATION_REGISTRY_ABI,
      functionName: "getRunIdentity",
      args: [runId],
    })) as any;

    // status: 0 = Pending, 1 = Success, 2 = Failed
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
    "⏰ Timeout: CRE did not complete simulation within 5 minutes",
  );
}

// ── Token metadata ─────────────────────────────────────────────────────────
const TOKEN_META: Record<string, { symbol: string; decimals: number }> = {
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": {
    symbol: "WETH",
    decimals: 18,
  },
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": { symbol: "USDC", decimals: 6 },
  "0x6B175474E89094C44Da98b954EedeAC495271d0F": { symbol: "DAI", decimals: 18 },
  "0xdAC17F958D2ee523a2206206994597C13D831ec7": { symbol: "USDT", decimals: 6 },
  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": { symbol: "WBTC", decimals: 8 },
};

// ── Load strategy names dynamically from cli/.strategies.json ─────────────
// Returns a map of lowercased address → strategyName
// Falls back to empty map if file doesn't exist yet
function loadDeployedStrategyNames(): Record<string, string> {
  const strategiesPath = path.resolve(__dirname, "../.strategies.json");

  if (!existsSync(strategiesPath)) return {};

  const cache = JSON.parse(readFileSync(strategiesPath, "utf-8"));

  return Object.fromEntries(
    (cache.strategies ?? []).map((s: any) => [
      s.address.toLowerCase(),
      s.strategyName,
    ]),
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function tokenLabel(address: string): { symbol: string; decimals: number } {
  const found = Object.entries(TOKEN_META).find(
    ([addr]) => addr.toLowerCase() === address.toLowerCase(),
  );
  return found ? found[1] : { symbol: "UNKNOWN", decimals: 18 };
}

function formatToken(amount: bigint, address: string): string {
  const { symbol, decimals } = tokenLabel(address);
  const formatted = parseFloat(formatUnits(amount, decimals)).toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 6,
    },
  );
  return `${formatted} ${symbol}`;
}

function formatGwei(wei: bigint): string {
  const gwei = parseFloat(formatUnits(wei, 9));
  return `${gwei.toFixed(2)} gwei (${wei.toLocaleString()} wei)`;
}

function formatEthCost(wei: bigint): string {
  return `${parseFloat(formatEther(wei)).toFixed(8)} ETH (${wei.toLocaleString()} wei)`;
}

// ── printReport ────────────────────────────────────────────────────────────

export function printReport({
  identity,
  outcome,
}: {
  identity: any;
  outcome: any;
}) {
  const success = identity.status === 1;
  const status = success ? "✅ SUCCESS" : "❌ REVERTED";
  const val = (v: any) =>
    v !== undefined && v !== null ? v.toString() : "N/A";
  const strategyNames = loadDeployedStrategyNames();
  const strategyName =
    strategyNames[identity.strategy.toLowerCase()] ?? "Unknown Strategy";

  const tokenInAddr = identity.tokenIn as string;
  const tokenOutAddr = identity.tokenOut as string;
  const { symbol: symbolIn, decimals: dIn } = tokenLabel(tokenInAddr);
  const { symbol: symbolOut, decimals: dOut } = tokenLabel(tokenOutAddr);

  console.log("\n📊 SIMULATION REPORT");
  console.log("────────────────────────────────────────────────────");
  console.log(`Status:         ${status}`);
  console.log(`Strategy:       ${strategyName}`);
  console.log(`                ${identity.strategy}`);
  console.log(`Caller:         ${identity.caller}`);
  console.log(
    `Network:        Chain ${identity.chainId} — fork block #${Number(identity.forkBlock).toLocaleString()}`,
  );

  console.log(`\n💱 Token Flow:`);
  console.log(`  Token In:     ${symbolIn.padEnd(8)} ${tokenInAddr}`);
  console.log(`  Token Out:    ${symbolOut.padEnd(8)} ${tokenOutAddr}`);
  console.log(
    `  Amount In:    ${formatToken(BigInt(val(outcome.amountIn)), tokenInAddr)}`,
  );

  if (success) {
    console.log(
      `  Amount Out:   ${formatToken(BigInt(val(outcome.amountOut)), tokenOutAddr)}`,
    );

    // Exchange rate
    const amtIn = parseFloat(formatUnits(BigInt(val(outcome.amountIn)), dIn));
    const amtOut = parseFloat(
      formatUnits(BigInt(val(outcome.amountOut)), dOut),
    );
    if (amtIn > 0) {
      const rate = (amtOut / amtIn).toLocaleString("en-US", {
        maximumFractionDigits: 4,
      });
      console.log(`  Rate:         1 ${symbolIn} = ${rate} ${symbolOut}`);
    }
  }

  console.log(`\n⛽ Gas Metrics:`);
  console.log(
    `  Gas Used:     ${BigInt(val(outcome.gasUsed)).toLocaleString()} units`,
  );
  console.log(
    `  Gas Price:    ${formatGwei(BigInt(val(outcome.effectiveGasPrice)))}`,
  );
  console.log(
    `  Total Cost:   ${formatEthCost(BigInt(val(outcome.totalCostInTokenIn)))}`,
  );

  if (!success) {
    console.log(`\n⚠️  Revert:`);
    console.log(`  Reason Hash:  ${val(outcome.revertReasonHash)}`);
  }

  console.log(`\n🔗 Links:`);
  console.log(`  vNet Explorer: ${identity.explorerUrl}`);
  console.log(
    `  Registry:      https://sepolia.etherscan.io/address/${requireEnv("REGISTRY_ADDRESS")}`,
  );
  console.log("────────────────────────────────────────────────────");
}
