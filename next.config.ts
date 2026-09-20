import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client'],
  agentRules: false,
  outputFileTracingIncludes: { '/**': ['./local.db'] },
};

export default nextConfig;
