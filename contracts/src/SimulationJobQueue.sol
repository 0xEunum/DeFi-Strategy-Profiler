// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReceiverTemplate} from "./interfaces/ReceiverTemplate.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title  SimulationJobQueue
/// @author DeFi Strategy Profiler
/// @notice CRE-verified handoff point between wf-listener and wf-executor.
///
/// @dev    WHY THIS CONTRACT EXISTS:
///         SimulationRegistry.SimulationQueued is emitted by any user call.
///         We cannot trust it directly for execution — the strategy address,
///         explorerUrl format, and job payload are user-supplied and unverified.
///
///         This contract is a ReceiverTemplate consumer. Only the CRE forwarder
///         can write to it (via wf-listener's writeReport call). By the time
///         JobEnqueued fires, wf-listener has already:
///           1. Validated the job payload from SimulationQueued
///           2. Enriched it with any needed context
///           3. Produced a CRE-signed report
///
///         wf-executor listens to JobEnqueued here — it can trust this event
///         because it is CRE-attested, not raw user input.
///
///         TWO-WORKFLOW SEPARATION:
///           SimulationRegistry.SimulationQueued  →  triggers wf-listener only
///           SimulationJobQueue.JobEnqueued        →  triggers wf-executor only
///
///         This prevents race conditions and gives each workflow a clean,
///         dedicated trigger with no shared event ambiguity.
contract SimulationJobQueue is ReceiverTemplate, ERC20 {
    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when a zero address is passed to the constructor.
    error SimulationJobQueue__InvalidAddress();

    /// @notice Thrown when a runId that has already been enqueued is submitted again.
    ///         Prevents wf-listener from double-enqueuing on a retry.
    error SimulationJobQueue__JobAlreadyEnqueued();

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Lifecycle state of a queued job.
    /// @dev    Queued   → wf-listener wrote the job; wf-executor has not picked it up yet.
    ///         Taken    → wf-executor has started processing this job.
    ///                    (optional: set this in a separate CRE step if you want tracking)
    enum JobStatus {
        Queued,
        Taken
    }

    /// @notice A validated, CRE-attested job ready for wf-executor to consume.
    ///         All fields are written atomically by wf-listener in one report.
    struct Job {
        uint256 runId; // matches a runId in SimulationRegistry
        address strategy; // IDeFiStrategy contract address on the vNet
        address caller; // original EOA from SimulationRegistry.requestSimulation
        string explorerUrl; // public Tenderly VNet explorer URL
        uint64 enqueuedAt; // block.timestamp when wf-listener submitted this job
        JobStatus status; // Queued → Taken (optional tracking)
    }

    /// @notice The exact struct wf-listener ABI-encodes and sends as report bytes.
    /// @dev    Field order and types MUST match encodeAbiParameters() in wf-listener/main.ts.
    struct JobReport {
        uint256 runId;
        address strategy;
        address caller;
        string explorerUrl;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice runId → Job data.
    ///         Written once by wf-listener; never overwritten.
    mapping(uint256 => Job) public s_jobs;

    /// @notice runId → whether a job has been enqueued.
    ///         Separate from s_jobs to make the existence check gas-cheap.
    mapping(uint256 => bool) public s_jobExists;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when wf-listener successfully enqueues a validated job.
    ///         wf-executor is subscribed to this event via CRE Log Trigger.
    ///
    /// @dev    All fields are indexed or included so wf-executor can decode
    ///         the full job context from the event alone, without an extra read.
    ///
    /// @param runId        Matching runId from SimulationRegistry.
    /// @param strategy     IDeFiStrategy contract address on the vNet.
    /// @param caller       Original EOA who requested the simulation.
    /// @param explorerUrl  Tenderly VNet explorer URL for this run.
    event JobEnqueued(uint256 indexed runId, address indexed strategy, address indexed caller, string explorerUrl);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /// @param _forwarderAddress CRE forwarder on this chain (Sepolia).
    ///        Inherited from ReceiverTemplate — only this address can call onReport().
    constructor(address _forwarderAddress) ReceiverTemplate(_forwarderAddress) ERC20("MyToken", "MT") {
        if (_forwarderAddress == address(0)) revert SimulationJobQueue__InvalidAddress();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the full Job struct for a given runId.
    /// @dev    Explicit getter needed because auto-generated mapping getters
    ///         do not return structs containing strings.
    function getJob(uint256 runId) external view returns (Job memory) {
        return s_jobs[runId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRE forwarder hook (ReceiverTemplate override)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Called by the CRE forwarder after verifying wf-listener's signature.
    ///         Decodes a JobReport and stores + emits the validated job.
    /// @dev    Keep minimal: decode → validate → store → emit.
    function _processReport(bytes calldata report) internal override {
        JobReport memory rep = abi.decode(report, (JobReport));
        _enqueueJob(rep);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal logic
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Validates and stores the incoming job, then emits JobEnqueued.
    /// @dev    s_jobExists check prevents wf-listener retries from double-enqueuing.
    ///         runId 0 is treated as invalid (SimulationRegistry starts at 1).
    function _enqueueJob(JobReport memory rep) private {
        // runId 0 is reserved as null in SimulationRegistry
        require(rep.runId != 0, "SimulationJobQueue: invalid runId");

        // Idempotency: reject duplicate enqueue (e.g., wf-listener retry)
        if (s_jobExists[rep.runId]) revert SimulationJobQueue__JobAlreadyEnqueued();

        // Mark as enqueued before writing storage (checks-effects-interactions)
        s_jobExists[rep.runId] = true;

        // Store the full validated job
        s_jobs[rep.runId] = Job({
            runId: rep.runId,
            strategy: rep.strategy,
            caller: rep.caller,
            explorerUrl: rep.explorerUrl,
            enqueuedAt: uint64(block.timestamp),
            status: JobStatus.Queued
        });

        emit JobEnqueued(rep.runId, rep.strategy, rep.caller, rep.explorerUrl);
    }
}
