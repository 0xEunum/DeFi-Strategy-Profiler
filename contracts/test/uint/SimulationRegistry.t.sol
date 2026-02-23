// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {SimulationRegistry} from "../../src/SimulationRegistry.sol";

/// @notice Unit tests for SimulationRegistry.
///         No fork needed — forwarder is pranked directly.
///
/// @dev    How CRE forwarder works in tests:
///         The real forwarder calls onReport(bytes metadata, bytes report).
///         ReceiverTemplate validates msg.sender == forwarder, then calls
///         _processReport(report) internally. So we prank as FORWARDER and
///         call onReport with empty metadata + our encoded report bytes.
contract SimulationRegistryTest is Test {
    // ── Contracts ──────────────────────────────────────────────────────────
    SimulationRegistry registry;

    // ── Actors ────────────────────────────────────────────────────────────
    address constant FORWARDER = address(0xF04);
    address constant STRATEGY = address(0xA01);
    address constant CALLER = address(0xB02);

    // ── Token addresses (only for report data realism) ────────────────────
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // ── Setup ─────────────────────────────────────────────────────────────
    function setUp() public {
        registry = new SimulationRegistry(FORWARDER);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────

    /// @dev Builds an ABI-encoded SimulationReport for a given runId and outcome.
    ///      Matches the exact struct layout in SimulationRegistry.SimulationReport.
    function _encodeReport(uint256 runId, bool success) internal pure returns (bytes memory) {
        return abi.encode(
            SimulationRegistry.SimulationReport({
                runId: runId,
                chainId: 1,
                forkBlock: 21_000_000,
                tenderlyRunId: keccak256("mock-tenderly-run"),
                commitHash: bytes32(0),
                tokenIn: WETH,
                tokenOut: USDC,
                amountIn: 1 ether,
                amountOut: success ? 3_500e6 : 0,
                gasUsed: 150_000,
                effectiveGasPrice: 20 gwei,
                totalCostInTokenIn: 150_000 * 20 gwei,
                paramsHash: bytes32(0),
                success: success,
                revertReasonHash: success ? bytes32(0) : keccak256("Too little received")
            })
        );
    }

    /// @dev Convenience: queue a sim as CALLER, return runId.
    function _queueRun() internal returns (uint256 runId) {
        vm.prank(CALLER);
        runId = registry.requestSimulation(STRATEGY, "https://dashboard.tenderly.co/public/vnet/abc123");
    }

    /// @dev Convenience: prank as forwarder and submit a report.
    ///      metadata is empty — forwarder passes it but ReceiverTemplate ignores it.
    function _submitReport(uint256 runId, bool success) internal {
        vm.prank(FORWARDER);
        registry.onReport(
            bytes(""), // metadata — ignored by ReceiverTemplate
            _encodeReport(runId, success)
        );
    }

    // ──────────────────────────────────────────────────────────────────────
    // requestSimulation
    // ──────────────────────────────────────────────────────────────────────

    function test_requestSimulation_firstRunIdIsOne() public {
        uint256 runId = _queueRun();
        assertEq(runId, 1);
    }

    function test_requestSimulation_incrementsMonotonically() public {
        uint256 id1 = _queueRun();
        uint256 id2 = _queueRun();
        uint256 id3 = _queueRun();
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    function test_requestSimulation_storesIdentityCorrectly() public {
        uint256 runId = _queueRun();

        SimulationRegistry.RunIdentity memory id = registry.getRunIdentity(runId);

        assertEq(id.strategy, STRATEGY);
        assertEq(id.caller, CALLER);
        assertEq(uint8(id.status), uint8(SimulationRegistry.Status.Pending));
        assertEq(id.explorerUrl, "https://dashboard.tenderly.co/public/vnet/abc123");
        assertGt(id.timestamp, 0);
    }

    function test_requestSimulation_outcomeStartsEmpty() public {
        uint256 runId = _queueRun();

        SimulationRegistry.RunOutcome memory out = registry.getRunOutcome(runId);

        assertEq(out.amountIn, 0);
        assertEq(out.amountOut, 0);
        assertEq(out.gasUsed, 0);
        assertEq(out.effectiveGasPrice, 0);
        assertEq(out.totalCostInTokenIn, 0);
        assertEq(out.revertReasonHash, bytes32(0));
    }

    function test_requestSimulation_appendsToRunsByStrategy() public {
        _queueRun();
        _queueRun();

        uint256[] memory ids = registry.getRunsByStrategy(STRATEGY);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_requestSimulation_emitsSimulationQueued() public {
        vm.expectEmit(true, true, true, false);
        emit SimulationRegistry.SimulationQueued(
            1, STRATEGY, CALLER, "https://dashboard.tenderly.co/public/vnet/abc123"
        );

        vm.prank(CALLER);
        registry.requestSimulation(STRATEGY, "https://dashboard.tenderly.co/public/vnet/abc123");
    }

    // ──────────────────────────────────────────────────────────────────────
    // onReport → _processReport → _recordResult (success path)
    // ──────────────────────────────────────────────────────────────────────

    function test_onReport_success_setsStatusToSuccess() public {
        uint256 runId = _queueRun();
        _submitReport(runId, true);

        SimulationRegistry.RunIdentity memory id = registry.getRunIdentity(runId);
        assertEq(uint8(id.status), uint8(SimulationRegistry.Status.Success));
    }

    function test_onReport_success_fillsIdentityFields() public {
        uint256 runId = _queueRun();
        _submitReport(runId, true);

        SimulationRegistry.RunIdentity memory id = registry.getRunIdentity(runId);
        assertEq(id.chainId, 1);
        assertEq(id.forkBlock, 21_000_000);
        assertEq(id.tokenIn, WETH);
        assertEq(id.tokenOut, USDC);
        assertEq(id.tenderlyRunId, keccak256("mock-tenderly-run"));
        assertGt(id.timestamp, 0);
    }

    function test_onReport_success_fillsOutcomeFields() public {
        uint256 runId = _queueRun();
        _submitReport(runId, true);

        SimulationRegistry.RunOutcome memory out = registry.getRunOutcome(runId);
        assertEq(out.amountIn, 1 ether);
        assertEq(out.amountOut, 3_500e6);
        assertEq(out.gasUsed, 150_000);
        assertEq(out.effectiveGasPrice, 20 gwei);
        assertEq(out.totalCostInTokenIn, 150_000 * 20 gwei);
        assertEq(out.revertReasonHash, bytes32(0));
    }

    function test_onReport_success_emitsSimulationCompleted() public {
        uint256 runId = _queueRun();

        vm.expectEmit(true, true, false, true);
        emit SimulationRegistry.SimulationCompleted(runId, STRATEGY, true, 150_000);

        _submitReport(runId, true);
    }

    // ──────────────────────────────────────────────────────────────────────
    // onReport → failure path
    // ──────────────────────────────────────────────────────────────────────

    function test_onReport_failure_setsStatusToFailed() public {
        uint256 runId = _queueRun();
        _submitReport(runId, false);

        SimulationRegistry.RunIdentity memory id = registry.getRunIdentity(runId);
        assertEq(uint8(id.status), uint8(SimulationRegistry.Status.Failed));
    }

    function test_onReport_failure_amountOutIsZero() public {
        uint256 runId = _queueRun();
        _submitReport(runId, false);

        SimulationRegistry.RunOutcome memory out = registry.getRunOutcome(runId);
        assertEq(out.amountOut, 0);
    }

    function test_onReport_failure_setsRevertReasonHash() public {
        uint256 runId = _queueRun();
        _submitReport(runId, false);

        SimulationRegistry.RunOutcome memory out = registry.getRunOutcome(runId);
        assertEq(out.revertReasonHash, keccak256("Too little received"));
    }

    function test_onReport_failure_emitsSimulationCompleted() public {
        uint256 runId = _queueRun();

        vm.expectEmit(true, true, false, true);
        emit SimulationRegistry.SimulationCompleted(runId, STRATEGY, false, 150_000);

        _submitReport(runId, false);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Guards / reverts
    // ──────────────────────────────────────────────────────────────────────

    function test_onReport_reverts_onDuplicateReport() public {
        uint256 runId = _queueRun();
        _submitReport(runId, true);

        // Second report for same runId must revert
        vm.prank(FORWARDER);
        vm.expectRevert(SimulationRegistry.SimulationRegistry__SimulationAlreadyCompleted.selector);
        registry.onReport(bytes(""), _encodeReport(runId, true));
    }

    function test_onReport_reverts_onUnknownRunId() public {
        vm.prank(FORWARDER);
        vm.expectRevert(SimulationRegistry.SimulationRegistry__UnknownRun.selector);
        registry.onReport(bytes(""), _encodeReport(999, true));
    }

    function test_onReport_reverts_ifNotForwarder() public {
        uint256 runId = _queueRun();

        // Random address (not the forwarder) should be rejected by ReceiverTemplate
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        registry.onReport(bytes(""), _encodeReport(runId, true));
    }

    // ──────────────────────────────────────────────────────────────────────
    // View helpers
    // ──────────────────────────────────────────────────────────────────────

    function test_latestRunId_returnsLastRun() public {
        _queueRun();
        _queueRun();
        _queueRun();

        assertEq(registry.latestRunId(STRATEGY), 3);
    }

    function test_latestRunId_reverts_whenNoRuns() public {
        vm.expectRevert(SimulationRegistry.SimulationRegistry__NoRunsFound.selector);
        registry.latestRunId(STRATEGY);
    }

    function test_getRunsByStrategy_returnsAllIds() public {
        _queueRun();
        _queueRun();

        uint256[] memory ids = registry.getRunsByStrategy(STRATEGY);
        assertEq(ids.length, 2);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Fuzz
    // ──────────────────────────────────────────────────────────────────────

    function testFuzz_requestSimulation_anyCallerAndStrategy(address stratAddr, address callerAddr) public {
        vm.assume(stratAddr != address(0));
        vm.assume(callerAddr != address(0));

        vm.prank(callerAddr);
        uint256 runId = registry.requestSimulation(stratAddr, "https://x");

        SimulationRegistry.RunIdentity memory id = registry.getRunIdentity(runId);
        assertEq(id.strategy, stratAddr);
        assertEq(id.caller, callerAddr);
        assertEq(uint8(id.status), uint8(SimulationRegistry.Status.Pending));
    }

    function testFuzz_multipleRuns_neverOverwriteEachOther(uint8 count) public {
        vm.assume(count > 1 && count < 20);

        for (uint8 i = 0; i < count; i++) {
            vm.prank(CALLER);
            registry.requestSimulation(STRATEGY, "https://x");
        }

        uint256[] memory ids = registry.getRunsByStrategy(STRATEGY);
        assertEq(ids.length, count);

        // Verify each run is individually Pending and independent
        for (uint256 i = 0; i < count; i++) {
            SimulationRegistry.RunIdentity memory id = registry.getRunIdentity(ids[i]);
            assertEq(uint8(id.status), uint8(SimulationRegistry.Status.Pending));
            assertEq(id.strategy, STRATEGY);
        }
    }
}
