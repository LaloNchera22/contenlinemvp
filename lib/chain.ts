import { polygon, polygonAmoy } from 'viem/chains';

/**
 * Resuelve la cadena y el RPC a partir de NEXT_PUBLIC_CHAIN_ID.
 * Evita tener `polygon` hardcodeado en cada createPublicClient: cambiar de
 * mainnet a Amoy (testnet) es solo cambiar la variable de entorno.
 *
 *  - 137   → Polygon mainnet     (POLYGON_RPC_URL)
 *  - 80002 → Polygon Amoy        (POLYGON_AMOY_RPC_URL)
 *
 * NOTA: la testnet Mumbai (80001) fue apagada por Polygon en abril de 2024;
 * Amoy es su reemplazo oficial. Cualquier referencia a Mumbai apuntaría a una
 * red muerta.
 */
export function getChain() {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '137');
  return chainId === 80002 ? polygonAmoy : polygon;
}

export function getRpcUrl(): string | undefined {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '137');
  return chainId === 80002
    ? process.env.POLYGON_AMOY_RPC_URL
    : process.env.POLYGON_RPC_URL;
}
