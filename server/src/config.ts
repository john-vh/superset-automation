import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = path.resolve(serverDir, '..');

for (const candidate of [path.join(repoRoot, '.env'), path.join(serverDir, '.env')]) {
  if (existsSync(candidate)) dotenv.config({ path: candidate, quiet: true });
}

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_PATH: z.string().default(path.join(repoRoot, 'data', 'board.sqlite')),

  GITHUB_REPO: z.string().default('john-vh/superset'),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_API_BASE: z.string().default('https://api.github.com'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  DEVIN_API_BASE: z.string().default('https://api.devin.ai'),
  DEVIN_API_KEY: z.string().optional(),
  DEVIN_ORG_ID: z.string().optional(),
  DEVIN_PLAYBOOK_ID: z.string().optional(),
  DEVIN_MAX_ACU: z.coerce.number().optional(),
  /** Price of one ACU, used for the cost estimate on the board. */
  ACU_RATE_USD: z.coerce.number().default(2.25),

  /** Public base URL Devin sessions call back to (a tunnel when running locally). */
  APP_BASE_URL: z.string().default('http://localhost:8787'),
  CALLBACK_TOKEN: z.string().default('local-dev-callback-token'),

  ISSUE_SYNC_INTERVAL_MS: z.coerce.number().default(60_000),
  SESSION_POLL_INTERVAL_MS: z.coerce.number().default(10_000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
}

export const config = parsed.data;

export const githubRepo = (() => {
  const [owner, name] = config.GITHUB_REPO.split('/');
  if (!owner || !name) throw new Error(`GITHUB_REPO must be "owner/name", got "${config.GITHUB_REPO}"`);
  return { owner, name, fullName: `${owner}/${name}` };
})();

export const devinConfigured = Boolean(config.DEVIN_API_KEY && config.DEVIN_ORG_ID);
export const githubConfigured = Boolean(config.GITHUB_TOKEN);
