// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {SimulationJobQueue} from "../../src/SimulationJobQueue.sol";

contract SimulationJobQueueTest is Test {
    // ── Contracts ──────────────────────────────────────────────────────────
    SimulationJobQueue queue;

    // ── Actors ────────────────────────────────────────────────────────────
    address constant FORWARDER = 0x15fC6ae953E024d975e77382eEeC56A9101f9F88;
    address constant STRATEGY = address(0xA01);
    address constant CALLER = address(0xB02);

    // ── Setup ─────────────────────────────────────────────────────────────
    function setUp() public {
        queue = new SimulationJobQueue(FORWARDER);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────

    /// @dev Flat abi.encode — matches abi.decode(report, (uint256, address, address, string))
    ///      in SimulationJobQueue._processReport. Do NOT wrap in a JobReport struct:
    ///      abi.encode(Struct{...}) adds a 32-byte dynamic-tuple offset prefix that
    ///      shifts every field by one slot, causing silent misreads on the decode side.
    function _encodeJobReport(uint256 runId, address strategy, address caller, string memory explorerUrl)
        internal
        pure
        returns (bytes memory)
    {
        // ✅ flat encode — byte-for-byte identical to encodeAbiParameters in wf-listener/main.ts
        return abi.encode(runId, strategy, caller, explorerUrl);
    }

    /// @dev Convenience: prank as forwarder and submit a job report.
    function _submitJob(uint256 runId, address strategy, address caller, string memory explorerUrl) internal {
        vm.prank(FORWARDER);
        queue.onReport(
            bytes(""), // metadata — ignored by ReceiverTemplate
            _encodeJobReport(runId, strategy, caller, explorerUrl)
        );
    }

    /// @dev Convenience: submit a standard job with default values.
    function _submitDefaultJob(uint256 runId) internal {
        _submitJob(runId, STRATEGY, CALLER, "https://dashboard.tenderly.co/public/vnet/abc123");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────────────────────────────

    function test_constructor_reverts_onZeroForwarder() public {
        vm.expectRevert();
        new SimulationJobQueue(address(0));
    }

    // ──────────────────────────────────────────────────────────────────────
    // onReport → _processReport → _enqueueJob (happy path)
    // ──────────────────────────────────────────────────────────────────────

    function test_onReport_storesJobCorrectly() public {
        _submitDefaultJob(1);

        SimulationJobQueue.Job memory job = queue.getJob(1);

        assertEq(job.runId, 1);
        assertEq(job.strategy, STRATEGY);
        assertEq(job.caller, CALLER);
        assertEq(job.explorerUrl, "https://dashboard.tenderly.co/public/vnet/abc123");
        assertEq(uint8(job.status), uint8(SimulationJobQueue.JobStatus.Queued));
        assertGt(job.enqueuedAt, 0);
    }

    function test_onReport_setsJobExistsTrue() public {
        _submitDefaultJob(1);
        assertTrue(queue.s_jobExists(1));
    }

    function test_onReport_emitsJobEnqueued() public {
        vm.expectEmit(true, true, true, false);
        emit SimulationJobQueue.JobEnqueued(1, STRATEGY, CALLER, "https://dashboard.tenderly.co/public/vnet/abc123");

        _submitDefaultJob(1);
    }

    function test_onReport_multipleJobs_eachStoredIndependently() public {
        address strategyB = address(0xC03);
        address callerB = address(0xD04);

        _submitDefaultJob(1);
        _submitJob(2, strategyB, callerB, "https://dashboard.tenderly.co/public/vnet/xyz789");

        SimulationJobQueue.Job memory job1 = queue.getJob(1);
        SimulationJobQueue.Job memory job2 = queue.getJob(2);

        assertEq(job1.strategy, STRATEGY);
        assertEq(job1.caller, CALLER);
        assertEq(job1.runId, 1);

        assertEq(job2.strategy, strategyB);
        assertEq(job2.caller, callerB);
        assertEq(job2.runId, 2);
    }

    function test_onReport_enqueuedAt_isCurrentTimestamp() public {
        uint256 expectedTs = 1_700_000_000;
        vm.warp(expectedTs);

        _submitDefaultJob(1);

        SimulationJobQueue.Job memory job = queue.getJob(1);
        assertEq(job.enqueuedAt, expectedTs);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Guards / reverts
    // ──────────────────────────────────────────────────────────────────────

    function test_onReport_reverts_onDuplicateRunId() public {
        _submitDefaultJob(1);

        vm.prank(FORWARDER);
        vm.expectRevert(SimulationJobQueue.SimulationJobQueue__JobAlreadyEnqueued.selector);
        queue.onReport(bytes(""), _encodeJobReport(1, STRATEGY, CALLER, "https://x"));
    }

    function test_onReport_reverts_onZeroRunId() public {
        vm.prank(FORWARDER);
        vm.expectRevert("SimulationJobQueue: invalid runId");
        queue.onReport(bytes(""), _encodeJobReport(0, STRATEGY, CALLER, "https://x"));
    }

    function test_onReport_reverts_ifNotForwarder() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        queue.onReport(bytes(""), _encodeJobReport(1, STRATEGY, CALLER, "https://x"));
    }

    // ──────────────────────────────────────────────────────────────────────
    // View helpers
    // ──────────────────────────────────────────────────────────────────────

    function test_getJob_returnsEmptyForUnknownRunId() public view {
        SimulationJobQueue.Job memory job = queue.getJob(999);

        assertEq(job.runId, 0);
        assertEq(job.strategy, address(0));
        assertEq(job.caller, address(0));
        assertEq(job.enqueuedAt, 0);
    }

    function test_jobExists_falseBeforeEnqueue() public view {
        assertFalse(queue.s_jobExists(1));
    }

    function test_jobExists_trueAfterEnqueue() public {
        _submitDefaultJob(1);
        assertTrue(queue.s_jobExists(1));
    }

    // ──────────────────────────────────────────────────────────────────────
    // Fuzz
    // ──────────────────────────────────────────────────────────────────────

    function testFuzz_onReport_anyValidRunId(uint256 runId, address strategy, address caller) public {
        vm.assume(runId != 0);
        vm.assume(strategy != address(0));
        vm.assume(caller != address(0));

        _submitJob(runId, strategy, caller, "https://x");

        SimulationJobQueue.Job memory job = queue.getJob(runId);
        assertEq(job.runId, runId);
        assertEq(job.strategy, strategy);
        assertEq(job.caller, caller);
        assertTrue(queue.s_jobExists(runId));
    }

    function testFuzz_onReport_noDuplicatesAllowed(uint256 runId) public {
        vm.assume(runId != 0);

        _submitJob(runId, STRATEGY, CALLER, "https://x");

        vm.prank(FORWARDER);
        vm.expectRevert(SimulationJobQueue.SimulationJobQueue__JobAlreadyEnqueued.selector);
        queue.onReport(bytes(""), _encodeJobReport(runId, STRATEGY, CALLER, "https://x"));
    }

    function testFuzz_multipleJobs_neverOverlap(uint8 count) public {
        vm.assume(count > 1 && count < 20);

        for (uint256 i = 1; i <= count; i++) {
            _submitJob(i, STRATEGY, CALLER, "https://x");
        }

        for (uint256 i = 1; i <= count; i++) {
            SimulationJobQueue.Job memory job = queue.getJob(i);
            assertEq(job.runId, i);
            assertTrue(queue.s_jobExists(i));
        }
    }
}
