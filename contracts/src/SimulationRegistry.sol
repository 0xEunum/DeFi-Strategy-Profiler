// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReceiverTemplate} from "./interfaces/ReceiverTemplate.sol";

/// @title  SimulationRegistry
/// @author DeFi Strategy Profiler
/// @notice Append-only on-chain ledger of DeFi strategy simulation runs.
///         Developers submit simulation requests here. Chainlink CRE orchestrates
///         execution on a Tenderly Virtual TestNet fork and writes verifiable
///         results back via the CRE forwarder → ReceiverTemplate → _processReport.
///
/// @dev    Two-workflow architecture:
///           wf-listener  : watches SimulationQueued, validates, enqueues in SimulationJobQueue
///           wf-executor  : picks up JobEnqueued, runs strategy on vNet, writes report here
///
///         Storage is split into two mappings per runId to avoid stack-too-deep errors
///         when assigning large structs:
///           s_runIdentity  → context fields (addresses, status, explorerUrl)
///           s_runOutcome   → numerical results (gas, amounts, revert hash)
contract SimulationRegistry is ReceiverTemplate {
    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when a zero address is passed to the constructor.
    error SimulationRegistry__InvalidAddress();

    /// @notice Thrown when CRE tries to record a result for a run that is
    ///         already in Status.Success or Status.Failed (not Pending).
    ///         Prevents duplicate reports if a CRE workflow retries.
    error SimulationRegistry__SimulationAlreadyCompleted();

    /// @notice Thrown when CRE references a runId that was never queued.
    ///         Guards against phantom writes to non-existent runs.
    error SimulationRegistry__UnknownRun();

    /// @notice Thrown by latestRunId() when a strategy has no runs yet.
    error SimulationRegistry__NoRunsFound();

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Lifecycle state of a simulation run.
    /// @dev    Pending  → run was queued, CRE has not reported back yet.
    ///         Success  → strategy executed without reverting on the vNet fork.
    ///         Failed   → strategy reverted; revertReasonHash is set in RunOutcome.
    enum Status {
        Pending,
        Success,
        Failed
    }

    /// @notice Identity and context fields for a simulation run.
    ///         Fields marked [queue] are filled when requestSimulation() is called.
    ///         Fields marked [CRE] are filled when _processReport() is called.
    struct RunIdentity {
        address strategy; // [queue] DeFiStrategy contract address on the vNet
        address caller; // [queue] EOA that submitted the simulation request
        uint64 chainId; // [CRE]   forked chain id (e.g., 1 = Ethereum mainnet)
        uint64 forkBlock; // [CRE]   block number the vNet was forked from
        bytes32 tenderlyRunId; // [CRE]   links to the Tenderly explorer tx for this run
        bytes32 commitHash; // [CRE]   optional: git commit / IPFS hash of strategy code
        address tokenIn; // [CRE]   token used as input for the strategy
        address tokenOut; // [CRE]   token received as output by the strategy
        uint64 timestamp; // [both]  set at queue time; overwritten by CRE on completion
        Status status; // [both]  Pending → Success/Failed after CRE reports
        string explorerUrl; // [queue] public Tenderly VNet explorer URL for manual inspection
    }

    /// @notice Numerical parameters and results for a simulation run.
    ///         All fields are filled entirely when CRE reports back.
    /// @dev    Kept in a separate struct/mapping from RunIdentity to avoid
    ///         stack-too-deep errors during the large struct assignment in _recordResult.
    struct RunOutcome {
        uint256 amountIn; // amount of tokenIn used in the strategy
        bytes32 paramsHash; // keccak256 of ABI-encoded extra params passed to execute()
        uint256 amountOut; // actual tokenOut received; 0 if strategy failed
        uint256 gasUsed; // gas consumed by the strategy execution on the vNet
        uint256 effectiveGasPrice; // gas price in wei at execution time on the vNet fork
        uint256 totalCostInTokenIn; // simplified total cost (gas * gasPrice); basis for profiling
        bytes32 revertReasonHash; // keccak256(revertData) if strategy reverted; 0x0 on success
        // NOTE: bool success is intentionally omitted here.
        //       Use RunIdentity.status (Success/Failed) as the single source of truth.
    }

    /// @notice The exact struct CRE ABI-encodes in the workflow and sends as report bytes.
    /// @dev    The field order and types here MUST exactly match encodeAbiParameters()
    ///         in wf-executor/main.ts, otherwise abi.decode will silently misread fields.
    struct SimulationReport {
        uint256 runId;
        uint64 chainId;
        uint64 forkBlock;
        bytes32 tenderlyRunId;
        bytes32 commitHash;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 gasUsed;
        uint256 effectiveGasPrice;
        uint256 totalCostInTokenIn;
        bytes32 paramsHash;
        bool success; // used only to set RunIdentity.status; not stored separately
        bytes32 revertReasonHash;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Monotonically incrementing counter. Run IDs start at 1.
    ///         s_nextRunId is pre-incremented in requestSimulation() so runId 0 is
    ///         reserved as "does not exist" — used by the UnknownRun guard.
    uint256 public s_nextRunId;

    /// @notice runId → identity / context fields.
    ///         Partially filled at queue time; completed by CRE on report.
    mapping(uint256 => RunIdentity) public s_runIdentity;

    /// @notice runId → numerical results.
    ///         Entirely empty until CRE reports back.
    mapping(uint256 => RunOutcome) public s_runOutcome;

    /// @notice strategy address → ordered list of runIds.
    ///         Append-only. Used to compare multiple runs of the same strategy.
    mapping(address => uint256[]) public s_runsByStrategy;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a developer queues a new simulation.
    ///         wf-listener is subscribed to this event via CRE Log Trigger.
    /// @param runId        Unique run identifier for this simulation.
    /// @param strategy     DeFiStrategy contract address on the vNet.
    /// @param caller       EOA that submitted the request.
    /// @param explorerUrl  Public Tenderly VNet explorer URL for this run.
    event SimulationQueued(uint256 indexed runId, address indexed strategy, address indexed caller, string explorerUrl);

    /// @notice Emitted when CRE successfully writes results for a run.
    ///         Index on runId and strategy for cheap off-chain filtering.
    ///         Frontends and CLI tools should listen to this to know a run is done.
    /// @param runId    The completed run.
    /// @param strategy The strategy that was profiled.
    /// @param success  Whether the strategy executed without reverting.
    /// @param gasUsed  Actual gas consumed on the vNet fork.
    event SimulationCompleted(uint256 indexed runId, address indexed strategy, bool success, uint256 gasUsed);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /// @param _forwarderAddress CRE forwarder contract on this chain (Sepolia).
    ///        ReceiverTemplate restricts onReport() to only this address,
    ///        ensuring only a verified CRE workflow can write simulation results.
    constructor(address _forwarderAddress) ReceiverTemplate(_forwarderAddress) {
        if (_forwarderAddress == address(0)) revert SimulationRegistry__InvalidAddress();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dev-facing API
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Queue a new simulation run.
    ///         Called by the developer's local CLI/Express script after deploying
    ///         a DeFiStrategy contract to a Tenderly Virtual TestNet.
    ///
    /// @dev    Creates a skeleton RunIdentity with Status.Pending. The RunOutcome
    ///         mapping entry for this runId starts empty and is filled by CRE.
    ///
    /// @param _strategy    Address of the DeFiStrategy contract on the vNet.
    ///                     Must implement IDeFiStrategy (TOKEN_IN, TOKEN_OUT, execute).
    /// @param _explorerUrl Public Tenderly VNet explorer URL. Stored permanently
    ///                     so devs and judges can inspect every tx for this run.
    /// @return runId       Unique ID for this simulation (starts at 1).
    function requestSimulation(address _strategy, string calldata _explorerUrl) external returns (uint256 runId) {
        runId = ++s_nextRunId; // pre-increment: runId 0 is reserved as "null"

        RunIdentity storage id = s_runIdentity[runId];
        id.strategy = _strategy;
        id.caller = msg.sender;
        id.status = Status.Pending;
        id.timestamp = uint64(block.timestamp);
        id.explorerUrl = _explorerUrl;

        s_runsByStrategy[_strategy].push(runId);

        emit SimulationQueued(runId, _strategy, msg.sender, _explorerUrl);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the full identity struct for a run.
    /// @dev    Explicit getter needed because the auto-generated public mapping getter
    ///         does not return structs containing strings.
    function getRunIdentity(uint256 runId) external view returns (RunIdentity memory) {
        return s_runIdentity[runId];
    }

    /// @notice Returns the full outcome struct for a run.
    ///         All fields are zero until Status.Success or Status.Failed.
    function getRunOutcome(uint256 runId) external view returns (RunOutcome memory) {
        return s_runOutcome[runId];
    }

    /// @notice Returns all runIds for a given strategy address in submission order.
    ///         Use this to compare multiple runs (e.g., Strategy v1 vs v2).
    function getRunsByStrategy(address strategy) external view returns (uint256[] memory) {
        return s_runsByStrategy[strategy];
    }

    /// @notice Returns the most recent runId for a strategy.
    ///         Convenience for "what did the last run produce?".
    function latestRunId(address strategy) external view returns (uint256) {
        uint256 len = s_runsByStrategy[strategy].length;
        if (len == 0) revert SimulationRegistry__NoRunsFound();
        return s_runsByStrategy[strategy][len - 1];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRE forwarder hook (ReceiverTemplate override)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Entry point called by the CRE forwarder after signature verification.
    ///         The forwarder calls onReport() on ReceiverTemplate, which calls this.
    ///         report bytes must be ABI-encoded as a SimulationReport tuple —
    ///         the encoding happens in wf-executor via encodeAbiParameters().
    /// @dev    Keep this function minimal: decode and delegate only.
    ///         All state changes happen in private helpers to avoid stack-too-deep.
    function _processReport(bytes calldata report) internal override {
        SimulationReport memory rep = abi.decode(report, (SimulationReport));
        _recordResult(rep);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal logic
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Validates the run exists and is still pending, then delegates
    ///         struct writes to _fillIdentity and _fillOutcome.
    /// @dev    Split into two helpers to keep each function's local variable
    ///         count below the EVM's 16-slot stack limit.
    function _recordResult(SimulationReport memory rep) private {
        RunIdentity storage id = s_runIdentity[rep.runId];

        // runId 0 would always fail here since s_nextRunId starts at 1
        if (id.strategy == address(0)) revert SimulationRegistry__UnknownRun();

        // Idempotency guard: CRE workflows may retry on timeout; reject duplicates
        if (id.status != Status.Pending) revert SimulationRegistry__SimulationAlreadyCompleted();

        _fillIdentity(id, rep);
        _fillOutcome(rep.runId, rep);

        emit SimulationCompleted(rep.runId, id.strategy, rep.success, rep.gasUsed);
    }

    /// @notice Fills context fields into the RunIdentity storage slot.
    /// @dev    Isolated into its own function to reduce stack depth in _recordResult.
    ///         status is derived from rep.success so bool is not stored separately.
    function _fillIdentity(RunIdentity storage id, SimulationReport memory rep) private {
        id.chainId = rep.chainId;
        id.forkBlock = rep.forkBlock;
        id.tenderlyRunId = rep.tenderlyRunId;
        id.commitHash = rep.commitHash;
        id.tokenIn = rep.tokenIn;
        id.tokenOut = rep.tokenOut;
        id.timestamp = uint64(block.timestamp);
        id.status = rep.success ? Status.Success : Status.Failed;
    }

    /// @notice Fills numerical results into the RunOutcome storage slot.
    /// @dev    Isolated into its own function to reduce stack depth in _recordResult.
    ///         bool success is intentionally excluded — use RunIdentity.status instead.
    function _fillOutcome(uint256 runId, SimulationReport memory rep) private {
        RunOutcome storage out = s_runOutcome[runId];
        out.amountIn = rep.amountIn;
        out.paramsHash = rep.paramsHash;
        out.amountOut = rep.amountOut;
        out.gasUsed = rep.gasUsed;
        out.effectiveGasPrice = rep.effectiveGasPrice;
        out.totalCostInTokenIn = rep.totalCostInTokenIn;
        out.revertReasonHash = rep.revertReasonHash;
    }
}
