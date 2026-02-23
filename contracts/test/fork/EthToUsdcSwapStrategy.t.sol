// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {EthToUsdcSwapStrategy} from "../../src/strategies/EthToUsdcSwapStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Fork tests for EthToUsdcSwapStrategy.
///         Tests run against real Uniswap v3 mainnet liquidity.
///
/// @dev    forge test --match-path test/fork/EthToUsdcSwapStrategy.t.sol \
///                    --fork-url $MAINNET_RPC_URL -vvvv
contract EthToUsdcSwapStrategyTest is Test {
    // ── Contracts ──────────────────────────────────────────────────────────
    EthToUsdcSwapStrategy strategy;

    // ── Constants ─────────────────────────────────────────────────────────
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant EXECUTOR = address(0xE1);

    // ── Setup ─────────────────────────────────────────────────────────────
    function setUp() public {
        strategy = new EthToUsdcSwapStrategy();
        vm.deal(EXECUTOR, 100 ether);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Interface compliance
    // ──────────────────────────────────────────────────────────────────────

    function test_interface_nameIsSet() public view {
        string memory name = strategy.NAME();
        assertGt(bytes(name).length, 0, "NAME() should not be empty");
        console.log("Strategy name:", name);
    }

    function test_interface_tokenOutIsUSDC() public view {
        assertEq(strategy.TOKEN_OUT(), USDC);
    }

    // ──────────────────────────────────────────────────────────────────────
    // execute — success path
    // ──────────────────────────────────────────────────────────────────────

    function test_execute_swapsEthForUsdc() public {
        uint256 amountIn = 1 ether;
        uint256 balanceBefore = IERC20(USDC).balanceOf(EXECUTOR);

        vm.prank(EXECUTOR);
        uint256 amountOut = strategy.execute{value: amountIn}(
            EXECUTOR,
            abi.encode(uint256(1)) // minAmountOut = 1 (no real slippage guard, for test)
        );

        uint256 balanceAfter = IERC20(USDC).balanceOf(EXECUTOR);

        console.log("ETH in       :", amountIn);
        console.log("USDC out     :", amountOut);
        console.log("Balance delta:", balanceAfter - balanceBefore);

        assertGt(amountOut, 0, "amountOut must be positive");
        assertGt(amountOut, 100e6, "expect >100 USDC for 1 ETH at any mainnet price");
        assertEq(balanceAfter - balanceBefore, amountOut, "balance delta must match return value");
    }

    function test_execute_receiverGetsUsdc() public {
        address receiver = address(0xBEEF);

        vm.prank(EXECUTOR);
        uint256 amountOut = strategy.execute{value: 1 ether}(receiver, abi.encode(uint256(1)));

        // Receiver should hold the USDC, not executor or strategy
        assertEq(IERC20(USDC).balanceOf(receiver), amountOut);
        assertEq(IERC20(USDC).balanceOf(EXECUTOR), 0);
        assertEq(IERC20(USDC).balanceOf(address(strategy)), 0);
    }

    function test_execute_strategyHoldsNoLeftovers() public {
        // Snapshot strategy balances BEFORE execution.
        // On a mainnet fork the deployed address may already hold dust ETH/tokens
        // from mainnet state — we test deltas, not absolute zero.
        uint256 stratEthBefore = address(strategy).balance;
        uint256 stratUsdcBefore = IERC20(USDC).balanceOf(address(strategy));

        vm.prank(EXECUTOR);
        strategy.execute{value: 1 ether}(EXECUTOR, abi.encode(uint256(1)));

        // Strategy must not ACCUMULATE anything from execution
        assertEq(address(strategy).balance, stratEthBefore, "ETH stuck in strategy after execution");
        assertEq(IERC20(USDC).balanceOf(address(strategy)), stratUsdcBefore, "USDC stuck in strategy after execution");
    }

    function test_execute_gasIsReasonable() public {
        vm.prank(EXECUTOR);
        uint256 gasBefore = gasleft();
        strategy.execute{value: 1 ether}(EXECUTOR, abi.encode(uint256(1)));
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used:", gasUsed);

        // Uniswap v3 single hop should be well under 200k gas
        assertLt(gasUsed, 200_000, "single hop should use < 200k gas");
    }

    // ──────────────────────────────────────────────────────────────────────
    // execute — revert path
    // ──────────────────────────────────────────────────────────────────────

    function test_execute_reverts_withZeroEth() public {
        vm.prank(EXECUTOR);
        vm.expectRevert("EthToUsdcSwap: no ETH sent");
        strategy.execute{value: 0}(EXECUTOR, abi.encode(uint256(1)));
    }

    function test_execute_reverts_withImpossibleMinAmountOut() public {
        vm.prank(EXECUTOR);
        vm.expectRevert(); // Uniswap: "Too little received"
        strategy.execute{value: 1 ether}(
            EXECUTOR,
            abi.encode(type(uint256).max) // impossible minAmountOut
        );
    }

    // ──────────────────────────────────────────────────────────────────────
    // Fuzz
    // ──────────────────────────────────────────────────────────────────────

    function testFuzz_execute_variousEthAmounts(uint96 ethAmount) public {
        vm.assume(ethAmount > 0.01 ether);
        vm.assume(ethAmount < 50 ether);

        vm.deal(EXECUTOR, ethAmount);

        uint256 balanceBefore = IERC20(USDC).balanceOf(EXECUTOR);

        vm.prank(EXECUTOR);
        uint256 amountOut = strategy.execute{value: ethAmount}(EXECUTOR, abi.encode(uint256(1)));

        uint256 balanceAfter = IERC20(USDC).balanceOf(EXECUTOR);

        assertGt(amountOut, 0);
        assertEq(balanceAfter - balanceBefore, amountOut);
    }
}
