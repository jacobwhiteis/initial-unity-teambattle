import { ephemeralMessage, getOption, getResolvedRole } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

export async function handleCreateTeam(interaction, env) {
  const role = getResolvedRole(interaction, 'team');
  if (!role || !role.name) {
    return ephemeralMessage('Could not resolve the team role. Please select a valid role.');
  }
  const tag = (getOption(interaction, 'tag') || '').toUpperCase();
  const invokerId = interaction.member.user.id;

  if (!tag) {
    return ephemeralMessage('Team tag is required.');
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

  // 3. Check if role is already linked to another team
  const linkedTeam = await db.queryCollection('teams', 'discordRoleId', 'EQUAL', role.id);
  if (linkedTeam.length > 0) {
    return ephemeralMessage(`Role **${role.name}** is already linked to **[${linkedTeam[0].tag}] ${linkedTeam[0].name}**.`);
  }

  // 4. Get current standings count for position
  const allStandings = await db.listDocuments('standings');
  const nextPosition = allStandings.length + 1;

  // 5. Create team + standings atomically
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
      streak: 0, rank: nextPosition,
      crp: 0, position: nextPosition, consecutive_wins: 0,
      roster: [], match_history: [], lastMatchDate: null,
    }),
  ]);

  return ephemeralMessage(
    `Created team **[${tag}] ${name}** at position #${nextPosition} with role <@&${role.id}>.`
  );
}
