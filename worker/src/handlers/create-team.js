import { createGuildRole, ephemeralMessage, getOption } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

export async function handleCreateTeam(interaction, env) {
  const tag = (getOption(interaction, 'tag') || '').toUpperCase();
  const roleName = (getOption(interaction, 'role_name') || '').trim();
  const invokerId = interaction.member.user.id;

  if (!tag) {
    return ephemeralMessage('Team tag is required.');
  }
  if (tag.length > 8) {
    return ephemeralMessage('Tag must be 8 characters or less.');
  }
  if (!roleName) {
    return ephemeralMessage('Role name is required.');
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

  // 3. Auto-create the Discord role
  const created = await createGuildRole(env, interaction.guild_id, roleName);
  if (!created || !created.id) {
    return ephemeralMessage('Failed to create the Discord role. Check the bot has Manage Roles permission.');
  }
  const role = { id: created.id, name: created.name };

  // 4. Create team + standings atomically (new teams start unranked)
  const name = role.name;
  const id = tag.toLowerCase();
  await db.batchWrite([
    db.buildUpdate('teams', id, {
      name, tag, captainDiscordId: '', active: true,
      discordRoleId: role.id,
      roster: [], createdAt: Date.now(),
    }),
    db.buildUpdate('standings', id, {
      teamName: name, teamTag: tag,
      wins: 0, losses: 0, mapWins: 0, mapLosses: 0, winRate: 0,
      streak: 0, rank: null,
      crp: 0, position: null, consecutive_wins: 0,
      roster: [], match_history: [], lastMatchDate: null,
    }),
  ]);

  return ephemeralMessage(
    `Created team **[${tag}] ${name}** (Unranked) with role <@&${role.id}>.`
  );
}
