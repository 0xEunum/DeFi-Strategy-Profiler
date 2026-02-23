// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice All strategies start from native ETH.
///         The executor sends ETH with the execute() call.
///         Wrapping ETH → WETH happens inside the strategy.
interface IDeFiStrategy {
    /// @notice Human-readable name for this strategy (for Registry labeling).
    function NAME() external view returns (string memory);

    /// @notice Final output token of this strategy.
    ///         TOKEN_IN is always native ETH → WETH, so only TOKEN_OUT varies.
    function TOKEN_OUT() external view returns (address);

    /// @notice Execute the strategy with msg.value as ETH input.
    /// @param receiver  Address that receives TOKEN_OUT at the end.
    /// @param params    ABI-encoded extra params (minAmountOut, path flags, etc.)
    /// @return amountOut Actual TOKEN_OUT received.
    function execute(address receiver, bytes calldata params) external payable returns (uint256 amountOut);
}
