# CLI

TypeScript tooling for managing the full DeFi Strategy Profiler workflow — vNet lifecycle, strategy deployment, simulation requests, and report polling.

---

## Structure

```
cli/
├── abis/
│   ├── simulationRegistry_abi.ts
│   └── simulationJobQueue_abi.ts
├── scripts/
│   ├── createVnet.ts       Create Tenderly vNet + sync all configs
│   ├── deployStrategy.ts   Deploy a single strategy to vNet
│   └── provision.ts        Full flow — deploy + request simulation
├── src/
│   ├── tenderly.ts         Tenderly API — vNet create/get, fund accounts, config sync
│   ├── deploy.ts           Forge script wrapper + .strategies.json cache
│   └── registry.ts         SimulationRegistry — requestSimulation, pollForReport, printReport
├── .vnet.json              Auto-generated — active vNet state (gitignored)
├── .strategies.json        Auto-generated — deployed strategy cache (gitignored)
├── types.ts                Shared TypeScript interfaces
└── utils.ts                requireEnv helper
```

---

## Commands

> Run from inside `cli/` — or use the `npm run cli:*` prefix from the monorepo root.

```bash
# ── Setup ────────────────────────────────────────────────────────
npm run setup              # Create vNet + auto-sync all configs
npm run setup:new          # Force-create a fresh vNet (wipes old one)

# ── Deploy only (manual step) ────────────────────────────────────
npm run deploy:0           # Deploy EthToUsdcSwapStrategy to vNet
npm run deploy:1           # Deploy EthToUsdcDaiMultiHopStrategy to vNet
npm run deploy:2           # Deploy FailingSlippageStrategy to vNet

# ── Full flow (deploy + request simulation in one command) ────────
npm run provision:0
npm run provision:1
npm run provision:2
```

`npm run deploy` is useful when you want to verify the deployment separately before triggering a simulation, or redeploy after a vNet reset without running the full flow.

> Deployed addresses are cached in `cli/.strategies.json` — running `npm run deploy:0` twice on the same vNet returns the cached address instantly without redeploying.

---

## npm run setup

Creates a Tenderly Virtual TestNet forked from Ethereum mainnet and auto-syncs three config files so the CRE workflows are immediately ready to use.

**What it does:**

1. Calls `Tenderly API` — creates vNet fork of mainnet at latest block
2. Funds `deployerAddress` (accounts[0]) and `executorAddress` (accounts[1]) with ETH
3. Saves vNet state to `cli/.vnet.json`
4. Auto-syncs:
   - `VNET_ADMIN_RPC_URL` → `root/.env`
   - `executorAddress` → `cre/config.staging.json`
   - `ethereum-mainnet.url` → `cre/project.yaml`

On subsequent runs, if `cli/.vnet.json` exists, it returns the cached vNet instead of creating a new one. Use `npm run setup:new` to force a fresh fork.

---

## npm run provision:\<index\>

Runs the complete simulation flow end-to-end.

```
1. getOrCreateVnet()       reads .vnet.json or creates new vNet
2. deployStrategy(index)   deploys strategy via forge script (cached in .strategies.json)
3. requestSimulation()     calls SimulationRegistry.requestSimulation(strategyAddr, explorerUrl) on Sepolia
4. prints runId + links    Sepolia tx, vNet explorer
5. pollForReport()         if POLL_FOR_RESULT=true, polls until CRE writes result
```

---

## State Files

### `cli/.vnet.json`

Stores the active Tenderly vNet. Created by `npm run setup`, read by every subsequent command.

```json
{
  "id": "725c010c-...",
  "displayName": "defi-strategy-profiler",
  "adminRpc": "https://virtual.mainnet.eu.rpc.tenderly.co/...",
  "publicRpc": "https://virtual.mainnet.eu.rpc.tenderly.co/...",
  "explorerUrl": "https://dashboard.tenderly.co/explorer/vnet/...",
  "chainId": 1,
  "forkBlock": 245...,
  "deployerAddress": "0x...",
  "executorAddress": "0x..."
}
```

### `cli/.strategies.json`

Caches deployed strategy addresses per vNet. Prevents redundant redeployments on every `provision` run.

```json
{
  "vnetId": "725c010c-...",
  "strategies": [
    {
      "strategyIndex": 0,
      "strategyName": "EthToUsdcSwapStrategy",
      "address": "0x...",
      "verified": true
    }
  ]
}
```

If a new vNet is created (new `vnetId`), the cache is automatically invalidated — addresses from the old fork are meaningless on a new one.

> Both files are gitignored. They are machine-local state.

---

## Simulation Report Output

When `POLL_FOR_RESULT=true`, the terminal prints a full human-readable report after CRE completes:

```
📊 SIMULATION REPORT
────────────────────────────────────────────────────
Status:         ✅ SUCCESS
Strategy:       EthToUsdcSwapStrategy
                0x...
Caller:         0x...
Network:        Chain 1 — fork block #24,5...

💱 Token Flow:
  Token In:     WETH     0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
  Token Out:    USDC     0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
  Amount In:    0.1 WETH
  Amount Out:   204.659248 USDC
  Rate:         1 WETH = 2,046.5925 USDC

⛽ Gas Metrics:
  Gas Used:     135,960 units
  Gas Price:    0.05 gwei (46,920,053 wei)
  Total Cost:   0.00000638 ETH (6,379,250,405,880 wei)

🔗 Links:
  vNet Explorer: https://dashboard.tenderly.co/explorer/vnet/...
  Registry:      https://sepolia.etherscan.io/address/0xcE577...
────────────────────────────────────────────────────
```

Exchange rate is calculated directly from `amountOut / amountIn` — it reflects the **actual executed rate** including Uniswap fees and slippage, not a spot price from an external API.

If `POLL_FOR_RESULT=false`, the CLI exits immediately after printing the Run ID and links. CRE workflows still execute in the background — check the frontend at `/run/<runId>` for results.

---

## Environment Variables

All values are read from `root/.env`. The CLI will throw a clear error if any required variable is missing.

| Variable                | Required | Set by                                |
| ----------------------- | -------- | ------------------------------------- |
| `CRE_ETH_PRIVATE_KEY`   | Yes      | Manual — your Sepolia EOA             |
| `SEPOLIA_RPC_URL`       | Yes      | Pre-filled in `.env.example`          |
| `TENDERLY_ACCESS_KEY`   | Yes      | Manual                                |
| `TENDERLY_ACCOUNT_SLUG` | Yes      | Manual                                |
| `TENDERLY_PROJECT_SLUG` | Yes      | Manual                                |
| `VNET_ADMIN_RPC_URL`    | Yes      | `npm run setup` — do not set manually |
| `REGISTRY_ADDRESS`      | Yes      | Pre-filled in `.env.example`          |
| `JOB_QUEUE_ADDRESS`     | Yes      | Pre-filled in `.env.example`          |
| `VNET_FUND_ETH`         | No       | Default: `10`                         |
| `POLL_FOR_RESULT`       | No       | Default: `true`                       |

---

## Custom Registry Contracts

By default the CLI uses shared deployed contracts on Sepolia. If you want your own isolated deployment:

1. Deploy: `cd contracts && forge script script/DeploySepolia.s.sol --broadcast --rpc-url <SEPOLIA_RPC_URL> --private-key <PRIVATE_KEY>`
2. Update `REGISTRY_ADDRESS` and `JOB_QUEUE_ADDRESS` in `root/.env`
3. Update `registryAddress` and `jobQueueAddress` in `cre/config.staging.json`
