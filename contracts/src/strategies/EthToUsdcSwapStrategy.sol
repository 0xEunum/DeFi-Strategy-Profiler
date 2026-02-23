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

/// @notice Strategy 1 — ETH → WETH → USDC via Uniswap v3 (single hop).
/// @dev    Wraps ETH first, then swaps WETH → USDC on the 0.05% pool.
///         Demonstrates a clean success path: realistic gas + USDC output profiled.
contract EthToUsdcSwapStrategy is IDeFiStrategy {
    using SafeERC20 for IERC20;

    string public constant override NAME = "ETH -> USDC Single Hop (Uniswap v3)";
    address public constant override TOKEN_OUT = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // USDC

    IWETH public constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    ISwapRouter public constant ROUTER = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    uint24 public constant FEE = 500; // 0.05% WETH/USDC pool

    /// @param receiver  Address to receive USDC.
    /// @param params    ABI-encoded uint256 minAmountOut (USDC, 6 decimals).
    function execute(address receiver, bytes calldata params) external payable override returns (uint256 amountOut) {
        require(msg.value > 0, "EthToUsdcSwap: no ETH sent");

        uint256 minAmountOut = abi.decode(params, (uint256));

        // Step 1: Wrap ETH → WETH
        WETH.deposit{value: msg.value}();

        // Step 2: Approve router
        IERC20(address(WETH)).safeIncreaseAllowance(address(ROUTER), msg.value);

        // Step 3: Swap WETH → USDC
        amountOut = ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(WETH),
                tokenOut: TOKEN_OUT,
                fee: FEE,
                recipient: receiver,
                deadline: block.timestamp,
                amountIn: msg.value,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );
    }
}
