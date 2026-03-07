import { motion, AnimatePresence } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  getRunIdentity,
  getRunOutcome,
  weiToGwei,
  weiToEth,
  REGISTRY_ADDRESS,
  JOB_QUEUE_ADDRESS,
  shortenAddress,
  isZeroBytes32,
  statusLabel,
  SimulationStatus,
} from "@/lib/contract";
import {
  getTokenMeta,
  formatTokenAmount,
  getTokenLabel,
  weiToUsd,
  ethToUsd,
} from "@/lib/tokens";
import { decodeRevertReason } from "@/lib/revert";
import {
  Shield,
  ArrowRightLeft,
  Fuel,
  ExternalLink,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  ArrowLeft,
  Layers,
  Globe,
  DollarSign,
  Coins,
  Info,
  Hash,
  Eye,
  EyeOff,
  ArrowRight,
  Zap,
  FileCode,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function RunPage() {
  const { runId } = useParams<{ runId: string }>();
  const id = BigInt(runId || "0");
  const [showUsd, setShowUsd] = useState(false);
  const [showDecodedHashes, setShowDecodedHashes] = useState(false);

  const identity = useQuery({
    queryKey: ["runIdentity", runId],
    queryFn: () => getRunIdentity(id),
    enabled: !!runId,
    retry: 1,
  });

  const outcome = useQuery({
    queryKey: ["runOutcome", runId],
    queryFn: () => getRunOutcome(id),
    enabled: !!runId,
    retry: 1,
  });

  // ── Dynamic ETH price from CoinGecko (free, no API key) ──
  const ethPrice = useQuery({
    queryKey: ["ethPrice"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      );
      if (!res.ok) throw new Error("Failed to fetch ETH price");
      const data = await res.json();
      return data.ethereum.usd as number;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const isLoading = identity.isLoading || outcome.isLoading;
  const isError = identity.isError || outcome.isError;

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-20">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-2xl bg-card animate-pulse border border-border"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container max-w-4xl py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <AlertTriangle className="mx-auto h-8 w-8 text-warning mb-4" />
          <h2 className="text-lg font-semibold mb-2">Run not found</h2>
          <p className="text-sm text-muted-foreground">
            Run ID <span className="font-mono text-foreground">#{runId}</span>{" "}
            does not exist or the contract call reverted.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 mt-6 text-xs text-chainlink hover:underline font-mono"
          >
            <ArrowLeft className="h-3 w-3" /> Back to home
          </Link>
        </motion.div>
      </div>
    );
  }

  const run = identity.data!;
  const out = outcome.data!;

  const status = statusLabel(run.status);
  const statusConfig = {
    SUCCESS: {
      icon: CheckCircle2,
      class: "bg-success/10 text-success border-success/20",
    },
    FAILED: {
      icon: XCircle,
      class: "bg-destructive/10 text-destructive border-destructive/20",
    },
    PENDING: {
      icon: Clock,
      class: "bg-warning/10 text-warning border-warning/20",
    },
  };
  const sc = statusConfig[status];

  const tokenInMeta = getTokenMeta(run.tokenIn);
  const tokenOutMeta = getTokenMeta(run.tokenOut);
  const tokenInLabel = getTokenLabel(run.tokenIn);
  const tokenOutLabel = getTokenLabel(run.tokenOut);

  const amountInFormatted = tokenInMeta
    ? formatTokenAmount(out.amountIn, tokenInMeta.decimals)
    : out.amountIn.toString();
  const amountOutFormatted = tokenOutMeta
    ? formatTokenAmount(out.amountOut, tokenOutMeta.decimals)
    : out.amountOut.toString();

  const exchangeRate =
    out.amountIn > 0n && out.amountOut > 0n && tokenInMeta && tokenOutMeta
      ? (
          Number(formatTokenAmount(out.amountOut, tokenOutMeta.decimals)) /
          Number(formatTokenAmount(out.amountIn, tokenInMeta.decimals))
        ).toFixed(4)
      : "N/A";

  const hasFailed = run.status === SimulationStatus.Failed;
  const totalGasCostWei =
    out.gasUsed > 0n && out.effectiveGasPrice > 0n
      ? out.gasUsed * out.effectiveGasPrice
      : 0n;
  const totalGasCostEth =
    totalGasCostWei > 0n ? weiToEth(totalGasCostWei) : "0";

  // ── Dynamic ETH price vars ──
  const ethPriceUsd = ethPrice.data ?? 2000;
  const ethPriceLabel = ethPrice.isLoading
    ? "…"
    : `$${ethPriceUsd.toLocaleString()}`;

  // ── Use dynamic price for gas cost USD ──
  const totalGasCostUsd =
    totalGasCostWei > 0n
      ? ((Number(totalGasCostWei) / 1e18) * ethPriceUsd).toFixed(2)
      : "0.00";

  const decodedRevert =
    hasFailed && !isZeroBytes32(out.revertReasonHash)
      ? decodeRevertReason(out.revertReasonHash)
      : null;

  // Merge explorerUrl + tenderlyRunId for the actual tx link
  const tenderlyTxUrl =
    run.explorerUrl && !isZeroBytes32(run.tenderlyRunId)
      ? `${run.explorerUrl.replace(/\/$/, "")}/tx/${run.tenderlyRunId}`
      : run.explorerUrl || null;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={stagger}
      className="container max-w-4xl py-12"
    >
      {/* Back */}
      <motion.div variants={fadeUp}>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> All runs
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div variants={fadeUp} className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-xl font-bold font-mono">
            Simulation Report #{runId}
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium ${sc.class}`}
          >
            <sc.icon className="h-3 w-3" />
            {status}
          </span>
          {tokenInMeta && tokenOutMeta && (
            <span className="rounded-full border border-border bg-secondary px-3 py-0.5 text-xs font-mono text-muted-foreground">
              {tokenInLabel} → {tokenOutLabel}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <AddressChip
            label="Strategy"
            address={run.strategy}
            note="On Tenderly vNet"
            noEtherscan
          />
          <AddressChip label="Caller" address={run.caller} />
          {run.timestamp > 0n && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(Number(run.timestamp) * 1000).toLocaleString()}
            </span>
          )}
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        variants={fadeUp}
        className="mb-4 flex flex-wrap items-center gap-3"
      >
        {/* ETH/USD Toggle */}
        <button
          onClick={() => setShowUsd(!showUsd)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-mono transition-all ${
            showUsd
              ? "border-warning/30 bg-warning/5 text-warning"
              : "border-border bg-card text-foreground"
          }`}
        >
          {showUsd ? (
            <DollarSign className="h-3.5 w-3.5" />
          ) : (
            <Coins className="h-3.5 w-3.5" />
          )}
          {/* ── Dynamic price label ── */}
          {showUsd ? `USD (~${ethPriceLabel}/ETH)` : "ETH"}
          <span className="text-muted-foreground/50 ml-1">tap to switch</span>
        </button>

        {/* Hash Decode Toggle */}
        <button
          onClick={() => setShowDecodedHashes(!showDecodedHashes)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-mono transition-all ${
            showDecodedHashes
              ? "border-chainlink/30 bg-chainlink/5 text-chainlink"
              : "border-border bg-card text-foreground"
          }`}
        >
          {showDecodedHashes ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          {showDecodedHashes ? "Hashes Decoded" : "Decode Hashes"}
        </button>
      </motion.div>

      <div className="space-y-4">
        {/* Tenderly Explorer — THE STAR */}
        {tenderlyTxUrl && (
          <motion.a
            variants={fadeUp}
            href={tenderlyTxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl border border-tenderly/30 bg-tenderly/5 p-6 group card-hover glow-tenderly"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tenderly/10 border border-tenderly/20">
                <Globe className="h-5 w-5 text-tenderly" />
              </div>
              <div>
                <p className="text-sm font-semibold text-tenderly">
                  View strategy.execute() Transaction on Tenderly
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Full traces, state diffs, gas profiler, event logs, call stack
                  — A to Z metrics
                </p>
                {!isZeroBytes32(run.tenderlyRunId) && (
                  <p className="text-[10px] font-mono text-tenderly/50 mt-1">
                    tx: {run.tenderlyRunId.slice(0, 18)}…
                    {run.tenderlyRunId.slice(-8)}
                  </p>
                )}
              </div>
            </div>
            <ExternalLink className="h-5 w-5 text-tenderly/60 group-hover:text-tenderly transition-colors shrink-0" />
          </motion.a>
        )}

        {/* Token Flow */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <ArrowRightLeft className="h-4 w-4 text-chainlink" />
            <h3 className="text-sm font-semibold">Token Flow</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount In */}
            <div className="rounded-xl border border-border bg-secondary/30 p-5">
              <p className="text-[10px] font-mono uppercase text-muted-foreground/60 mb-1">
                Amount In
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-mono font-bold">
                  {amountInFormatted}
                </p>
                <span className="text-sm font-mono text-chainlink font-semibold">
                  {tokenInLabel}
                </span>
              </div>
              {tokenInMeta && (
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  {tokenInMeta.name} · {tokenInMeta.decimals} decimals
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/50 font-mono mt-1 break-all">
                {run.tokenIn}
              </p>
            </div>

            {/* Amount Out */}
            <div className="rounded-xl border border-border bg-secondary/30 p-5">
              <p className="text-[10px] font-mono uppercase text-muted-foreground/60 mb-1">
                Amount Out
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-mono font-bold">
                  {amountOutFormatted}
                </p>
                <span className="text-sm font-mono text-tenderly font-semibold">
                  {tokenOutLabel}
                </span>
              </div>
              {tokenOutMeta && (
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  {tokenOutMeta.name} · {tokenOutMeta.decimals} decimals
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/50 font-mono mt-1 break-all">
                {run.tokenOut}
              </p>
            </div>
          </div>

          {/* Arrow indicator */}
          {out.amountIn > 0n && out.amountOut > 0n && (
            <div className="flex items-center justify-center gap-3 my-4 py-3 border-t border-b border-border">
              <span className="text-xs font-mono text-muted-foreground">
                {amountInFormatted} {tokenInLabel}
              </span>
              <ArrowRight className="h-4 w-4 text-chainlink" />
              <span className="text-xs font-mono text-muted-foreground">
                {amountOutFormatted} {tokenOutLabel}
              </span>
              <span className="text-[10px] text-muted-foreground/50 ml-2">
                (1 {tokenInLabel} = {exchangeRate} {tokenOutLabel})
              </span>
            </div>
          )}

          {/* Params Hash */}
          {!isZeroBytes32(out.paramsHash) && (
            <HashDisplay
              label="Params Hash"
              hash={out.paramsHash}
              decoded={showDecodedHashes}
              description="keccak256 of the encoded strategy parameters passed to execute(). Use this to verify the exact params that were used."
            />
          )}
        </motion.div>

        {/* Gas Metrics */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Fuel className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold">Gas Metrics</h3>
            </div>
            {/* ── Dynamic price label ── */}
            <span className="text-[10px] font-mono text-muted-foreground/50">
              {showUsd
                ? `Showing USD (~${ethPriceLabel}/ETH)`
                : "Showing ETH values"}
            </span>
          </div>

          {/* Primary gas cost */}
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 mb-4">
            <p className="text-[10px] font-mono uppercase text-warning/60 mb-1">
              Total Execution Cost
            </p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-2xl font-mono font-bold">
                {showUsd ? `$${totalGasCostUsd}` : `${totalGasCostEth} ETH`}
              </p>
              <span className="text-xs text-muted-foreground font-mono">
                {showUsd ? `${totalGasCostEth} ETH` : `≈ $${totalGasCostUsd}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <GasCell
              label="Gas Used"
              value={
                out.gasUsed > 0n ? Number(out.gasUsed).toLocaleString() : "—"
              }
              sub="units"
            />
            <GasCell
              label="Gas Price"
              value={
                out.effectiveGasPrice > 0n
                  ? showUsd
                    ? // ── Dynamic price for gas price USD conversion ──
                      `$${((Number(weiToGwei(out.effectiveGasPrice)) / 1e9) * ethPriceUsd).toFixed(6)}`
                    : `${weiToGwei(out.effectiveGasPrice)} gwei`
                  : "—"
              }
              sub={
                out.effectiveGasPrice > 0n
                  ? `${out.effectiveGasPrice.toString()} wei`
                  : undefined
              }
            />
            <GasCell
              label="Total Cost"
              value={
                totalGasCostWei > 0n
                  ? showUsd
                    ? `$${totalGasCostUsd}`
                    : `${totalGasCostEth} ETH`
                  : "—"
              }
              sub={
                totalGasCostWei > 0n
                  ? `${totalGasCostWei.toLocaleString()} wei`
                  : undefined
              }
            />
            <GasCell
              label="Cost in TokenIn"
              value={
                out.totalCostInTokenIn > 0n
                  ? tokenInMeta
                    ? `${formatTokenAmount(out.totalCostInTokenIn, tokenInMeta.decimals)} ${tokenInLabel}`
                    : out.totalCostInTokenIn.toString()
                  : "—"
              }
              sub="denominated in input token"
            />
            <GasCell
              label="Gas Used × Price"
              value={
                out.gasUsed > 0n && out.effectiveGasPrice > 0n
                  ? `${Number(out.gasUsed).toLocaleString()} × ${weiToGwei(out.effectiveGasPrice)} gwei`
                  : "—"
              }
              sub="computation breakdown"
            />
            <GasCell
              label="Efficiency"
              value={
                out.gasUsed > 0n
                  ? Number(out.gasUsed) < 100_000
                    ? "🟢 Low"
                    : Number(out.gasUsed) < 300_000
                      ? "🟡 Medium"
                      : "🔴 High"
                  : "—"
              }
              sub="gas consumption rating"
            />
          </div>
        </motion.div>

        {/* Revert Reason (if failed) */}
        {hasFailed && (
          <motion.div
            variants={fadeUp}
            className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold text-destructive">
                Revert Details
              </h3>
            </div>

            {decodedRevert ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-destructive/10 border border-destructive/15 p-4">
                  <p className="text-[10px] font-mono uppercase text-destructive/60 mb-1">
                    Error Type
                  </p>
                  <p className="text-sm font-mono font-bold text-destructive">
                    {decodedRevert.name}
                  </p>
                  {decodedRevert.args && (
                    <>
                      <p className="text-[10px] font-mono uppercase text-destructive/60 mb-1 mt-3">
                        Decoded Message
                      </p>
                      <p className="text-xs font-mono text-destructive/80 break-all">
                        {decodedRevert.args}
                      </p>
                    </>
                  )}
                </div>
                <HashDisplay
                  label="Revert Reason Hash"
                  hash={decodedRevert.raw}
                  decoded={showDecodedHashes}
                  description={`Decoded: ${decodedRevert.name}${decodedRevert.args ? ` — ${decodedRevert.args}` : ""}`}
                  variant="destructive"
                />
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <p>
                    View the full stack trace and decoded revert on the Tenderly
                    Explorer for complete debugging info.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-destructive/70 font-mono">
                Simulation reverted but no revert reason hash was stored
                on-chain.
              </p>
            )}
          </motion.div>
        )}

        {/* Run Context & Hashes */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Layers className="h-4 w-4 text-chainlink" />
            <h3 className="text-sm font-semibold">Run Context</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <DataCell
              label="Chain ID"
              value={
                run.chainId > 0n
                  ? `${run.chainId.toString()} (Mainnet Fork)`
                  : "—"
              }
              mono
            />
            <DataCell
              label="Fork Block"
              value={
                run.forkBlock > 0n
                  ? `#${Number(run.forkBlock).toLocaleString()}`
                  : "—"
              }
              mono
            />
            <DataCell label="Simulation Status" value={status} mono />
            <DataCell
              label="Token In"
              value={`${tokenInLabel}${tokenInMeta ? ` (${tokenInMeta.name})` : ""}`}
              mono
            />
            <DataCell
              label="Token Out"
              value={`${tokenOutLabel}${tokenOutMeta ? ` (${tokenOutMeta.name})` : ""}`}
              mono
            />
            <DataCell label="Run ID" value={`#${runId}`} mono />
          </div>

          {/* Hashes section */}
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                <Hash className="h-3 w-3" /> On-Chain Hashes
              </p>
            </div>

            {!isZeroBytes32(run.tenderlyRunId) && (
              <HashDisplay
                label="Tenderly Run ID (TX Hash)"
                hash={run.tenderlyRunId}
                decoded={showDecodedHashes}
                description="The transaction hash of strategy.execute() on Tenderly vNet. This is the actual execution transaction."
              />
            )}

            {!isZeroBytes32(run.commitHash) && (
              <HashDisplay
                label="Commit Hash"
                hash={run.commitHash}
                decoded={showDecodedHashes}
                description="Git commit hash of the strategy code at time of simulation. Ensures reproducibility."
              />
            )}

            {!isZeroBytes32(out.paramsHash) && (
              <HashDisplay
                label="Params Hash"
                hash={out.paramsHash}
                decoded={showDecodedHashes}
                description="keccak256 of the encoded parameters passed to strategy.execute(). Verify that exact params were used."
              />
            )}

            {hasFailed && !isZeroBytes32(out.revertReasonHash) && (
              <HashDisplay
                label="Revert Reason Hash"
                hash={out.revertReasonHash}
                decoded={showDecodedHashes}
                description={
                  decodedRevert
                    ? `Decoded: ${decodedRevert.name}${decodedRevert.args ? ` — ${decodedRevert.args}` : ""}`
                    : "Could not decode revert reason."
                }
                variant="destructive"
              />
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5">
              <Info className="h-3 w-3" />
              Strategy contracts live on Tenderly Virtual TestNets (mainnet
              fork). Only the proof is stored on Sepolia.
            </p>
          </div>
        </motion.div>

        {/* On-Chain Proof */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-chainlink/20 bg-chainlink/5 p-6 glow-chainlink"
        >
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-chainlink" />
            <h3 className="text-sm font-semibold text-chainlink">
              On-Chain Proof
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Signed by the Chainlink DON via CRE Forwarder — not a server, not a
            script. This result is a permanent, verifiable record stored on
            Sepolia's SimulationRegistry.
          </p>
          <div className="flex flex-wrap gap-4 mt-4">
            <a
              href={`https://sepolia.etherscan.io/address/${REGISTRY_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-mono text-chainlink/70 hover:text-chainlink transition-colors"
            >
              SimulationRegistry <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={`https://sepolia.etherscan.io/address/${JOB_QUEUE_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-mono text-chainlink/70 hover:text-chainlink transition-colors"
            >
              SimulationJobQueue <ExternalLink className="h-3 w-3" />
            </a>
            {tenderlyTxUrl && (
              <a
                href={tenderlyTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-mono text-tenderly/70 hover:text-tenderly transition-colors"
              >
                Tenderly TX <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── Sub-components ── */

function AddressChip({
  label,
  address,
  note,
  noEtherscan,
}: {
  label: string;
  address: string;
  note?: string;
  noEtherscan?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="flex items-center gap-1">
      {label}:{" "}
      {noEtherscan ? (
        <span className="font-mono text-chainlink">
          {shortenAddress(address)}
        </span>
      ) : (
        <a
          href={`https://sepolia.etherscan.io/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-chainlink hover:underline"
        >
          {shortenAddress(address)}
        </a>
      )}
      <button
        onClick={copy}
        className="text-muted-foreground/50 hover:text-foreground transition-colors"
        title="Copy"
      >
        {copied ? (
          <CheckCircle2 className="h-3 w-3 text-success" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
      {note && (
        <span className="text-[10px] text-muted-foreground/40">({note})</span>
      )}
    </span>
  );
}

function DataCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <p className="text-[10px] font-mono uppercase text-muted-foreground/60 mb-1">
        {label}
      </p>
      <p
        className={`text-sm font-medium truncate ${mono ? "font-mono" : ""}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function GasCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <p className="text-[10px] font-mono uppercase text-muted-foreground/60 mb-1">
        {label}
      </p>
      <p className="text-sm font-mono font-medium truncate" title={value}>
        {value}
      </p>
      {sub && (
        <p className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">
          {sub}
        </p>
      )}
    </div>
  );
}

function HashDisplay({
  label,
  hash,
  decoded,
  description,
  variant,
}: {
  label: string;
  hash: string;
  decoded: boolean;
  description: string;
  variant?: "destructive";
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const borderColor =
    variant === "destructive" ? "border-destructive/20" : "border-border";
  const bgColor =
    variant === "destructive" ? "bg-destructive/5" : "bg-secondary/30";

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-mono uppercase text-muted-foreground/60">
          {label}
        </p>
        <button
          onClick={copy}
          className="text-muted-foreground/40 hover:text-foreground transition-colors"
          title="Copy hash"
        >
          {copied ? (
            <CheckCircle2 className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      <p className="text-xs font-mono text-muted-foreground break-all leading-relaxed">
        {hash}
      </p>
      <AnimatePresence>
        {decoded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-border/50">
              <p className="text-[10px] font-mono text-chainlink/70 flex items-center gap-1">
                <Eye className="h-3 w-3" /> {description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
