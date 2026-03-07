// Well-known ERC-20 token metadata for display purposes
export interface TokenMeta {
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

const TOKENS: Record<string, TokenMeta> = {
  // Mainnet addresses (strategies run on mainnet fork)
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", name: "USD Coin", decimals: 6 },
  "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", name: "Tether USD", decimals: 6 },
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": { symbol: "WBTC", name: "Wrapped BTC", decimals: 8 },
  "0x514910771af9ca656af840dff83e8264ecf986ca": { symbol: "LINK", name: "Chainlink", decimals: 18 },
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": { symbol: "UNI", name: "Uniswap", decimals: 18 },
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": { symbol: "AAVE", name: "Aave", decimals: 18 },
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function getTokenMeta(address: string): TokenMeta | null {
  if (!address || address === ZERO_ADDRESS) return null;
  return TOKENS[address.toLowerCase()] || null;
}

export function formatTokenAmount(raw: bigint, decimals: number): string {
  if (raw === 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0");
  // Show up to 6 significant decimal places
  const trimmed = fractionStr.slice(0, 6).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

export function getTokenLabel(address: string): string {
  const meta = getTokenMeta(address);
  return meta ? meta.symbol : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// Rough USD price estimates for gas display (hardcoded for demo)
const ETH_USD_PRICE = 2500;

export function ethToUsd(ethAmount: number): string {
  return (ethAmount * ETH_USD_PRICE).toFixed(2);
}

export function weiToUsd(wei: bigint): string {
  const ethVal = Number(wei) / 1e18;
  return ethToUsd(ethVal);
}
