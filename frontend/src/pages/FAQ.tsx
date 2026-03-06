import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const faqs = [
  {
    q: "What is DeFi Strategy Profiler?",
    a: "A developer tool that simulates DeFi strategies on a real Ethereum mainnet fork (via Tenderly Virtual TestNets) and stores the result as a DON-signed proof on Sepolia — trustless and permanent. Built for the Chainlink × Tenderly Hackathon.",
  },
  {
    q: "How is this different from running a local fork?",
    a: "Local forks drift from real mainnet state, results are unverifiable, and gas estimates are inaccurate. DeFi Strategy Profiler uses Tenderly vNets for a full mainnet fork with real liquidity, real Uniswap pools, and real Chainlink price feeds — then writes a DON-signed proof on-chain.",
  },
  {
    q: "What does 'DON-signed' mean?",
    a: "The result is signed by the Chainlink Decentralized Oracle Network — a distributed set of independent nodes. It's not a server signature; it's a cryptographic proof from a decentralized network via the CRE Forwarder.",
  },
  {
    q: "Why are there two CRE workflows (wf-listener + wf-executor)?",
    a: "SimulationQueued is emitted by raw user input — anyone can call requestSimulation() with a malicious strategy address. wf-listener validates the job and writes it to SimulationJobQueue via the CRE Forwarder. Only CRE-attested jobs reach wf-executor. SimulationJobQueue also enforces replay protection.",
  },
  {
    q: "Which chain stores the proof?",
    a: "Sepolia (Ethereum testnet, chain ID 11155111). The SimulationRegistry contract is at 0x6C60a2dEbD7a0406fB08133c44FC0bAeB2424e7d and SimulationJobQueue at 0x9E3EA28542fD36B062ac768037fFb93708529Ad1. Both are shared — anyone can use them.",
  },
  {
    q: "What strategies are included?",
    a: "Three pre-defined strategies: EthToUsdcSwapStrategy (single-hop WETH → USDC via Uniswap V3), EthToUsdcDaiMultiHopStrategy (multi-hop WETH → DAI → USDC), and FailingSlippageStrategy (intentionally reverts to demonstrate revert capture).",
  },
  {
    q: "Can I write my own strategy?",
    a: "Yes. Implement the IDeFiStrategy interface with an execute(address receiver, bytes calldata params) function that returns amountOut. Deploy to the Tenderly vNet and call requestSimulation() on the registry.",
  },
  {
    q: "What are Tenderly Virtual TestNets?",
    a: "Tenderly vNets are full Ethereum mainnet forks with real state, real liquidity, and real prices. They provide an accurate simulation environment that mirrors production exactly — real Uniswap pools, real Chainlink feeds, real block state.",
  },
];

export default function FAQ() {
  return (
    <div className="container max-w-2xl py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-2">FAQ</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Common questions about DeFi Strategy Profiler.
        </p>
      </motion.div>

      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq, i) => (
          <motion.div
            key={i}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-20px" }}
            variants={fadeUp}
          >
            <AccordionItem
              value={`faq-${i}`}
              className="rounded-2xl border border-border bg-card px-5 data-[state=open]:border-muted-foreground/20 transition-colors"
            >
              <AccordionTrigger className="text-sm font-medium text-left py-4 hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-4">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          </motion.div>
        ))}
      </Accordion>
    </div>
  );
}
