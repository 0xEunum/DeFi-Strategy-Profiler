# CRE — Chainlink Runtime Environment Workflows

Two TypeScript workflows that orchestrate the full simulation pipeline — triggered by on-chain events, executed on Tenderly Virtual TestNet, results written back on-chain as a DON-signed proof.

---

## Structure

```
cre/
├── listener-workflow/
│   ├── main.ts             Entry point — decodes event, validates, encodes JobReport
│   ├── logCallback.ts      Handles SimulationQueued log trigger callback
│   └── workflow.yaml       Workflow-specific settings for CRE CLI targets
├── executor-workflow/
│   ├── main.ts             Entry point — decodes event, calls execute(), signs report
│   ├── logCallback.ts      Handles JobEnqueued log trigger callback
│   └── workflow.yaml       Workflow-specific settings for CRE CLI targets
├── config.staging.json     Contract addresses + gas limits (Sepolia + vNet)
├── project.yaml            RPC endpoints for staging + production targets
├── secrets.yaml            CRE secrets reference (API keys, private keys via 1Password)
├── Config.ts               TypeScript types for config.staging.json + project.yaml
└── README.md
```

---

## Commands

> Run from inside `cre/` — or use the `npm run cre:*` prefix from the monorepo root.

```bash
# ── From monorepo root ────────────────────────────────────────────
npm run cre:listener       # Start wf-listener workflow
npm run cre:executor       # Start wf-executor workflow

# ── From inside cre/ ─────────────────────────────────────────────
npm run listener           # Start wf-listener workflow
npm run executor           # Start wf-executor workflow
```

Both workflows are long-running processes — run them in separate terminals. Start `cre:listener` first so no `SimulationQueued` events are missed between provisioning and executor startup.

> Both workflows must be running before or immediately after `npm run cli:provision:*` — the CRE CLI picks up events from the point it starts listening.

---

## Workflows

### listener-workflow

**Trigger:** `logTrigger` — `SimulationQueued(runId, strategy, caller, explorerUrl)` on `SimulationRegistry` (Sepolia)

**Capabilities used — in order:**

| Step | Capability              | What it does                                                                                                                  |
| ---- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | —                       | Decodes `SimulationQueued` log via `decodeEventLog`                                                                           |
| 2    | —                       | Validates `runId`, `strategy` address, `explorerUrl`                                                                          |
| 3    | —                       | ABI-encodes `JobReport { runId, strategy, caller, explorerUrl }`                                                              |
| 4    | `consensus`             | `runtime.report()` — DON signs the encoded payload (`encoderName: "evm"`, `signingAlgo: "ecdsa"`, `hashingAlgo: "keccak256"`) |
| 5    | `EVMClient.writeReport` | Sends signed `JobReport` to `SimulationJobQueue.onReport()` via CRE Forwarder on Sepolia                                      |

**Why it exists:**

`SimulationQueued` is emitted by raw user input — anyone can call `requestSimulation()` with a malicious or malformed strategy address. `wf-listener` acts as a validation + attestation layer. By the time `JobEnqueued` fires, the job has been verified and signed by the Chainlink DON.

---

### executor-workflow

**Trigger:** `logTrigger` — `JobEnqueued(runId, strategy, caller, explorerUrl)` on `SimulationJobQueue` (Sepolia)

**Capabilities used — in order:**

| Step           | Capability                 | What it does                                                                                                                                                                                          |
| -------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1              | —                          | Decodes `JobEnqueued` log via `decodeEventLog`                                                                                                                                                        |
| 2              | `EVMClient.callContract`   | Reads `TOKEN_OUT()` from strategy contract on vNet (forked mainnet EVMClient)                                                                                                                         |
| 3              | `EVMClient.callContract`   | Reads `balanceOf(executorAddr)` — TOKEN_OUT balance **before** execution on vNet                                                                                                                      |
| 4              | `HTTPClient`               | Fetches current gas price via `eth_gasPrice` on Tenderly Admin RPC                                                                                                                                    |
| 5              | `HTTPClient` + `consensus` | Sends `eth_sendTransaction` — calls `strategy.execute(receiver, params)` on vNet via Admin RPC (unlocked sender, no private key)                                                                      |
| 6              | `HTTPClient` + `consensus` | Polls `eth_getTransactionReceipt` with retries until confirmed                                                                                                                                        |
| 7a _(success)_ | `EVMClient.callContract`   | Reads `balanceOf(executorAddr)` — TOKEN_OUT balance **after** execution; `amountOut = balAfter - balBefore`                                                                                           |
| 7b _(revert)_  | `HTTPClient`               | Replays via `eth_call` with `allowError: true` — extracts revert data, hashes via `keccak256`                                                                                                         |
| 8              | —                          | ABI-encodes full `SimulationReport { runId, chainId, forkBlock, tokenIn, tokenOut, amountIn, amountOut, gasUsed, effectiveGasPrice, totalCostInTokenIn, paramsHash, success, revertReasonHash, ... }` |
| 9              | `consensus`                | `prepareReportRequest()` — DON signs the encoded `SimulationReport`                                                                                                                                   |
| 10             | `EVMClient.writeReport`    | Writes signed `SimulationReport` to `SimulationRegistry.writeReport(runId, report)` via CRE Forwarder on Sepolia                                                                                      |

