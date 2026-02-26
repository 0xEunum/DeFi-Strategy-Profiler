import * as fs from "fs";
import * as path from "path";
import { requireEnv } from "../utils";
import type { TenderlyVNetResponse, VNetDetails } from "../types";
import { parseEther, toHex } from "viem";

const VNET_PATH = path.resolve(__dirname, "../.vnet.json");

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

export async function getOrCreateVnet(): Promise<VNetDetails> {
  if (fs.existsSync(VNET_PATH)) {
    const cached = JSON.parse(
      fs.readFileSync(VNET_PATH, "utf-8"),
    ) as VNetDetails;
    console.log(`✅  vNet loaded from cli/.vnet.json`);
    return cached;
  }
  return createVnet();
}

export async function createVnet(): Promise<VNetDetails> {
  const res = await fetch(`${baseUrl()}/vnets`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      slug: `defi-profiler-${Date.now()}`,
      display_name: `DeFi Strategy Profiler ${new Date().toISOString()}`,
      fork_config: { network_id: 1, block_number: "latest" },
      virtual_network_config: { chain_config: { chain_id: 1 } },
      rpc_config: { rpc_name: "DeFi-Strategy-Profiler" },
      sync_state_config: { enabled: true },
      explorer_page_config: {
        enabled: true,
        verification_visibility: "src",
      },
    }),
  });

  const data = (await res.json()) as any;
  const vnet = parseVNet(data as TenderlyVNetResponse);

  fs.writeFileSync(VNET_PATH, JSON.stringify(vnet, null, 2));
  console.log(`✅ New vNet created → cli/.vnet.json`);
  const amount = toHex(parseEther(process.env.VNET_FUND_ETH || "10"));

  // Fund both accounts
  console.log(`→ Funding deployer  (${vnet.deployerAddress})`);
  await setBalance(vnet.adminRpc, vnet.deployerAddress, amount);

  console.log(`→ Funding executor  (${vnet.executorAddress})`);
  await setBalance(vnet.adminRpc, vnet.executorAddress, amount);
  return vnet;
}

export async function setBalance(
  adminRpc: string,
  address: string,
  amountHex: string,
): Promise<void> {
  await fetch(adminRpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tenderly_setBalance",
      params: [address, amountHex],
    }),
  });
}
