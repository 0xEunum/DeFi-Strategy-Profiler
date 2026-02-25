export type TenderlyVNetResponse = {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  fork_config: {
    network_id: number;
    block_number: string; // hex string e.g. "0x12c50f0"
  };
  virtual_network_config: {
    chain_config: {
      chain_id: number;
    };
    accounts: Array<{ address: `0x${string}` }>;
  };
  sync_state_config: {
    enabled: boolean;
  };
  explorer_page_config: {
    enabled: boolean;
    verification_visibility: string;
  };
  rpcs: Array<{
    url: string;
    name: string;
  }>;
  rpc_config: {
    rpc_persistence_config: {
      methods: Array<{ method: string }>;
    };
    rpc_name: {
      name: string;
      suffix: string;
    };
  };
};

// Parsed and normalized shape used throughout the CLI
export type VNetDetails = {
  id: string;
  displayName: string;
  adminRpc: string; // HTTPS Admin RPC — impersonation, tenderly_setBalance
  adminRpcWss: string; // WSS Admin RPC   — for CRE workflow log triggers
  publicRpc: string; // HTTPS Public RPC — forge script deploy
  publicRpcWss: string; // WSS Public RPC   — standard subscriptions
  explorerUrl: string; // dashboard URL for sharing proof
  chainId: number;
  forkBlock: number; // parsed from fork_config.block_number
  accounts: `0x${string}`[]; // unlocked accounts from vNet response
  deployerAddress: `0x${string}`; // accounts[0] — used for deploying strategies
  executorAddress: `0x${string}`; // accounts[1] - executor-workflow uses this
};

export type StrategyDeployment = {
  address: string;
  strategyIndex: number;
  strategyName: string;
};

export type SimulationRequest = {
  runId: bigint;
  txHash: string;
  strategyAddr: string;
  explorerUrl: string;
  sepoliaEtherscanUrl: string;
};
