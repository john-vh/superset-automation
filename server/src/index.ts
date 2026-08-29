import { createApp } from './app.js';
import { config, devinConfigured, githubConfigured, githubRepo } from './config.js';
import { db } from './db/index.js';
import { startIssueSyncWorker } from './services/issueSync.js';
import { startSessionPoller } from './services/sessionPoller.js';

db();

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`[server] listening on http://localhost:${config.PORT} (repo ${githubRepo.fullName})`);
  if (!githubConfigured) console.warn('[server] GITHUB_TOKEN missing — issue sync and CI tracking are disabled');
  if (!devinConfigured) console.warn('[server] DEVIN_API_KEY/DEVIN_ORG_ID missing — dispatch is disabled');
  if (!config.GITHUB_WEBHOOK_SECRET) console.warn('[server] GITHUB_WEBHOOK_SECRET missing — webhooks are unverified');

  startIssueSyncWorker();
  startSessionPoller();
});
