import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { requireEnv } from "../utils";
import type { TenderlyVNetResponse, VNetDetails } from "../types";
import { parseEther, toHex } from "viem";

// ── File paths ─────────────────────────────────────────────────────────────
const VNET_JSON_PATH = path.resolve(__dirname, "../.vnet.json");
const ENV_PATH = path.resolve(__dirname, "../../.env");
const PROJECT_YAML_PATH = path.resolve(__dirname, "../../cre/project.yaml");
const CONFIG_STAGING_PATH = path.resolve(
  __dirname,
  "../../cre/config.staging.json",
);

// ── Tenderly API helpers ───────────────────────────────────────────────────
function headers() {
  return {
    "Content-Type": "application/json",
    "X-Access-Key": requireEnv("TENDERLY_ACCESS_KEY"),
  };
}

function baseUrl() {
  const account = requireEnv("TENDERLY_ACCOUNT_SLUG");
  const project = requireEnv("TENDERLY_PROJECT_SLUG");
  return `https://api.tenderly.co/api/v1/account/${account}/project/${project}`;
}

function parseVNet(data: TenderlyVNetResponse): VNetDetails {
  const adminRpc = data.rpcs.find((r) => r.name === "Admin RPC")?.url ?? "";
  const adminRpcWss =
    data.rpcs.find((r) => r.name === "Admin websocket RPC")?.url ?? "";
  const publicRpc = data.rpcs.find((r) => r.name === "Public RPC")?.url ?? "";
  const publicRpcWss =
    data.rpcs.find((r) => r.name === "Public websocket RPC")?.url ?? "";
  const accounts = data.virtual_network_config.accounts.map((a) => a.address);
  const publicRpcUuid = publicRpc.split("/").pop() ?? data.id;
  const explorerUrl = `https://dashboard.tenderly.co/explorer/vnet/${publicRpcUuid}`;

  return {
    id: data.id,
    displayName: data.display_name,
    adminRpc,
    adminRpcWss,
    publicRpc,
    publicRpcWss,
    explorerUrl,
    chainId: data.virtual_network_config.chain_config.chain_id,
    forkBlock: parseInt(data.fork_config.block_number, 16),
    accounts,
    deployerAddress: accounts[0],
    executorAddress: accounts[1],
  };
}

// ── Auto-update helpers ────────────────────────────────────────────────────

/**
 * Updates a single KEY=VALUE line in root .env file.
 * Preserves all other lines exactly as-is.
 */
function updateEnv(key: string, value: string): void {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`.env not found at ${ENV_PATH}`);
  }

  const lines = fs.readFileSync(ENV_PATH, "utf-8").split("\n");
  let updated = false;

  const newLines = lines.map((line) => {
    if (line.startsWith(`${key}=`) || line.startsWith(`${key} =`)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });

  // If key didn't exist yet, append it
  if (!updated) newLines.push(`${key}=${value}`);

  fs.writeFileSync(ENV_PATH, newLines.join("\n"), "utf-8");
  console.log(`  ✅ .env              → ${key} updated`);
}

/**
 * Updates staging-settings.rpcs[ethereum-mainnet].url in cre/project.yaml.
 * Uses js-yaml to parse + re-serialize — preserves all other settings.
 */
function updateProjectYaml(publicRpc: string): void {
  if (!fs.existsSync(PROJECT_YAML_PATH)) {
    throw new Error(`project.yaml not found at ${PROJECT_YAML_PATH}`);
  }

  const raw = fs.readFileSync(PROJECT_YAML_PATH, "utf-8");
  const doc = yaml.load(raw) as any;

  const stagingRpcs: any[] = doc?.["staging-settings"]?.rpcs ?? [];
  const mainnetEntry = stagingRpcs.find(
    (r: any) => r["chain-name"] === "ethereum-mainnet",
  );

  if (mainnetEntry) {
    mainnetEntry.url = publicRpc;
  } else {
    // Add it if missing
    stagingRpcs.push({ "chain-name": "ethereum-mainnet", url: publicRpc });
    doc["staging-settings"].rpcs = stagingRpcs;
  }

  fs.writeFileSync(
    PROJECT_YAML_PATH,
    yaml.dump(doc, { lineWidth: -1 }),
    "utf-8",
  );
  console.log(
    `  ✅ project.yaml      → staging-settings.rpcs[ethereum-mainnet].url updated`,
  );
}

