import { polygon, polygonMumbai } from 'viem/chains';

/**
 * Resuelve la cadena y el RPC a partir de NEXT_PUBLIC_CHAIN_ID.
 * Evita tener `polygon` hardcodeado en cada createPublicClient: cambiar de
 * mainnet a Mumbai (testnet) es solo cambiar la variable de entorno.
 *
 *  - 137   → Polygon mainnet  (POLYGON_RPC_URL)
 *  - 80001 → Polygon Mumbai   (POLYGON_MUMBAI_RPC_URL)
 */
export function getChain() {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '137');
  return chainId === 80001 ? polygonMumbai : polygon;
}

export function getRpcUrl(): string | undefined {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '137');
  return chainId === 80001
    ? process.env.POLYGON_MUMBAI_RPC_URL
    : process.env.POLYGON_RPC_URL;
}
