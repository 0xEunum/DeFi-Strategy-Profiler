export const SIMULATION_REGISTRY_ABI = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_forwarderAddress",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getExpectedAuthor",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getExpectedWorkflowId",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getExpectedWorkflowName",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes10",
        internalType: "bytes10",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getForwarderAddress",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRunIdentity",
    inputs: [
      {
        name: "runId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct SimulationRegistry.RunIdentity",
        components: [
          {
            name: "strategy",
            type: "address",
            internalType: "address",
          },
          {
            name: "caller",
            type: "address",
            internalType: "address",
          },
          {
            name: "chainId",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "forkBlock",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "tenderlyRunId",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "commitHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "tokenIn",
            type: "address",
            internalType: "address",
          },
          {
            name: "tokenOut",
            type: "address",
            internalType: "address",
          },
          {
            name: "timestamp",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "status",
            type: "uint8",
            internalType: "enum SimulationRegistry.Status",
          },
          {
            name: "explorerUrl",
            type: "string",
            internalType: "string",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRunOutcome",
    inputs: [
      {
        name: "runId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct SimulationRegistry.RunOutcome",
        components: [
          {
            name: "amountIn",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "paramsHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "amountOut",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "gasUsed",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "effectiveGasPrice",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "totalCostInTokenIn",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "revertReasonHash",
            type: "bytes32",
            internalType: "bytes32",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRunsByStrategy",
    inputs: [
      {
        name: "strategy",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256[]",
        internalType: "uint256[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "latestRunId",
    inputs: [
      {
        name: "strategy",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "onReport",
    inputs: [
      {
        name: "metadata",
        type: "bytes",
        internalType: "bytes",
      },
      {
        name: "report",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestSimulation",
    inputs: [
      {
        name: "_strategy",
        type: "address",
        internalType: "address",
      },
      {
        name: "_explorerUrl",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "runId",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "s_nextRunId",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "s_runIdentity",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "strategy",
        type: "address",
        internalType: "address",
      },
      {
        name: "caller",
        type: "address",
        internalType: "address",
      },
      {
        name: "chainId",
        type: "uint64",
        internalType: "uint64",
      },
      {
        name: "forkBlock",
        type: "uint64",
        internalType: "uint64",
      },
      {
        name: "tenderlyRunId",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "commitHash",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "tokenIn",
        type: "address",
        internalType: "address",
      },
      {
        name: "tokenOut",
        type: "address",
        internalType: "address",
      },
      {
        name: "timestamp",
        type: "uint64",
        internalType: "uint64",
      },
      {
        name: "status",
        type: "uint8",
        internalType: "enum SimulationRegistry.Status",
      },
      {
        name: "explorerUrl",
        type: "string",
        internalType: "string",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "s_runOutcome",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "amountIn",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "paramsHash",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "amountOut",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "gasUsed",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "effectiveGasPrice",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "totalCostInTokenIn",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "revertReasonHash",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "s_runsByStrategy",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setExpectedAuthor",
    inputs: [
      {
        name: "_author",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setExpectedWorkflowId",
    inputs: [
      {
        name: "_id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setExpectedWorkflowName",
    inputs: [
      {
        name: "_name",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setForwarderAddress",
    inputs: [
      {
        name: "_forwarder",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "supportsInterface",
    inputs: [
      {
        name: "interfaceId",
        type: "bytes4",
        internalType: "bytes4",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [
      {
        name: "newOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "ExpectedAuthorUpdated",
    inputs: [
      {
        name: "previousAuthor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newAuthor",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ExpectedWorkflowIdUpdated",
    inputs: [
      {
        name: "previousId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "newId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ExpectedWorkflowNameUpdated",
    inputs: [
      {
        name: "previousName",
        type: "bytes10",
        indexed: true,
        internalType: "bytes10",
      },
      {
        name: "newName",
        type: "bytes10",
        indexed: true,
        internalType: "bytes10",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ForwarderAddressUpdated",
    inputs: [
      {
        name: "previousForwarder",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newForwarder",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SecurityWarning",
    inputs: [
      {
        name: "message",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SimulationCompleted",
    inputs: [
      {
        name: "runId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "strategy",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "success",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
      {
        name: "gasUsed",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SimulationQueued",
    inputs: [
      {
        name: "runId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "strategy",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "caller",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "explorerUrl",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "InvalidAuthor",
    inputs: [
      {
        name: "received",
        type: "address",
        internalType: "address",
      },
      {
        name: "expected",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "InvalidForwarderAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidSender",
    inputs: [
      {
        name: "sender",
        type: "address",
        internalType: "address",
      },
      {
        name: "expected",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "InvalidWorkflowId",
    inputs: [
      {
        name: "received",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "expected",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
  },
  {
    type: "error",
    name: "InvalidWorkflowName",
    inputs: [
      {
        name: "received",
        type: "bytes10",
        internalType: "bytes10",
      },
      {
        name: "expected",
        type: "bytes10",
        internalType: "bytes10",
      },
    ],
  },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "SimulationRegistry__InvalidAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "SimulationRegistry__NoRunsFound",
    inputs: [],
  },
  {
    type: "error",
    name: "SimulationRegistry__SimulationAlreadyCompleted",
    inputs: [],
  },
  {
    type: "error",
    name: "SimulationRegistry__UnknownRun",
    inputs: [],
  },
  {
    type: "error",
    name: "WorkflowNameRequiresAuthorValidation",
    inputs: [],
  },
] as const;
