import { createVnet, getOrCreateVnet } from "../src/tenderly";

async function main() {
  // force fresh if --new flag passed, otherwise get or create
  const fresh = process.argv.includes("--new");
  const vnet = fresh ? await createVnet() : await getOrCreateVnet();
  console.log(`  adminRpc  → ${vnet.adminRpc}`);
  console.log(`  publicRpc → ${vnet.publicRpc}`);
  console.log(`  explorer  → ${vnet.explorerUrl}`);
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
