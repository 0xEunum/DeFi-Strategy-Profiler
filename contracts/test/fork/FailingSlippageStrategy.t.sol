// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {FailingSlippageStrategy} from "../../src/strategies/FailingSlippageStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Fork tests for FailingSlippageStrategy.
///         This strategy is DESIGNED to always revert.
///         Tests confirm the revert is consistent and the on-chain
///         state is clean after a failed execution.
///
/// @dev    forge test --match-path test/fork/FailingSlippageStrategy.t.sol \
///                    --fork-url $MAINNET_RPC_URL -vvvv
contract FailingSlippageStrategyTest is Test {
    // ── Contracts ──────────────────────────────────────────────────────────
    FailingSlippageStrategy strategy;

    // ── Constants ─────────────────────────────────────────────────────────
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant EXECUTOR = address(0xE3);

    // ── Setup ─────────────────────────────────────────────────────────────
    function setUp() public {
        strategy = new FailingSlippageStrategy();
        vm.deal(EXECUTOR, 100 ether);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Interface compliance
    // ──────────────────────────────────────────────────────────────────────

    function test_interface_nameIndicatesFailure() public view {
        string memory name = strategy.NAME();
        assertGt(bytes(name).length, 0);
        console.log("Strategy name:", name);
        // Name should communicate this is a demo failure strategy
    }

    function test_interface_tokenOutIsUSDC() public view {
        assertEq(strategy.TOKEN_OUT(), USDC);
    }

    // ──────────────────────────────────────────────────────────────────────
    // execute — always reverts (this IS the expected behaviour)
    // ──────────────────────────────────────────────────────────────────────

    function test_execute_alwaysReverts_1eth() public {
        vm.prank(EXECUTOR);
        vm.expectRevert(); // Uniswap v3: "Too little received" (STF)
        strategy.execute{value: 1 ether}(
            EXECUTOR,
            abi.encode(uint256(0)) // params ignored — strategy forces type(uint256).max
        );
    }

    function test_execute_alwaysReverts_smallAmount() public {
        vm.prank(EXECUTOR);
        vm.expectRevert();
        strategy.execute{value: 0.01 ether}(EXECUTOR, abi.encode(uint256(0)));
    }

    function test_execute_alwaysReverts_largeAmount() public {
        vm.deal(EXECUTOR, 1000 ether);
        vm.prank(EXECUTOR);
        vm.expectRevert();
        strategy.execute{value: 500 ether}(EXECUTOR, abi.encode(uint256(0)));
    }

    function test_execute_reverts_withZeroEth() public {
        vm.prank(EXECUTOR);
        vm.expectRevert("FailingSlippage: no ETH sent");
        strategy.execute{value: 0}(EXECUTOR, abi.encode(uint256(0)));
    }

    // ──────────────────────────────────────────────────────────────────────
    // State cleanliness after revert
    // ──────────────────────────────────────────────────────────────────────

    function test_execute_revert_leavesNoUsdcInStrategy() public {
        uint256 stratUsdcBefore = IERC20(USDC).balanceOf(address(strategy));

        vm.prank(EXECUTOR);
        try strategy.execute{value: 1 ether}(EXECUTOR, abi.encode(uint256(0))) {} catch {}

        assertEq(
            IERC20(USDC).balanceOf(address(strategy)), stratUsdcBefore, "USDC accumulated in strategy after revert"
        );
    }

    function test_execute_revert_leavesNoEthInStrategy() public {
        uint256 stratEthBefore = address(strategy).balance;

        vm.prank(EXECUTOR);
        try strategy.execute{value: 1 ether}(EXECUTOR, abi.encode(uint256(0))) {} catch {}

        assertEq(address(strategy).balance, stratEthBefore, "ETH accumulated in strategy after revert");
    }

    function test_execute_revert_executorBalanceUnchanged() public {
        uint256 ethBefore = EXECUTOR.balance;
        uint256 usdcBefore = IERC20(USDC).balanceOf(EXECUTOR);

        vm.prank(EXECUTOR);
        try strategy.execute{value: 1 ether}(EXECUTOR, abi.encode(uint256(0))) {} catch {}

        // ETH and USDC balances of executor should be exactly as before
        assertEq(EXECUTOR.balance, ethBefore);
        assertEq(IERC20(USDC).balanceOf(EXECUTOR), usdcBefore);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Fuzz — must ALWAYS revert regardless of input
    // ──────────────────────────────────────────────────────────────────────

    function testFuzz_execute_alwaysRevertsForAnyAmount(uint96 ethAmount) public {
        vm.assume(ethAmount > 0.001 ether);
        vm.assume(ethAmount < 100 ether);

        vm.deal(EXECUTOR, ethAmount);

        vm.prank(EXECUTOR);
        vm.expectRevert();
        strategy.execute{value: ethAmount}(EXECUTOR, abi.encode(uint256(0)));
    }

    function testFuzz_execute_alwaysRevertsForAnyReceiver(address receiver) public {
        vm.assume(receiver != address(0));

        vm.prank(EXECUTOR);
        vm.expectRevert();
        strategy.execute{value: 1 ether}(receiver, abi.encode(uint256(0)));
    }
}
