import { deployStrategy, STRATEGY_NAMES } from "../src/deploy";
import { requestSimulation, pollForReport, printReport } from "../src/registry";
import { getOrCreateVnet } from "../src/tenderly";

async function main() {
  const index = parseInt(process.argv[2] ?? "0");

  if (isNaN(index) || !(index in STRATEGY_NAMES)) {
    console.error("❌ Usage: npm run provision:0 | provision:1 | provision:2");
    process.exit(1);
  }

  console.log("🚀 Starting provision flow...\n");
  // Step 1 — get vNet details for explorerUrl
  const vnet = await getOrCreateVnet();

  // Step 2 — deploy + verify strategy on vNet
  const deployment = await deployStrategy(index);

  // Step 3 — call requestSimulation on Sepolia Registry
  console.log("📡 Calling requestSimulation() on Sepolia Registry...");
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

  // Step 4 — poll for result (if POLL_FOR_RESULT=true)
  if (process.env.POLL_FOR_RESULT === "true") {
    console.log("⏳ Polling for simulation report...");
    const report = await pollForReport(sim.runId);
    printReport(report);
  } else {
    console.log(
      "✅ Done. Set POLL_FOR_RESULT=true in .env to auto-poll for results.",
    );
  }
}

main().catch((e: any) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
