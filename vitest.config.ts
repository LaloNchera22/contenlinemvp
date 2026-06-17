import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Resolvemos el alias '@' igual que tsconfig (paths) para poder importar y
  // mockear módulos por su ruta '@/lib/...' / '@/app/...' en los tests.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // contracts.test.ts corre con Hardhat (npm run hardhat:test), no con Vitest.
    include: ['test/**/*.test.ts'],
    exclude: ['test/contracts.test.ts', 'node_modules/**'],
    // Variables que los módulos bajo prueba leen al importarse (chain, contracts,
    // admin client). Son placeholders: ningún test toca servicios reales.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service',
      SUPABASE_JWT_SECRET: 'test-secret-test-secret-test-secret-256bits',
      NEXT_PUBLIC_CHAIN_ID: '137',
      NEXT_PUBLIC_CONTRACT_SUBSCRIPTION: '0x0000000000000000000000000000000000000001',
      NEXT_PUBLIC_CONTRACT_PAYMENT: '0x0000000000000000000000000000000000000002',
      NEXT_PUBLIC_USDC_POLYGON: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      POLYGON_RPC_URL: 'https://polygon-rpc.com',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Solo medimos lo testeable por unidad: lib/ y las API routes. Excluimos los
      // módulos puramente de cliente (hooks de wagmi, provider del browser) y los
      // wrappers de Supabase que dependen de next/headers — requieren entorno de
      // navegador/e2e y falsearían la cobertura unitaria.
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      exclude: [
        'lib/wagmi.ts',
        'lib/useSiweAuth.ts',
        'lib/useAuthSync.ts',
        'lib/supabase/client.ts',
        'lib/supabase/server.ts',
        'lib/auth.ts',
      ],
      thresholds: {
        'lib/**': { statements: 60, branches: 60, functions: 60, lines: 60 },
        'app/api/**': { statements: 50, branches: 50, functions: 50, lines: 50 },
      },
    },
  },
});