> **Note on `consensus`:** The executor uses `consensusIdenticalAggregation` inside both `vnetRpc()` and `pollVnetReceipt()` helper functions — all DON nodes must observe the same HTTP response before the result is accepted. This means `strategy.execute()` output is consensus-verified, not just from a single node.

---

## Why Two Workflows Instead of One?

A single workflow listening directly on `SimulationQueued` and calling `strategy.execute()` immediately would be unsafe:

| Risk                       | With single workflow            |
| -------------------------- | ------------------------------- |
| Malicious strategy address | Executor acts on raw user input |
| Duplicate execution        | No replay protection            |
| Malformed explorerUrl      | No validation before execution  |

The two-workflow design uses `SimulationJobQueue` as a **CRE-gated message bus**:

```
SimulationQueued  (untrusted user input)
      ↓
  wf-listener  validates + encodes JobReport
      ↓
  SimulationJobQueue.onReport()  — CRE Forwarder signature verified on-chain
      ↓
  JobEnqueued  (CRE-attested, trusted)
      ↓
  wf-executor  safe to execute
```

`SimulationJobQueue` enforces two guarantees on-chain:

- **Forwarder-gated** — `ReceiverTemplate` only accepts calls from the CRE Forwarder address
- **Replay protection** — `s_jobExists[runId]` rejects duplicate enqueues from `wf-listener` retries

A single workflow listening directly on `SimulationQueued` and calling `strategy.execute()` immediately would be unsafe:

| Risk                       | With single workflow            |
| -------------------------- | ------------------------------- |
| Malicious strategy address | Executor acts on raw user input |
| Duplicate execution        | No replay protection            |
| Malformed explorerUrl      | No validation before execution  |

The two-workflow design uses `SimulationJobQueue` as a **CRE-gated message bus**:

```
SimulationQueued  (untrusted user input)
      ↓
  wf-listener  validates + encodes JobReport
      ↓
  SimulationJobQueue.onReport()  — CRE Forwarder signature verified on-chain
      ↓
  JobEnqueued  (CRE-attested, trusted)
      ↓
  wf-executor  safe to execute
```

`SimulationJobQueue` enforces two guarantees on-chain:

- **Forwarder-gated** — `ReceiverTemplate` only accepts calls from the CRE Forwarder address
- **Replay protection** — `s_jobExists[runId]` rejects duplicate enqueues from `wf-listener` retries

---

## Configuration

### `config.staging.json`

Defines contract addresses and gas limits for both chains the workflows interact with.

```json
{
  "evm": [
    {
      "chainSelectorName": "ethereum-testnet-sepolia",
      "registryAddress": "0x6C60a2dEbD7a0406fB08133c44FC0bAeB2424e7d",
      "jobQueueAddress": "0x9E3EA28542fD36B062ac768037fFb93708529Ad1",
      "gasLimit": "2000000"
    },
    {
      "chainSelectorName": "ethereum-mainnet",
      "executorAddress": "0x...",
      "executionEthAmount": "100000000000000000",
      "gasLimit": "500000"
    }
  ]
}
```

> `executorAddress` under `ethereum-mainnet` is **auto-filled by `npm run setup`**. It is the vNet account used as the unlocked sender for `strategy.execute()`. Do not edit manually.

### `project.yaml`

Defines RPC endpoints per CRE target.

```yaml
staging-settings:
  rpcs:
    - chain-name: ethereum-testnet-sepolia
      url: https://ethereum-sepolia-rpc.publicnode.com

    - chain-name: ethereum-mainnet
      url: https://virtual.mainnet.eu.rpc.tenderly.co/...
      # ↑ AUTO-FILLED by npm run setup
```

> `ethereum-mainnet.url` under `staging-settings` is **auto-filled by `npm run setup`**. It points to the Tenderly vNet public RPC for the current fork. Do not edit manually.

---

## Running Workflows

```bash
# From root — terminal 1
npm run cre:listener

# From root — terminal 2
npm run cre:executor
```

Or directly via CRE CLI from the `cre/` directory:

```bash
# listener
npm run listener

# executor
npm run executor
```

---

## Custom Contract Deployment

By default both workflows use the shared deployed contracts. If you deploy your own:

1. Deploy `SimulationRegistry` + `SimulationJobQueue` on Sepolia
2. Update `registryAddress` + `jobQueueAddress` in `config.staging.json`
3. Update `REGISTRY_ADDRESS` + `JOB_QUEUE_ADDRESS` in `root/.env`

No changes to `project.yaml` or workflow code are needed.

---

## CRE Target

The active CRE target is controlled by `CRE_TARGET` in `root/.env`.

```bash
CRE_TARGET=staging-settings    # default — uses Tenderly vNet
CRE_TARGET=production-settings # production — no vNet, mainnet only
```
