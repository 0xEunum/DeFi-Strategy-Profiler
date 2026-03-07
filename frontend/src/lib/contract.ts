import { createPublicClient, http, formatEther, formatGwei } from 'viem';
import { sepolia } from 'viem/chains';

export const REGISTRY_ADDRESS = '0x6C60a2dEbD7a0406fB08133c44FC0bAeB2424e7d' as const;
export const JOB_QUEUE_ADDRESS = '0x9E3EA28542fD36B062ac768037fFb93708529Ad1' as const;

// Keep old export for backward compat
export const CONTRACT_ADDRESS = REGISTRY_ADDRESS;

export const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
});

// ─── Status enum matches Solidity: 0=Pending, 1=Success, 2=Failed ───
export enum SimulationStatus {
  Pending = 0,
  Success = 1,
  Failed = 2,
}

// ─── Interfaces matching actual Solidity structs ───

export interface RunIdentity {
  strategy: string;
  caller: string;
  chainId: bigint;
  forkBlock: bigint;
  tenderlyRunId: string;   // bytes32
  commitHash: string;      // bytes32
  tokenIn: string;         // address
  tokenOut: string;        // address
  timestamp: bigint;
  status: SimulationStatus;
  explorerUrl: string;
}

export interface RunOutcome {
  amountIn: bigint;
  paramsHash: string;       // bytes32
  amountOut: bigint;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  totalCostInTokenIn: bigint;
  revertReasonHash: string; // bytes32
}

// ─── ABI (matching actual contract) ───

const registryAbi = [
  {
    name: 'getRunIdentity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'runId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'strategy', type: 'address' },
          { name: 'caller', type: 'address' },
          { name: 'chainId', type: 'uint64' },
          { name: 'forkBlock', type: 'uint64' },
          { name: 'tenderlyRunId', type: 'bytes32' },
          { name: 'commitHash', type: 'bytes32' },
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'timestamp', type: 'uint64' },
          { name: 'status', type: 'uint8' },
          { name: 'explorerUrl', type: 'string' },
        ],
      },
    ],
  },
  {
    name: 'getRunOutcome',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'runId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'amountIn', type: 'uint256' },
          { name: 'paramsHash', type: 'bytes32' },
          { name: 'amountOut', type: 'uint256' },
          { name: 'gasUsed', type: 'uint256' },
          { name: 'effectiveGasPrice', type: 'uint256' },
          { name: 'totalCostInTokenIn', type: 'uint256' },
          { name: 'revertReasonHash', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    name: 's_nextRunId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── Contract reads ───

export async function getRunIdentity(runId: bigint): Promise<RunIdentity> {
  const result = await client.readContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 'getRunIdentity',
    args: [runId],
  } as any);

  const r = result as any;
  return {
    strategy: r.strategy,
    caller: r.caller,
    chainId: BigInt(r.chainId),
    forkBlock: BigInt(r.forkBlock),
    tenderlyRunId: r.tenderlyRunId,
    commitHash: r.commitHash,
    tokenIn: r.tokenIn,
    tokenOut: r.tokenOut,
    timestamp: BigInt(r.timestamp),
    status: Number(r.status) as SimulationStatus,
    explorerUrl: r.explorerUrl,
  };
}

export async function getRunOutcome(runId: bigint): Promise<RunOutcome> {
  const result = await client.readContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 'getRunOutcome',
    args: [runId],
  } as any);

  const r = result as any;
  return {
    amountIn: BigInt(r.amountIn),
    paramsHash: r.paramsHash,
    amountOut: BigInt(r.amountOut),
    gasUsed: BigInt(r.gasUsed),
    effectiveGasPrice: BigInt(r.effectiveGasPrice),
    totalCostInTokenIn: BigInt(r.totalCostInTokenIn),
    revertReasonHash: r.revertReasonHash,
  };
}

export async function getNextRunId(): Promise<bigint> {
  const result = await client.readContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 's_nextRunId',
  } as any);
  return BigInt(result as any);
}

// ─── Formatting helpers ───

export function weiToGwei(wei: bigint): string {
  return formatGwei(wei);
}

export function weiToEth(wei: bigint): string {
  return formatEther(wei);
}

export function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function isZeroBytes32(hash: string): boolean {
  return !hash || hash === '0x' + '0'.repeat(64);
}

export function statusLabel(status: SimulationStatus): 'SUCCESS' | 'FAILED' | 'PENDING' {
  switch (status) {
    case SimulationStatus.Success: return 'SUCCESS';
    case SimulationStatus.Failed: return 'FAILED';
    default: return 'PENDING';
  }
}
