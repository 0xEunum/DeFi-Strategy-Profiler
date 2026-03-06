import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const steps = [
  {
    title: "CLI Trigger",
    desc: "Developer submits a strategy contract address and parameters via the CLI tool.",
    detail: "npm run cli:provision:0 → deployStrategy() → requestSimulation()",
  },
  {
    title: "Registry Write",
    desc: "The CLI writes a new run entry to SimulationRegistry on Sepolia, emitting SimulationQueued.",
    detail: "SimulationRegistry.requestSimulation(strategyAddr, explorerUrl) → emit SimulationQueued(runId)",
  },
  {
    title: "wf-listener Detects",
    desc: "A Chainlink CRE workflow listener monitors the registry for new SimulationQueued events.",
    detail: "CRE logTrigger → validates strategy address + explorerUrl → encodes JobReport",
  },
  {
    title: "JobQueue Routes",
    desc: "The validated job is written to SimulationJobQueue via CRE Forwarder with replay protection.",
    detail: "SimulationJobQueue.onReport() → CRE Forwarder verified → emit JobEnqueued(runId)",
  },
  {
    title: "wf-executor Runs",
    desc: "A second CRE workflow picks up JobEnqueued and prepares the simulation environment.",
    detail: "logTrigger on JobEnqueued → calls strategy.execute() on Tenderly vNet via Admin RPC",
  },
  {
    title: "Tenderly vNet Simulation",
    desc: "Strategy executes on a full Ethereum mainnet fork — real Uniswap pools, real Chainlink feeds, real state.",
    detail: "Captures: amountOut · gasUsed · effectiveGasPrice · revertReason",
  },
  {
    title: "Registry Proof Stored",
    desc: "The DON-signed SimulationReport is written back to Sepolia registry — permanent and trustless.",
    detail: "SimulationRegistry.writeReport(runId, signedReport) → queryable at /run/<runId>",
  },
];

export default function HowItWorks() {
  return (
    <div className="container max-w-2xl py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-2">How It Works</h1>
        <p className="text-sm text-muted-foreground mb-4">
          End-to-end flow from CLI submission to on-chain proof, in 7 steps.
        </p>
        <div className="mb-12 rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-2">Why two CRE workflows?</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">wf-listener</span> validates untrusted user input before it reaches <span className="text-foreground font-medium">wf-executor</span>. Only CRE Forwarder-verified jobs pass through SimulationJobQueue — with built-in replay protection.
          </p>
        </div>
      </motion.div>

      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-chainlink/30 via-tenderly/20 to-success/30" />

        <div className="space-y-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-30px" }}
              variants={fadeUp}
              className="relative flex gap-5"
            >
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card group-hover:border-chainlink/30 transition-colors">
                <span className="text-[10px] font-mono font-bold text-chainlink">{i + 1}</span>
              </div>
              <div className="pb-2">
                <h3 className="text-sm font-semibold mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">{step.desc}</p>
                <code className="block rounded-lg bg-secondary/80 border border-border px-3 py-2 text-[11px] font-mono text-muted-foreground leading-relaxed">
                  {step.detail}
                </code>
              </div>
            </motion.div>
          ))}

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            className="relative flex gap-5"
          >
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div className="pt-1">
              <p className="text-sm font-semibold text-success">Done — proof is on-chain and publicly verifiable.</p>
              <p className="text-xs text-muted-foreground mt-1">View any run at <span className="font-mono text-chainlink">/run/&lt;runId&gt;</span></p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