/**
 * Updates evm[1].executorAddress in cre/config.staging.json.
 * evm[1] is always the ethereum-mainnet / vNet config entry.
 */
function updateConfigStaging(executorAddress: string): void {
  if (!fs.existsSync(CONFIG_STAGING_PATH)) {
    throw new Error(`config.staging.json not found at ${CONFIG_STAGING_PATH}`);
  }

  const config = JSON.parse(
    fs.readFileSync(CONFIG_STAGING_PATH, "utf-8"),
  ) as any;
  const mainnetEntry = config.evm?.find(
    (e: any) => e.chainSelectorName === "ethereum-mainnet",
  );

  if (!mainnetEntry) {
    throw new Error(
      `[config.staging.json] ethereum-mainnet entry not found in evm[]`,
    );
  }

  mainnetEntry.executorAddress = executorAddress;

  fs.writeFileSync(
    CONFIG_STAGING_PATH,
    JSON.stringify(config, null, 2),
    "utf-8",
  );
  console.log(
    `  ✅ config.staging.json → evm[ethereum-mainnet].executorAddress updated`,
  );
}

/**
 * Applies all three file updates atomically after vNet creation.
 * Called by both createVnet() and getOrCreateVnet().
 */
function syncVnetToConfigs(vnet: VNetDetails): void {
  console.log("\n📝 Syncing vNet details to project configs...");
  updateEnv("VNET_ADMIN_RPC_URL", vnet.adminRpc);
  updateProjectYaml(vnet.publicRpc);
  updateConfigStaging(vnet.executorAddress);
  console.log("✅ All configs synced.\n");
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getOrCreateVnet(): Promise<VNetDetails> {
  if (fs.existsSync(VNET_JSON_PATH)) {
    const cached = JSON.parse(
      fs.readFileSync(VNET_JSON_PATH, "utf-8"),
    ) as VNetDetails;
    console.log(`✅ vNet loaded from cli/.vnet.json`);

    // Always re-sync configs — handles cases where .env or project.yaml
    // was reset (e.g. fresh git clone, CI environment)
    syncVnetToConfigs(cached);
    return cached;
  }
  return createVnet();
}

export async function createVnet(): Promise<VNetDetails> {
  console.log("🌐 Creating new Tenderly vNet...");

  const res = await fetch(`${baseUrl()}/vnets`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      slug: `defi-profiler-${Date.now()}`,
      display_name: `DeFi Strategy Profiler ${new Date().toISOString()}`,
      fork_config: {
        network_id: 1,
        block_number: "latest",
      },
      virtual_network_config: {
        chain_config: { chain_id: 1 },
      },
      rpc_config: { rpc_name: "DeFi-Strategy-Profiler" },
      sync_state_config: { enabled: true },
      explorer_page_config: {
        enabled: true,
        verification_visibility: "src",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tenderly vNet creation failed: ${err}`);
  }

  const data = (await res.json()) as TenderlyVNetResponse;
  const vnet = parseVNet(data);

  // ── Persist vNet details to cli/.vnet.json ──────────────────────────
  fs.writeFileSync(VNET_JSON_PATH, JSON.stringify(vnet, null, 2));
  console.log(`✅ New vNet created → cli/.vnet.json`);

  // ── Fund deployer + executor accounts ───────────────────────────────
  const amount = toHex(parseEther(process.env.VNET_FUND_ETH || "10"));

  console.log(`→ Funding deployer  (${vnet.deployerAddress})`);
  await setBalance(vnet.adminRpc, vnet.deployerAddress, amount);

  console.log(`→ Funding executor  (${vnet.executorAddress})`);
  await setBalance(vnet.adminRpc, vnet.executorAddress, amount);

  // ── Auto-update all dependent config files ───────────────────────────
  syncVnetToConfigs(vnet);

  return vnet;
}

export async function setBalance(
  adminRpc: string,
  address: string,
  amountHex: string,
): Promise<void> {
  const res = await fetch(adminRpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tenderly_setBalance",
      params: [address, amountHex],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `tenderly_setBalance failed for ${address}: ${res.statusText}`,
    );
  }
}
