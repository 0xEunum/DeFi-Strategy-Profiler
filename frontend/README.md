# Frontend

React + Vite frontend for the DeFi Strategy Profiler. Displays on-chain simulation reports stored by `SimulationRegistry` on Sepolia.

**Live:** https://defi-strategy-profiler.vercel.app/
**Demo:** https://youtu.be/F90Hq8e9ArA?si=ljiXZ2VMSBpUbdG1

---

## What it shows

Each simulation run is accessible at `/run/[runId]` and displays:

- Strategy name and contract address
- Token flow — amount in, amount out, effective exchange rate
- Gas used, gas price, total ETH cost
- Simulation status — Success or Reverted (with revert reason hash)
- Tenderly vNet explorer link for full transaction trace

---

## Stack

- **React 18** + **TypeScript**
- **Vite** — dev server and bundler
- **Tailwind CSS** + **shadcn/ui** — styling and components
- **wagmi / viem** — on-chain reads from `SimulationRegistry` on Sepolia

---

## Structure

```
frontend/
├── src/
│   ├── assets/         Static assets
│   ├── components/     UI components
│   ├── hooks/          Custom React hooks (contract reads)
│   ├── lib/            Utilities and ABI helpers
│   ├── pages/          Route-level page components
│   └── test/           Component and hook tests
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── vitest.config.ts
```

---

## Local Setup

```bash
# From repo root
cd frontend

npm install
npm run dev
```

Open http://localhost:8080 — navigate to `/run/[runId]` with a valid run ID from Sepolia.

---

## Deployment

The frontend is deployed on Vercel. To deploy your own:

1. Push the repo to GitHub
2. Import the project on [Vercel](https://vercel.com)
3. Set the root directory to `frontend`
4. Vercel auto-detects Vite — no extra config needed

Custom domain: Vercel dashboard → Project → Settings → Domains.
