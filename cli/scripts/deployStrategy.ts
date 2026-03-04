#!/usr/bin/env tsx
import { deployStrategy, STRATEGY_NAMES } from "../src/deploy.js";

async function main() {
  const index = parseInt(process.argv[2] ?? "0");

  if (isNaN(index) || !(index in STRATEGY_NAMES)) {
    console.error(
      `❌ Usage: npm run deploy -- 0 | 1 | 2\n` +
        `   0 = EthToUsdcSwapStrategy\n` +
        `   1 = EthToUsdcDaiMultiHopStrategy\n` +
        `   2 = FailingSlippageStrategy`,
    );
    process.exit(1);
  }

  try {
    const { deployment, vnet } = await deployStrategy(index);
    console.log(`\n✅ ${deployment.strategyName}`);
    console.log(`   address  → ${deployment.address}`);
    console.log(`   verified → ${deployment.verified}`);
  } catch (error: any) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

main();
