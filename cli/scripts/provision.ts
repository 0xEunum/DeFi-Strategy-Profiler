import { deployStrategy, STRATEGY_NAMES } from "../src/deploy";
import { requestSimulation, pollForReport, printReport } from "../src/registry";
import { getOrCreateVnet } from "../src/tenderly";

async function main() {
  const index = parseInt(process.argv[2] ?? "0");

  if (isNaN(index) || !(index in STRATEGY_NAMES)) {
    console.error(
      `❌ Usage: npm run provision -- 0 | 1 | 2\n` +
        `   0 = EthToUsdcSwapStrategy\n` +
        `   1 = EthToUsdcDaiMultiHopStrategy\n` +
        `   2 = FailingSlippageStrategy`,
    );
    process.exit(1);
  }

  console.log("🚀 Starting provision flow...\n");

  // Step 1 — get or create vNet (syncs configs automatically) & deploy strategy on vNet (cached if already deployed)
  const { deployment, vnet } = await deployStrategy(index);

  // Step 2 — request simulation on Sepolia
  console.log("\n📡 Calling requestSimulation() on Sepolia...");
  const sim = await requestSimulation(deployment.address, vnet.explorerUrl);

  console.log(`✅ Queued → runId: ${sim.runId.toString()}`);
  console.log(`\n🔗 Links:`);
  console.log(`   Sepolia tx:   ${sim.sepoliaEtherscanUrl}`);
  console.log(`   vNet explorer: ${vnet.explorerUrl}`);
  console.log(`\n📋 CRE Trigger:`);
  console.log(`   txHash: ${sim.txHash}`);
  console.log(
    `\n💡 Paste txHash into CRE log trigger to wake listener-workflow\n`,
  );

  // Step 3 — poll for result (opt-in via POLL_FOR_RESULT=true in .env)
  if (process.env.POLL_FOR_RESULT === "true") {
    console.log("\n⏳ Polling for simulation report...");
    const report = await pollForReport(sim.runId);
    printReport(report);
  } else {
    console.log(
      "\n💡 Set POLL_FOR_RESULT=true in .env to auto-poll for results.",
    );
  }
}

main().catch((e: any) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
