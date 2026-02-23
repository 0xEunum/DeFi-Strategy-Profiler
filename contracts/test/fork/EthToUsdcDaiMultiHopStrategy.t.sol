// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {EthToUsdcDaiMultiHopStrategy} from "../../src/strategies/EthToUsdcDaiMultiHopStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Fork tests for EthToUsdcDaiMultiHopStrategy.
///         Two-hop: ETH → WETH -[500]→ USDC -[100]→ DAI via Uniswap v3.
///
/// @dev    forge test --match-path test/fork/EthToUsdcDaiMultiHopStrategy.t.sol \
///                    --fork-url $MAINNET_RPC_URL -vvvv
contract EthToUsdcDaiMultiHopStrategyTest is Test {
    // ── Contracts ──────────────────────────────────────────────────────────
    EthToUsdcDaiMultiHopStrategy strategy;

    // ── Constants ─────────────────────────────────────────────────────────
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant EXECUTOR = address(0xE2);

    // ── Setup ─────────────────────────────────────────────────────────────
    function setUp() public {
        strategy = new EthToUsdcDaiMultiHopStrategy();
        vm.deal(EXECUTOR, 100 ether);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Interface compliance
    // ──────────────────────────────────────────────────────────────────────

    function test_interface_nameIsSet() public view {
        string memory name = strategy.NAME();
        assertGt(bytes(name).length, 0);
        console.log("Strategy name:", name);
    }

    function test_interface_tokenOutIsDAI() public view {
        assertEq(strategy.TOKEN_OUT(), DAI);
    }

    // ──────────────────────────────────────────────────────────────────────
    // execute — success path
    // ──────────────────────────────────────────────────────────────────────

    function test_execute_swapsEthForDai() public {
        uint256 amountIn = 1 ether;
        uint256 balanceBefore = IERC20(DAI).balanceOf(EXECUTOR);

        vm.prank(EXECUTOR);
        uint256 amountOut = strategy.execute{value: amountIn}(EXECUTOR, abi.encode(uint256(1)));

        uint256 balanceAfter = IERC20(DAI).balanceOf(EXECUTOR);

        console.log("ETH in        :", amountIn);
        console.log("DAI out       :", amountOut);
        console.log("Balance delta :", balanceAfter - balanceBefore);

        assertGt(amountOut, 0, "amountOut must be positive");
        // DAI tracks USD ~1:1, 1 ETH should yield >100 DAI at any realistic price
        assertGt(amountOut, 100 ether, "expect >100 DAI for 1 ETH");
        assertEq(balanceAfter - balanceBefore, amountOut, "balance delta must match return");
    }

    function test_execute_receiverGetsDAI() public {
        address receiver = address(0xBEEF);

        vm.prank(EXECUTOR);
        uint256 amountOut = strategy.execute{value: 1 ether}(receiver, abi.encode(uint256(1)));

        // Receiver gets DAI; executor and strategy hold nothing
        assertEq(IERC20(DAI).balanceOf(receiver), amountOut);
        assertEq(IERC20(DAI).balanceOf(EXECUTOR), 0);
        assertEq(IERC20(DAI).balanceOf(address(strategy)), 0);
    }

    function test_execute_strategyHoldsNoLeftovers() public {
        // Snapshot before — fork may have pre-existing dust balances at this address
        uint256 stratEthBefore = address(strategy).balance;
        uint256 stratDaiBefore = IERC20(DAI).balanceOf(address(strategy));
        uint256 stratUsdcBefore = IERC20(USDC).balanceOf(address(strategy));

        vm.prank(EXECUTOR);
        strategy.execute{value: 1 ether}(EXECUTOR, abi.encode(uint256(1)));

        // No accumulation in strategy after execution
        assertEq(address(strategy).balance, stratEthBefore, "ETH stuck");
        assertEq(IERC20(DAI).balanceOf(address(strategy)), stratDaiBefore, "DAI stuck");
        assertEq(IERC20(USDC).balanceOf(address(strategy)), stratUsdcBefore, "USDC stuck mid-hop");
    }

    function test_execute_usesMoreGasThanSingleHop() public {
        // Single hop reference: ~150k gas
        uint256 singleHopRef = 150_000;

        vm.prank(EXECUTOR);
        uint256 gasBefore = gasleft();
        strategy.execute{value: 1 ether}(EXECUTOR, abi.encode(uint256(1)));
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Multi-hop gas used:", gasUsed);

        // Multi-hop must cost more than a single hop — this is the profiling value
        assertGt(gasUsed, singleHopRef, "multi-hop should cost more than single hop");
        // But still reasonable
        assertLt(gasUsed, 400_000, "multi-hop should use < 400k gas");
    }

    // ──────────────────────────────────────────────────────────────────────
    // execute — revert path
    // ──────────────────────────────────────────────────────────────────────

    function test_execute_reverts_withZeroEth() public {
        vm.prank(EXECUTOR);
        vm.expectRevert("EthToUsdcDaiMultiHop: no ETH sent");
        strategy.execute{value: 0}(EXECUTOR, abi.encode(uint256(1)));
    }

    function test_execute_reverts_withImpossibleMinAmountOut() public {
        vm.prank(EXECUTOR);
        vm.expectRevert();
        strategy.execute{value: 1 ether}(EXECUTOR, abi.encode(type(uint256).max));
    }

    // ──────────────────────────────────────────────────────────────────────
    // Fuzz
    // ──────────────────────────────────────────────────────────────────────

    function testFuzz_execute_variousEthAmounts(uint96 ethAmount) public {
        vm.assume(ethAmount > 0.01 ether);
        vm.assume(ethAmount < 50 ether);

        vm.deal(EXECUTOR, ethAmount);

        uint256 balanceBefore = IERC20(DAI).balanceOf(EXECUTOR);

        vm.prank(EXECUTOR);
        uint256 amountOut = strategy.execute{value: ethAmount}(EXECUTOR, abi.encode(uint256(1)));

        uint256 balanceAfter = IERC20(DAI).balanceOf(EXECUTOR);

        assertGt(amountOut, 0);
        assertEq(balanceAfter - balanceBefore, amountOut);
    }
}
