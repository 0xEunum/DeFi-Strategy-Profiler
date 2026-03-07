import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="container max-w-4xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block h-2 w-2 rounded-full bg-chainlink" />
              <span className="font-mono text-sm font-bold">
                DeFi Strategy Profiler
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs">
              Trustless DeFi strategy simulation with on-chain proof. Powered by
              Chainlink CRE & Tenderly Virtual TestNets.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                Navigate
              </p>
              <div className="space-y-1.5">
                <Link
                  to="/"
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Home
                </Link>
                <Link
                  to="/how-it-works"
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  How It Works
                </Link>
                <Link
                  to="/faq"
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  FAQ
                </Link>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                External
              </p>
              <div className="space-y-1.5">
                <a
                  href="https://github.com/0xEunum/defi-strategy-profiler"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  GitHub ↗
                </a>
                <a
                  href="https://sepolia.etherscan.io/address/0x6C60a2dEbD7a0406fB08133c44FC0bAeB2424e7d"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Registry ↗
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-chainlink" />
              Powered by Chainlink Runtime Environment
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-tenderly" />
              Powered by Tenderly Virtual TestNets
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 font-mono">
            MIT © 2026
          </p>
        </div>
      </div>
    </footer>
  );
}
