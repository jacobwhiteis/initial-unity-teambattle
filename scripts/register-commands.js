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
      { name: 'team', description: 'Team role (e.g. @MTD)', type: 8, required: true },
      { name: 'player', description: 'Discord user to add', type: 6, required: true },
      { name: 'display_name', description: "Player's display name for the roster", type: 3, required: true },
      { name: 'car', description: "Player's car (e.g. AE86, FD3S)", type: 3, required: true, choices: [
        { name: 'AE86', value: 'AE86' }, { name: 'FD3S', value: 'FD3S' }, { name: 'RPS13', value: 'RPS13' },
        { name: 'BNR32', value: 'BNR32' }, { name: 'CE9A', value: 'CE9A' }, { name: 'EG6', value: 'EG6' },
        { name: 'SW20', value: 'SW20' }, { name: 'FC3S', value: 'FC3S' }, { name: 'AP1', value: 'AP1' },
        { name: 'NA6CE', value: 'NA6CE' }, { name: 'NA1', value: 'NA1' }, { name: 'GC8F', value: 'GC8F' },
        { name: 'DC2', value: 'DC2' }, { name: 'JZA80', value: 'JZA80' }, { name: 'S14', value: 'S14' },
        { name: 'ZZW30', value: 'ZZW30' }, { name: 'EA11R', value: 'EA11R' }, { name: 'CN9A', value: 'CN9A' },
      ]},
    ],
  },
  {
    name: 'remove-team-driver',
    description: 'Remove a Discord user from a team roster',
    options: [
      { name: 'team', description: 'Team role (e.g. @MTD)', type: 8, required: true },
      { name: 'player', description: 'Discord user to remove', type: 6, required: true },
    ],
  },
  {
    name: 'change-car',
    description: "Change a driver's car",
    options: [
      { name: 'player', description: 'Discord user to update', type: 6, required: true },
      { name: 'car', description: 'New car', type: 3, required: true, choices: [
        { name: 'AE86', value: 'AE86' }, { name: 'FD3S', value: 'FD3S' }, { name: 'RPS13', value: 'RPS13' },
        { name: 'BNR32', value: 'BNR32' }, { name: 'CE9A', value: 'CE9A' }, { name: 'EG6', value: 'EG6' },
        { name: 'SW20', value: 'SW20' }, { name: 'FC3S', value: 'FC3S' }, { name: 'AP1', value: 'AP1' },
        { name: 'NA6CE', value: 'NA6CE' }, { name: 'NA1', value: 'NA1' }, { name: 'GC8F', value: 'GC8F' },
        { name: 'DC2', value: 'DC2' }, { name: 'JZA80', value: 'JZA80' }, { name: 'S14', value: 'S14' },
        { name: 'ZZW30', value: 'ZZW30' }, { name: 'EA11R', value: 'EA11R' }, { name: 'CN9A', value: 'CN9A' },
      ]},
    ],
  },
  {
    name: 'view-team',
    description: "View a team's info, roster, and record",
    options: [
      { name: 'team_tag', description: 'Team tag (e.g. MTD, AKG)', type: 3, required: true },
    ],
  },
  {
    name: 'view-driver',
    description: "View a driver's team and car",
    options: [
      { name: 'player', description: 'Discord user to look up', type: 6, required: true },
    ],
  },
  {
    name: 'standings',
    description: 'View the team battle standings',
  },
  {
    name: 'view-team-history',
    description: "View a team's match history",
    options: [
      { name: 'team_tag', description: 'Team tag (e.g. MTD, AKG)', type: 3, required: true },
    ],
  },
  {
    name: 'link-team',
    description: 'Link a Discord role to a team (staff only)',
    options: [
      { name: 'team', description: 'Team role (e.g. @MTD)', type: 8, required: true },
      { name: 'team_tag', description: 'Team tag (e.g. AAC, NS)', type: 3, required: true },
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
