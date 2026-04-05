import { ephemeralMessage, getOption } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

export async function handleCreateTeam(interaction, env) {
  const name = getOption(interaction, 'name');
  const tag = (getOption(interaction, 'tag') || '').toUpperCase();
  const invokerId = interaction.member.user.id;
  const guildId = interaction.guild_id;

  if (!name || !tag) {
    return ephemeralMessage('Team name and tag are required.');
  }
  if (tag.length > 8) {
    return ephemeralMessage('Tag must be 8 characters or less.');
  }

  const db = createFirestoreClient(env);

  // 1. Check staff permission
  const staffResults = await db.queryCollection('staff', 'discordId', 'EQUAL', invokerId);
  if (staffResults.length === 0) {
    return ephemeralMessage('You do not have staff permissions to use this command.');
  }

  // 2. Check if team tag already exists
  const existing = await db.queryCollection('teams', 'tag', 'EQUAL', tag);
  if (existing.length > 0) {
    return ephemeralMessage(`A team with tag **${tag}** already exists.`);
  }

  // 3. Create or find Discord role
  let roleId;
  try {
    // Check if a role with this name already exists
    const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    });
    if (!rolesRes.ok) throw new Error(`Failed to fetch roles: ${rolesRes.status}`);
    const roles = await rolesRes.json();
    const existingRole = roles.find(r => r.name.toLowerCase() === name.toLowerCase());

    if (existingRole) {
      roleId = existingRole.id;
    } else {
      // Create new role
      const createRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, mentionable: true }),
      });
      if (!createRes.ok) throw new Error(`Failed to create role: ${createRes.status}`);
      const newRole = await createRes.json();
      roleId = newRole.id;
    }
  } catch (e) {
    console.error('Discord role creation failed:', e);
    return ephemeralMessage(`Failed to create Discord role: ${e.message}`);
  }

  // 4. Get current standings count for position
  const allStandings = await db.listDocuments('standings');
  const nextPosition = allStandings.length + 1;

  // 5. Create team + standings atomically
  const id = tag.toLowerCase();
  await db.batchWrite([
    db.buildUpdate('teams', id, {
      name, tag, captainDiscordId: '', active: true,
      discordRoleId: roleId,
      roster: [], createdAt: Date.now(),
    }),
    db.buildUpdate('standings', id, {
      teamName: name, teamTag: tag,
      wins: 0, losses: 0, mapWins: 0, mapLosses: 0, winRate: 0,
      streak: 0, rank: nextPosition,
      crp: 0, position: nextPosition, consecutive_wins: 0,
      roster: [], match_history: [], lastMatchDate: null,
    }),
  ]);

  return ephemeralMessage(
    `Created team **[${tag}] ${name}** at position #${nextPosition} with Discord role <@&${roleId}>.`
  );
}
