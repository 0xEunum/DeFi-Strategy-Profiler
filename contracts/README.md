# Contracts

Solidity smart contracts for the DeFi Strategy Profiler — deployed on Sepolia for coordination and proof storage, with strategy contracts deployed on the Tenderly Virtual TestNet.

---

## Structure

```
contracts/
├── script/
│   ├── DeploySepolia.s.sol       Deploys SimulationRegistry + SimulationJobQueue to Sepolia
│   └── DeployStrategy.s.sol      Deploys a strategy contract to Tenderly vNet
├── src/
│   ├── SimulationRegistry.sol    Core — accepts simulation requests, stores signed reports
│   ├── SimulationJobQueue.sol    CRE-gated message bus between wf-listener and wf-executor
│   ├── strategies/
│   │   ├── EthToUsdcSwapStrategy.sol             Single-hop WETH → USDC via Uniswap V3
│   │   ├── EthToUsdcDaiMultiHopStrategy.sol      Multi-hop WETH → DAI → USDC
│   │   └── FailingSlippageStrategy.sol           Intentionally reverts — revert capture demo
│   └── interfaces/
│       ├── IDeFiStrategy.sol         Strategy interface — implement this for any strategy
│       └── ReceiverTemplate.sol      CRE Forwarder receiver base — inherited by JobQueue
├── test/
│   ├── SimulationRegistry.t.sol
│   └── SimulationJobQueue.t.sol
├── broadcast/                        Forge broadcast files — deployment receipts
├── foundry.toml
└── README.md
```

---

## Deployed Contracts (Sepolia)

| Contract             | Address                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SimulationRegistry` | [`0x6C60a2dEbD7a0406fB08133c44FC0bAeB2424e7d`](https://sepolia.etherscan.io/address/0x6C60a2dEbD7a0406fB08133c44FC0bAeB2424e7d) |
| `SimulationJobQueue` | [`0x9E3EA28542fD36B062ac768037fFb93708529Ad1`](https://sepolia.etherscan.io/address/0x9E3EA28542fD36B062ac768037fFb93708529Ad1) |

These are shared — anyone can use them. See [Custom Deployment](#custom-deployment) if you want your own.

---

## Core Contracts

### `SimulationRegistry.sol`

The main coordination contract on Sepolia. Two roles:

**1. Job intake** — called by the developer

```solidity
function requestSimulation(address strategy, string calldata explorerUrl)
    external returns (uint256 runId);
```

Stores the request, emits `SimulationQueued(runId, strategy, caller, explorerUrl)`, which triggers `wf-listener`.

**2. Proof storage** — called by `wf-executor` via CRE Forwarder

```solidity
function writeReport(uint256 runId, bytes calldata report) external;
```

Decodes and stores the `SimulationReport` signed by the Chainlink DON. Once written, the result is permanent and queryable by anyone:

```solidity
function getRunIdentity(uint256 runId) external view returns (RunIdentity memory);
function getRunOutcome(uint256 runId) external view returns (RunOutcome memory);
```

---

### `SimulationJobQueue.sol`

A `ReceiverTemplate` consumer that acts as a **CRE-gated message bus** between `wf-listener` and `wf-executor`.

`wf-listener` calls `onReport(encodedJobReport)` via the CRE Forwarder. The contract:

1. Verifies the call came from the CRE Forwarder — not a user
2. Decodes `JobReport { runId, strategy, caller, explorerUrl }`
3. Checks `s_jobExists[runId]` — rejects duplicate enqueues from retries
4. Stores the job in `s_jobs[runId]`
5. Emits `JobEnqueued(runId, strategy, caller, explorerUrl)` — triggers `wf-executor`

Direct user interaction with this contract is not possible. Only the CRE Forwarder address can write to it.

---

## Strategy Interface

Any contract that implements `IDeFiStrategy` can be profiled:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDeFiStrategy {
    /// @notice Input token address (e.g. WETH)
    function TOKEN_IN() external view returns (address);

    /// @notice Output token address (e.g. USDC)
    function TOKEN_OUT() external view returns (address);

    /// @notice Execute the strategy with msg.value as ETH input.
    /// @param receiver  Address that receives TOKEN_OUT at the end.
    /// @param params    ABI-encoded extra params (minAmountOut, path flags, etc.)
    /// @return amountOut Actual TOKEN_OUT received.
    function execute(address receiver, bytes calldata params)
        external payable returns (uint256 amountOut);
}
```

---

## Pre-Defined Strategies

### `EthToUsdcSwapStrategy` — index `0`

Single-hop WETH → USDC swap via Uniswap V3 on mainnet fork.

```
TOKEN_IN:  WETH  0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
TOKEN_OUT: USDC  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
Pool fee:  0.05%
```

### `EthToUsdcDaiMultiHopStrategy` — index `1`

Multi-hop WETH → DAI → USDC swap via Uniswap V3 — demonstrates multi-hop path encoding.

```
TOKEN_IN:  WETH  0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
TOKEN_OUT: USDC  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
Path:      WETH -[0.3%]→ DAI -[0.05%]→ USDC
```

### `FailingSlippageStrategy` — index `2`

Intentionally reverts with a slippage error — demonstrates that failed simulations are also captured and stored on-chain with a `revertReasonHash`.

---

## Implementing Your Own Strategy

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDeFiStrategy} from "./interfaces/IDeFiStrategy.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract MyStrategy is IDeFiStrategy {
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    ISwapRouter constant router = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    function TOKEN_IN()  external pure returns (address) { return WETH; }
    function TOKEN_OUT() external pure returns (address) { return USDC; }

    /// @notice Execute the strategy with msg.value as ETH input.
    /// @param receiver  Address that receives TOKEN_OUT at the end.
    /// @param params    ABI-encoded extra params (minAmountOut, path flags, etc.)
    /// @return amountOut Actual TOKEN_OUT received.
    function execute(
        address receiver,
        bytes calldata params
    ) external payable returns (uint256 amountOut) {
        // your swap / DeFi logic here
    }
}
```

Once deployed to the vNet, call `requestSimulation(yourStrategyAddr, explorerUrl)` on `SimulationRegistry` — or use `npm run cli:provision:*` if deploying via the CLI.

---

## Custom Deployment

If you want your own isolated `SimulationRegistry` and `SimulationJobQueue` on Sepolia:

```bash
cd contracts

forge script script/DeploySepolia.s.sol \
  --rpc-url <SEPOLIA_RPC_URL> \
  --private-key <CRE_ETH_PRIVATE_KEY> \
  --broadcast \
  --verify --etherscan-api-key <ETHERSCAN_API_KEY>
```

After deploying:

1. Update `REGISTRY_ADDRESS` + `JOB_QUEUE_ADDRESS` in `root/.env`
2. Update `registryAddress` + `jobQueueAddress` in `cre/config.staging.json`

No other changes needed.
