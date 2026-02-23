// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IWETH} from "../interfaces/IWETH.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IDeFiStrategy} from "../interfaces/IDeFiStrategy.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata) external returns (uint256 amountOut);
}

/// @notice Strategy 3 — Intentionally fails with impossible slippage.
/// @dev    Identical to Strategy 1 but forces amountOutMinimum = type(uint256).max.
///         Uniswap reverts with "Too little received".
///         PURPOSE: showcases the failure path in SimulationRegistry:
///           - status = FAILED
///           - amountOut = 0
///           - revertReasonHash set
///           - explorerUrl → Tenderly shows full revert stack trace
///         Judges can see exactly WHERE the revert happens and WHY.
contract FailingSlippageStrategy is IDeFiStrategy {
    using SafeERC20 for IERC20;

    string public constant override NAME = "DEMO: Impossible Slippage (Always Fails)";
    address public constant override TOKEN_OUT = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // USDC

    IWETH public constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    ISwapRouter public constant ROUTER = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    uint24 public constant FEE = 500;

    /// @dev params is intentionally ignored.
    ///      amountOutMinimum is hardcoded to type(uint256).max — market can never satisfy this.
    function execute(
        address receiver,
        bytes calldata /* params */
    )
        external
        payable
        override
        returns (uint256 amountOut)
    {
        require(msg.value > 0, "FailingSlippage: no ETH sent");

        // Step 1: Wrap ETH → WETH
        WETH.deposit{value: msg.value}();
        IERC20(address(WETH)).safeIncreaseAllowance(address(ROUTER), msg.value);

        // Step 2: Attempt swap with impossible minimum → ALWAYS REVERTS
        // Uniswap error: "Too little received" (STF in v3 source)
        amountOut = ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(WETH),
                tokenOut: TOKEN_OUT,
                fee: FEE,
                recipient: receiver,
                deadline: block.timestamp,
                amountIn: msg.value,
                amountOutMinimum: type(uint256).max, // ← impossible, guarantees revert
                sqrtPriceLimitX96: 0
            })
        );
    }
}
