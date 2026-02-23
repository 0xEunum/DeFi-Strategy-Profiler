// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SimulationRegistry} from "../src/SimulationRegistry.sol";
import {SimulationJobQueue} from "../src/SimulationJobQueue.sol";

/// @notice Deploys SimulationRegistry + SimulationJobQueue to Sepolia.
///         Run once. Both contracts are CRE forwarder consumers.
/// @dev    forge script script/DeploySepolia.s.sol \
///           --rpc-url $SEPOLIA_RPC_URL \
///           --broadcast --verify \
///           --etherscan-api-key $ETHERSCAN_API_KEY -vvvv
contract DeploySepolia is Script {
    function run() external {
        address sepoliaSimulationForwarder = 0x15fC6ae953E024d975e77382eEeC56A9101f9F88;

        vm.startBroadcast();

        SimulationJobQueue queue = new SimulationJobQueue(sepoliaSimulationForwarder);
        SimulationRegistry registry = new SimulationRegistry(sepoliaSimulationForwarder);

        vm.stopBroadcast();

        console.log("SimulationJobQueue  :", address(queue));
        console.log("SimulationRegistry  :", address(registry));
    }
}
