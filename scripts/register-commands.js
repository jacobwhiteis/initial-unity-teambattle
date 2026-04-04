/**
 * Register Discord slash commands for the IU Team Battle bot.
 *
 * Usage:
 *   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-commands.js
 *
 * Or set these in a .env file (not committed) and use dotenv.
 */

const APP_ID = process.env.DISCORD_APP_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error('Set DISCORD_APP_ID and DISCORD_BOT_TOKEN environment variables.');
  process.exit(1);
}

const commands = [
  {
    name: 'add-team-driver',
    description: 'Add a Discord user to a team roster',
    options: [
      { name: 'team_tag', description: 'Team tag (e.g. MTD, AKG)', type: 3, required: true },
      { name: 'player', description: 'Discord user to add', type: 6, required: true },
      { name: 'display_name', description: "Player's display name for the roster", type: 3, required: true },
    ],
  },
  {
    name: 'remove-team-driver',
    description: 'Remove a Discord user from a team roster',
    options: [
      { name: 'team_tag', description: 'Team tag (e.g. MTD, AKG)', type: 3, required: true },
      { name: 'player', description: 'Discord user to remove', type: 6, required: true },
    ],
  },
];

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
    } else {
      const err = await res.text();
      console.error(`  ✗ Failed: ${res.status} ${err}`);
    }
  }
}

registerCommands();
