import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";
import type { VNetDetails, StrategyDeployment } from "../types.js";
import { getOrCreateVnet } from "../src/tenderly.js";

export const STRATEGY_NAMES: Record<number, string> = {
  0: "EthToUsdcSwapStrategy",
  1: "EthToUsdcDaiMultiHopStrategy",
  2: "FailingSlippageStrategy",
};

// Forge writes broadcast to:
// contracts/broadcast/DeployStrategy.s.sol/<chainId>/run-latest.json
// vNet is a mainnet fork → chainId = 1
const BROADCAST_FILE = path.resolve(
  "../contracts/broadcast/DeployStrategy.s.sol/1/run-latest.json",
);

export async function deployStrategy(
  strategyIndex: number,
): Promise<StrategyDeployment> {
  if (!(strategyIndex in STRATEGY_NAMES)) {
    throw new Error(
      `Invalid strategy index: ${strategyIndex}. Use 0, 1, or 2.`,
    );
  }

  const vNet: VNetDetails = await getOrCreateVnet();

  const strategyName = STRATEGY_NAMES[strategyIndex];
  const deployerAddress = vNet.deployerAddress;
  const verifierUrl = `${vNet.publicRpc}/verify/`;

  const cmd = [
    "forge script script/DeployStrategy.s.sol:DeployStrategy",
    `--rpc-url "${vNet.adminRpc}"`,
    `--sender "${deployerAddress}"`,
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

  // ── Read deployed address from broadcast JSON ─────────────────────────
  const address = readDeployedAddress();

  return { address, strategyIndex, strategyName };
}

function readDeployedAddress(): string {
  if (!existsSync(BROADCAST_FILE)) {
    throw new Error(
      `Broadcast file not found: ${BROADCAST_FILE}\n` +
        `Make sure forge script ran with --broadcast.`,
    );
  }

  const broadcast = JSON.parse(readFileSync(BROADCAST_FILE, "utf8"));

  // Broadcast JSON structure:
  // { transactions: [{ transactionType: "CREATE", contractAddress: "0x..." }] }
  const deployTx = broadcast.transactions?.find(
    (tx: any) => tx.transactionType === "CREATE",
  );

  if (!deployTx?.contractAddress) {
    throw new Error("No CREATE transaction found in broadcast JSON");
  }

  return deployTx.contractAddress;
}
