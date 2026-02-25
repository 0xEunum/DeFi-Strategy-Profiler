#!/usr/bin/env tsx
import { deployStrategy } from "../src/deploy.js";

async function main() {
  const index = parseInt(process.argv[2] ?? "0");

  if (isNaN(index)) {
    console.error(
      "❌ Usage: npm run deployStrategy:0 | npm run deployStrategy:1 | npm run deployStrategy:2",
    );
    process.exit(1);
  }

  try {
    const result = await deployStrategy(index);
    console.log(
      `✅ ${result.strategyName} deployed & verified on vNet → ${result.address}`,
    );
  } catch (error: any) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
}

main();
