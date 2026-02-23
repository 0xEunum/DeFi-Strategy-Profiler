// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IWETH} from "../interfaces/IWETH.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IDeFiStrategy} from "../interfaces/IDeFiStrategy.sol";

interface ISwapRouter {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    function exactInput(ExactInputParams calldata) external returns (uint256 amountOut);
}

/// @notice Strategy 2 — ETH → WETH → USDC → DAI via Uniswap v3 multi-hop.
/// @dev    Hop 1: WETH  -[500]→  USDC  (0.05% pool — deepest WETH/USDC pool)
///         Hop 2: USDC  -[100]→  DAI   (0.01% stable pool — extremely liquid)
///         Both pools have proven deep mainnet liquidity.
///         Demonstrates higher gas than Strategy 1 and compounding slippage
///         across two hops in a single atomic transaction.
contract EthToUsdcDaiMultiHopStrategy is IDeFiStrategy {
    using SafeERC20 for IERC20;

    string public constant override NAME = "ETH->USDC->DAI Multi-Hop (Uniswap v3)";
    address public constant override TOKEN_OUT = 0x6B175474E89094C44Da98b954EedeAC495271d0F; // DAI

    IWETH public constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    ISwapRouter public constant ROUTER = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    /// @dev Path encoding: (tokenIn, fee, hop, fee, tokenOut)
    ///      WETH -[500]→ USDC -[100]→ DAI
    function _buildPath() internal pure returns (bytes memory) {
        return abi.encodePacked(
            address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2), // WETH
            uint24(500), // 0.05%
            address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48), // USDC (intermediate)
            uint24(100), // 0.01%
            address(0x6B175474E89094C44Da98b954EedeAC495271d0F) // DAI
        );
    }

    /// @param receiver  Address to receive DAI.
    /// @param params    ABI-encoded uint256 minAmountOut (DAI, 18 decimals).
    function execute(address receiver, bytes calldata params) external payable override returns (uint256 amountOut) {
        require(msg.value > 0, "EthToUsdcDaiMultiHop: no ETH sent");

        uint256 minAmountOut = abi.decode(params, (uint256));

        // Step 1: Wrap ETH → WETH
        WETH.deposit{value: msg.value}();

        // Step 2: Approve router for full WETH amount
        IERC20(address(WETH)).safeIncreaseAllowance(address(ROUTER), msg.value);

        // Step 3: Multi-hop WETH → USDC → DAI
        amountOut = ROUTER.exactInput(
            ISwapRouter.ExactInputParams({
                path: _buildPath(),
                recipient: receiver,
                deadline: block.timestamp,
                amountIn: msg.value,
                amountOutMinimum: minAmountOut
            })
        );
    }
}
