import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import type { VNetDetails, StrategyDeployment } from "../types.js";
import { getOrCreateVnet } from "./tenderly.js";

// ── Constants ──────────────────────────────────────────────────────────────

export const STRATEGY_NAMES: Record<number, string> = {
  0: "EthToUsdcSwapStrategy",
  1: "EthToUsdcDaiMultiHopStrategy",
  2: "FailingSlippageStrategy",
};

// Forge broadcast — vNet is mainnet fork → chainId = 1
const BROADCAST_FILE = path.resolve(
  "../contracts/broadcast/DeployStrategy.s.sol/1/run-latest.json",
);

const STRATEGIES_PATH = path.resolve(__dirname, "../.strategies.json");

// ── Strategy cache helpers ─────────────────────────────────────────────────

interface StrategiesCache {
  vnetId: string;
  strategies: StrategyDeployment[];
}

function loadCache(vnetId: string): StrategiesCache {
  if (!existsSync(STRATEGIES_PATH)) {
    return { vnetId, strategies: [] };
  }

  const cache = JSON.parse(
    readFileSync(STRATEGIES_PATH, "utf-8"),
  ) as StrategiesCache;

  // If vNet changed (new fork), wipe the cache — old addresses are invalid
  if (cache.vnetId !== vnetId) {
    console.log(`  ♻️  New vNet detected — clearing strategy cache`);
    return { vnetId, strategies: [] };
  }

  return cache;
}

function saveCache(cache: StrategiesCache): void {
  writeFileSync(STRATEGIES_PATH, JSON.stringify(cache, null, 2), "utf-8");
}

function getCachedStrategy(
  cache: StrategiesCache,
  strategyIndex: number,
): StrategyDeployment | undefined {
  return cache.strategies.find((s) => s.strategyIndex === strategyIndex);
}

function upsertStrategy(
  cache: StrategiesCache,
  entry: StrategyDeployment,
): void {
  const idx = cache.strategies.findIndex(
    (s) => s.strategyIndex === entry.strategyIndex,
  );

  if (idx >= 0) {
    cache.strategies[idx] = entry;
  } else {
    cache.strategies.push(entry);
  }
}

// ── Main deploy function ───────────────────────────────────────────────────

export async function deployStrategy(
  strategyIndex: number,
): Promise<{ deployment: StrategyDeployment; vnet: VNetDetails }> {
  if (!(strategyIndex in STRATEGY_NAMES)) {
    throw new Error(
      `Invalid strategy index: ${strategyIndex}. Use 0, 1, or 2.`,
    );
  }

  const vnet: VNetDetails = await getOrCreateVnet();
  const cache = loadCache(vnet.id);
  const strategyName = STRATEGY_NAMES[strategyIndex];

  // ── Return cached address if already deployed on this vNet ────────────
  const cached = getCachedStrategy(cache, strategyIndex);
  if (cached) {
    console.log(
      `✅  ${strategyName} already deployed on this vNet → ${cached.address}`,
    );
    return { deployment: cached, vnet };
  }

  // ── Deploy via forge script ────────────────────────────────────────────
  console.log(`🚀  Deploying ${strategyName} on vNet...`);

  const verifierUrl = `${vnet.publicRpc}/verify/`;

  const cmd = [
    "forge script script/DeployStrategy.s.sol:DeployStrategy",
    `--rpc-url "${vnet.adminRpc}"`,
    `--sender "${vnet.deployerAddress}"`,
    "--unlocked",
    "--broadcast",
    "--verify",
    "--verifier custom",
    `--verifier-url "${verifierUrl}"`,
    `--sig "run(uint8)" ${strategyIndex}`,
  ].join(" ");

  execSync(cmd, {
    stdio: "inherit",
    cwd: path.resolve("../contracts"),
  });

  // ── Read deployed address from forge broadcast JSON ────────────────────
  const address = readDeployedAddress();
  const verified = true; // forge --verify ran successfully if we reached here

  const deployment: StrategyDeployment = {
    strategyIndex,
    strategyName,
    address,
    verified,
  };

  // ── Persist to .strategies.json ────────────────────────────────────────
  upsertStrategy(cache, deployment);
  saveCache(cache);
  console.log(`  ✅ Saved to cli/.strategies.json`);

  return { deployment, vnet };
}

// ── Read address from forge broadcast ─────────────────────────────────────

function readDeployedAddress(): string {
  if (!existsSync(BROADCAST_FILE)) {
    throw new Error(
      `Broadcast file not found: ${BROADCAST_FILE}\n` +
        `Make sure forge script ran with --broadcast.`,
    );
  }

  const broadcast = JSON.parse(readFileSync(BROADCAST_FILE, "utf-8"));

  const deployTx = broadcast.transactions?.find(
    (tx: any) => tx.transactionType === "CREATE",
  );

  if (!deployTx?.contractAddress) {
    throw new Error("No CREATE transaction found in broadcast JSON");
  }

  return deployTx.contractAddress;
}
