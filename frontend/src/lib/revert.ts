import { decodeErrorResult, parseAbi } from 'viem';

// Common Solidity error signatures
const KNOWN_ERRORS = parseAbi([
  'error Error(string)',
  'error Panic(uint256)',
  'error InsufficientOutputAmount()',
  'error TooLittleReceived()',
  'error SlippageExceeded(uint256 expected, uint256 actual)',
  'error TransferFailed()',
  'error InsufficientLiquidity()',
  'error Expired(uint256 deadline)',
  'error InvalidPath()',
]);

const PANIC_CODES: Record<number, string> = {
  0x00: "Generic compiler panic",
  0x01: "Assert failed",
  0x11: "Arithmetic overflow/underflow",
  0x12: "Division or modulo by zero",
  0x21: "Conversion to negative value",
  0x22: "Storage encoding error",
  0x31: "Pop on empty array",
  0x32: "Array index out of bounds",
  0x41: "Too much memory allocated",
  0x51: "Called zero-initialized function",
};

export interface DecodedRevert {
  name: string;
  args?: string;
  raw: string;
}

export function decodeRevertReason(revertReasonHash: string): DecodedRevert {
  // If it's just a bytes32 hash (not actual revert data), we can't decode it
  if (!revertReasonHash || revertReasonHash === '0x' + '0'.repeat(64)) {
    return { name: "Unknown", raw: revertReasonHash };
  }

  // If it's a bytes32 hash (64 hex chars + 0x prefix = 66 chars), it's a keccak of the revert
  if (revertReasonHash.length === 66) {
    // Known revert reason hashes (keccak256 of common revert strings)
    const knownHashes: Record<string, string> = {
      // Add known hashes as we discover them
    };
    
    const known = knownHashes[revertReasonHash.toLowerCase()];
    if (known) {
      return { name: known, raw: revertReasonHash };
    }

    return {
      name: "Hashed Revert Reason",
      args: "The revert reason was stored as a keccak256 hash. The original error message can be matched if the source is known.",
      raw: revertReasonHash,
    };
  }

  // Try to decode as ABI-encoded error
  try {
    const decoded = decodeErrorResult({
      abi: KNOWN_ERRORS,
      data: revertReasonHash as `0x${string}`,
    });

    if (decoded.errorName === 'Panic') {
      const code = Number(decoded.args[0]);
      const reason = PANIC_CODES[code] || `Unknown panic code: 0x${code.toString(16)}`;
      return { name: "Panic", args: reason, raw: revertReasonHash };
    }

    if (decoded.errorName === 'Error') {
      return { name: "Error", args: decoded.args[0] as string, raw: revertReasonHash };
    }

    return {
      name: decoded.errorName,
      args: decoded.args ? JSON.stringify(decoded.args, (_, v) => typeof v === 'bigint' ? v.toString() : v) : undefined,
      raw: revertReasonHash,
    };
  } catch {
    // If can't decode, return the raw hash
    return {
      name: "Encoded Revert",
      args: "Could not decode — custom error signature not in known set.",
      raw: revertReasonHash,
    };
  }
}
