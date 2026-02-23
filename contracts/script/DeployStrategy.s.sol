// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {EthToUsdcSwapStrategy} from "../src/strategies/EthToUsdcSwapStrategy.sol";
import {EthToUsdcDaiMultiHopStrategy} from "../src/strategies/EthToUsdcDaiMultiHopStrategy.sol";
import {FailingSlippageStrategy} from "../src/strategies/FailingSlippageStrategy.sol";

/// @notice Deploys a chosen DeFiStrategy to a Tenderly Virtual TestNet.
///         The vNet RPC is passed via TENDERLY_VNET_RPC env var.
///         Contract is also verified on the vNet explorer via TENDERLY_VERIFIER_URL.
///
/// @dev    forge script script/DeployStrategy.s.sol \
///           --rpc-url $TENDERLY_VNET_RPC \
///           --slow \
///           --broadcast \
///           --verify \
///           --verifier custom \
///           --verifier-url $TENDERLY_VERIFIER_URL \
///           --sig "run(uint8)" <0|1|2> -vvvv
///
///         Strategy index:
///           0 = EthToUsdcSwapStrategy
///           1 = EthToStEthMultiHopStrategy
///           2 = FailingSlippageStrategy
contract DeployStrategy is Script {
    function run(uint8 strategyIndex) external {
        vm.startBroadcast();

        address deployed;

        if (strategyIndex == 0) {
            deployed = address(new EthToUsdcSwapStrategy());
            console.log("EthToUsdcSwapStrategy      :", deployed);
        } else if (strategyIndex == 1) {
            deployed = address(new EthToUsdcDaiMultiHopStrategy());
            console.log("EthToUsdcDaiMultiHopStrategy :", deployed);
        } else if (strategyIndex == 2) {
            deployed = address(new FailingSlippageStrategy());
            console.log("FailingSlippageStrategy    :", deployed);
        } else {
            revert("DeployStrategy: invalid index (use 0, 1, or 2)");
        }

        vm.stopBroadcast();
    }
}
