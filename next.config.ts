import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The SQLite driver ships native bindings; keep it out of the server bundle.
  serverExternalPackages: ['@libsql/client'],
  // Don't auto-generate AGENTS.md / CLAUDE.md in the repo root on `next dev`.
  agentRules: false,
};

export default nextConfig;
