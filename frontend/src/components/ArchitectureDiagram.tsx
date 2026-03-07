import { motion } from "framer-motion";
import { Terminal, Database, Radio, Cpu, Shield, ListChecks } from "lucide-react";

const nodes = [
  { icon: Terminal, label: "CLI", sublabel: "npm run cli:provision", color: "foreground" },
  { icon: Database, label: "Registry", sublabel: "SimulationQueued", color: "chainlink" },
  { icon: Radio, label: "wf-listener", sublabel: "Validates + routes", color: "chainlink" },
  { icon: ListChecks, label: "JobQueue", sublabel: "JobEnqueued", color: "chainlink" },
  { icon: Cpu, label: "wf-executor", sublabel: "Runs on Tenderly vNet", color: "tenderly" },
  { icon: Shield, label: "Proof", sublabel: "On-chain forever", color: "success" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function ArchitectureDiagram() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
      className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-0"
    >
      {nodes.map((node, i) => (
        <motion.div key={node.label} variants={item} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card transition-all hover:border-muted-foreground/30">
              <node.icon className={`h-5 w-5 ${
                node.color === "chainlink" ? "text-chainlink" :
                node.color === "tenderly" ? "text-tenderly" :
                node.color === "success" ? "text-success" :
                "text-foreground"
              }`} />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold font-mono">{node.label}</p>
              <p className="text-[10px] text-muted-foreground max-w-[100px]">{node.sublabel}</p>
            </div>
          </div>
          {i < nodes.length - 1 && (
            <motion.div
              className="hidden md:flex items-center mx-2 mb-8"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.12 * (i + 1), duration: 0.4 }}
            >
              <div className="h-px w-10 bg-gradient-to-r from-border to-muted-foreground/30" />
              <div className="h-0 w-0 border-y-[3px] border-l-[6px] border-y-transparent border-l-muted-foreground/30" />
            </motion.div>
          )}
          {i < nodes.length - 1 && (
            <motion.div
              className="flex md:hidden items-center justify-center my-1"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.12 * (i + 1), duration: 0.3 }}
            >
              <div className="w-px h-6 bg-gradient-to-b from-border to-muted-foreground/30" />
            </motion.div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
