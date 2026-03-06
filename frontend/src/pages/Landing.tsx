import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  ArrowRight,
  Terminal,
  Shield,
  Zap,
  Database,
  Activity,
  Layers,
  ExternalLink,
  GitBranch,
  Code2,
  Blocks,
  ArrowRightLeft,
  Flame,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import GridBackground from "@/components/GridBackground";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

export default function Landing() {
  const [searchId, setSearchId] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) navigate(`/run/${searchId.trim()}`);
  };

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-28 md:py-40">
        <GridBackground />
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="container relative max-w-3xl text-center"
        >
          <motion.div
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-xs text-muted-foreground font-mono backdrop-blur-sm"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Live on Sepolia · Powered by Chainlink CRE & Tenderly
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl text-balance"
          >
            DeFi developers have no trustless way to{" "}
            <span className="gradient-text-hero">prove a strategy works.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-5 text-lg text-muted-foreground md:text-xl"
          >
            <span className="gradient-text-chainlink font-semibold">
              DeFi Strategy Profiler
            </span>{" "}
            fixes this.
          </motion.p>

          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-xl mx-auto text-sm text-muted-foreground/80 leading-relaxed"
          >
            Simulate on a real Ethereum mainnet fork via Tenderly. Get a
            DON-signed proof stored permanently on-chain via Chainlink CRE. No
            trust required.
          </motion.p>

          {/* Search */}
          <motion.form
            variants={fadeUp}
            onSubmit={handleSearch}
            className="mt-10 mx-auto flex max-w-md items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter Run ID (e.g. 0, 1, 2)"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card/80 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-chainlink focus:outline-none focus:ring-1 focus:ring-chainlink/50 font-mono backdrop-blur-sm transition-all"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
            >
              View <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.form>

          {/* Quick links */}
          <motion.div
            variants={fadeUp}
            className="mt-5 flex items-center justify-center gap-4 text-xs text-muted-foreground"
          >
            <button
              onClick={() => navigate("/run/1")}
              className="hover:text-foreground transition-colors font-mono"
            >
              Run #1 <ChevronRight className="inline h-3 w-3" />
            </button>
            <button
              onClick={() => navigate("/run/2")}
              className="hover:text-foreground transition-colors font-mono"
            >
              Run #2 <ChevronRight className="inline h-3 w-3" />
            </button>
            <button
              onClick={() => navigate("/run/3")}
              className="hover:text-foreground transition-colors font-mono"
            >
              Run #3 <ChevronRight className="inline h-3 w-3" />
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Architecture Flow ── */}
      <section className="border-t border-border py-20">
        <div className="container max-w-4xl">
          <SectionHeader
            label="Architecture"
            title="From CLI to On-Chain Proof"
          />
          <ArchitectureDiagram />
        </div>
      </section>

      {/* ── 3-Step How ── */}
      <section className="border-t border-border py-20">
        <div className="container max-w-4xl">
          <SectionHeader
            label="How it works"
            title="3 steps to trustless proof"
          />
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-px md:grid-cols-3 bg-border rounded-2xl overflow-hidden"
          >
            {[
              {
                icon: Terminal,
                step: "01",
                title: "Submit Strategy",
                desc: "Deploy your strategy contract and trigger a simulation via the CLI. The CLI writes to SimulationRegistry on Sepolia.",
              },
              {
                icon: Zap,
                step: "02",
                title: "Execute on Fork",
                desc: "Chainlink CRE picks up the job, validates it, and executes your strategy on a Tenderly mainnet fork with real state.",
              },
              {
                icon: Shield,
                step: "03",
                title: "Proof On-Chain",
                desc: "A DON-signed SimulationReport is written back to Sepolia — permanent, verifiable, and trustless.",
              },
            ].map((item) => (
              <motion.div
                key={item.step}
                variants={fadeUp}
                className="bg-card p-8 flex flex-col group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] font-mono text-chainlink font-bold">
                    {item.step}
                  </span>
                  <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-chainlink transition-colors" />
                </div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Three Environments ── */}
      <section className="border-t border-border py-20">
        <div className="container max-w-4xl">
          <SectionHeader
            label="Infrastructure"
            title="Built on production-grade systems"
          />
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-4 md:grid-cols-3"
          >
            <EnvironmentCard
              icon={Database}
              name="Sepolia Testnet"
              role="Coordination + permanent proof"
              desc="SimulationRegistry & SimulationJobQueue. Every result is a permanent, verifiable record."
              color="chainlink"
              link="https://sepolia.etherscan.io/address/0x6C60a2dEbD7a0406fB08133c44FC0bAeB2424e7d"
            />
            <EnvironmentCard
              icon={Layers}
              name="Chainlink CRE"
              role="Decentralized orchestration"
              desc="wf-listener validates, wf-executor runs. DON-signed reports — not a server, not a script."
              color="chainlink"
            />
            <EnvironmentCard
              icon={Activity}
              name="Tenderly vNet"
              role="Mainnet fork execution"
              desc="Full Ethereum mainnet fork with real Uniswap pools, real Chainlink feeds, real block state."
              color="tenderly"
            />
          </motion.div>
        </div>
      </section>

      {/* ── Strategies ── */}
      <section className="border-t border-border py-20">
        <div className="container max-w-4xl">
          <SectionHeader
            label="Pre-defined strategies"
            title="Three example strategies included"
          />
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-4 md:grid-cols-3"
          >
            {[
              {
                icon: ArrowRightLeft,
                name: "WETH → USDC",
                contract: "EthToUsdcSwapStrategy",
                protocol: "Uniswap V3",
                desc: "Single-hop swap. Verifies slippage, gas cost, and output amount on mainnet fork.",
                runId: "1",
              },
              {
                icon: GitBranch,
                name: "Multi-Hop Swap",
                contract: "EthToUsdcDaiMultiHopStrategy",
                protocol: "Uniswap V3",
                desc: "WETH → DAI → USDC multi-hop. Compares routing efficiency against single-hop.",
                runId: "2",
              },
              {
                icon: TrendingDown,
                name: "Failing Strategy",
                contract: "FailingSlippageStrategy",
                protocol: "Uniswap V3",
                desc: "Intentionally reverts — demonstrates revert reason capture and failure reporting.",
                runId: "3",
              },
            ].map((s) => (
              <motion.div
                key={s.name}
                variants={fadeUp}
                onClick={() => navigate(`/run/${s.runId}`)}
                className="rounded-2xl border border-border bg-card p-6 card-hover cursor-pointer group"
              >
                <div className="mb-4 flex items-center gap-2">
                  <s.icon className="h-4 w-4 text-muted-foreground group-hover:text-chainlink transition-colors" />
                  <h3 className="text-sm font-semibold font-mono">{s.name}</h3>
                </div>
                <p className="text-[10px] font-mono text-chainlink/70 mb-2">
                  {s.contract}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {s.desc}
                </p>
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground font-mono">
                    {s.protocol}
                  </span>
                  <span className="text-[10px] text-muted-foreground group-hover:text-chainlink transition-colors font-mono">
                    Run #{s.runId} <ChevronRight className="inline h-3 w-3" />
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="border-t border-border py-20">
        <div className="container max-w-4xl">
          <SectionHeader
            label="Built with"
            title="Production technology stack"
          />
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {[
              { label: "Solidity 0.8.24", sub: "Smart Contracts" },
              { label: "Chainlink CRE", sub: "Decentralized Execution" },
              { label: "Tenderly vNets", sub: "Mainnet Fork" },
              { label: "CRE Forwarder", sub: "On-chain Attestation" },
              { label: "TypeScript", sub: "CLI & Frontend" },
              { label: "React 19 + Vite", sub: "Frontend Framework" },
              { label: "viem", sub: "Ethereum Client" },
              { label: "Foundry", sub: "Contract Testing" },
            ].map((t) => (
              <motion.div
                key={t.label}
                variants={fadeUp}
                className="rounded-xl border border-border bg-card/50 p-4 text-center"
              >
                <p className="text-xs font-semibold font-mono">{t.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t.sub}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Contracts ── */}
      <section className="border-t border-border py-20">
        <div className="container max-w-4xl">
          <SectionHeader
            label="Deployed on Sepolia"
            title="Shared contracts — anyone can use them"
          />
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="space-y-3"
          >
            {[
              {
                name: "SimulationRegistry",
                address: "0x6C60a2dEbD7a0406fB08133c44FC0bAeB2424e7d",
                desc: "Stores run requests and DON-signed simulation reports.",
              },
              {
                name: "SimulationJobQueue",
                address: "0x9E3EA28542fD36B062ac768037fFb93708529Ad1",
                desc: "CRE Forwarder-verified job queue with replay protection.",
              },
            ].map((c) => (
              <motion.a
                key={c.name}
                variants={fadeUp}
                href={`https://sepolia.etherscan.io/address/${c.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-border bg-card p-5 card-hover group"
              >
                <div>
                  <p className="text-sm font-semibold font-mono">{c.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                  <p className="text-[10px] font-mono text-chainlink/60 mt-2">
                    {c.address}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-chainlink transition-colors shrink-0 ml-4" />
              </motion.a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Roadmap ── */}
      <section className="border-t border-border py-20">
        <div className="container max-w-2xl">
          <SectionHeader label="What's next" title="Roadmap" />
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="space-y-4"
          >
            {[
              {
                phase: "v1.0",
                title: "Initial Release",
                status: "live",
                items: [
                  "Single strategy execution",
                  "On-chain proof storage",
                  "Public frontend viewer",
                ],
              },
              {
                phase: "v1.1",
                title: "Multi-Strategy",
                status: "next",
                items: [
                  "Multi-strategy batch runs",
                  "Strategy comparison dashboard",
                  "Gas optimization reports",
                ],
              },
              {
                phase: "v2.0",
                title: "Production",
                status: "planned",
                items: [
                  "Multi-chain forks (Arbitrum, Base, Optimism)",
                  "Cross-chain simulation via CCIP",
                  "Custom strategy builder from frontend",
                ],
              },
            ].map((r) => (
              <motion.div
                key={r.phase}
                variants={fadeUp}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-xs font-bold text-chainlink">
                    {r.phase}
                  </span>
                  <span className="text-sm font-semibold">{r.title}</span>
                  <span
                    className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium ${
                      r.status === "live"
                        ? "bg-success/10 text-success border border-success/20"
                        : r.status === "next"
                          ? "bg-chainlink/10 text-chainlink border border-chainlink/20"
                          : "bg-secondary text-muted-foreground border border-border"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {r.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  );
}

/* ── Sub-components ── */

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-center mb-12"
    >
      <p className="text-[10px] font-mono uppercase tracking-widest text-chainlink/70 mb-2">
        {label}
      </p>
      <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
    </motion.div>
  );
}

function EnvironmentCard({
  name,
  role,
  desc,
  color,
  icon: Icon,
  link,
}: {
  name: string;
  role: string;
  desc: string;
  color: "chainlink" | "tenderly";
  icon: React.ElementType;
  link?: string;
}) {
  const Wrapper = link ? "a" : "div";
  const props = link
    ? { href: link, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <motion.div variants={fadeUp}>
      <Wrapper
        {...(props as any)}
        className={`block rounded-2xl border border-border bg-card p-6 card-hover group ${
          color === "chainlink"
            ? "hover:border-chainlink/30"
            : "hover:border-tenderly/30"
        }`}
      >
        <div className="mb-4 flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              color === "chainlink" ? "bg-chainlink" : "bg-tenderly"
            } animate-pulse-glow`}
          />
          <Icon className="h-4 w-4 text-muted-foreground" />
          {link && (
            <ExternalLink className="h-3 w-3 text-muted-foreground/50 ml-auto" />
          )}
        </div>
        <h3 className="text-sm font-semibold mb-1">{name}</h3>
        <p className="text-[10px] font-mono text-muted-foreground/60 mb-2">
          {role}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </Wrapper>
    </motion.div>
  );
}
