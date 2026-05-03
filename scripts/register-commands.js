/**
 * Register Discord slash commands for the IU Team Battle bot.
 *
 * Usage:
 *   node scripts/register-commands.js --app-id <id> --token <bot-token>
 *   node scripts/register-commands.js -a <id> -t <bot-token>
 *
 * Or via env vars:
 *   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-commands.js
 *
 * CLI flags take precedence over env vars.
 */

import { ALL_COMMANDS as commands } from '../worker/src/commands.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eat = () => argv[++i];
    if (a === '--app-id' || a === '-a') out.appId = eat();
    else if (a === '--token' || a === '-t') out.token = eat();
    else if (a.startsWith('--app-id=')) out.appId = a.slice('--app-id='.length);
    else if (a.startsWith('--token=')) out.token = a.slice('--token='.length);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const APP_ID = args.appId || process.env.DISCORD_APP_ID;
const BOT_TOKEN = args.token || process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error('Missing app id or bot token.');
  console.error('Pass via flags: --app-id <id> --token <bot-token>');
  console.error('Or env: DISCORD_APP_ID=... DISCORD_BOT_TOKEN=...');
  process.exit(1);
}

async function registerCommands() {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

  for (const cmd of commands) {
    console.log(`Registering /${cmd.name}...`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cmd),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`  ✓ Registered (id: ${data.id})`);
    } else if (res.status === 429) {
      const data = JSON.parse(await res.text());
      const wait = Math.ceil((data.retry_after || 3) * 1000);
      console.log(`  ⏳ Rate limited, waiting ${wait}ms...`);
      await new Promise(r => setTimeout(r, wait));
      const retry = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
      });
      if (retry.ok) {
        const data = await retry.json();
        console.log(`  ✓ Registered on retry (id: ${data.id})`);
      } else {
        console.error(`  ✗ Retry failed: ${retry.status} ${await retry.text()}`);
      }
    } else {
      const err = await res.text();
      console.error(`  ✗ Failed: ${res.status} ${err}`);
    }
  }
}

registerCommands();
