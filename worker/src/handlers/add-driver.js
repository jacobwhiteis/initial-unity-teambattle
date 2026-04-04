import { ephemeralMessage, getOption } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

const MAX_ROSTER_SIZE = 6;

export async function handleAddDriver(interaction, env) {
  const tag = getOption(interaction, 'team_tag').toUpperCase();
  const playerId = getOption(interaction, 'player');
  const displayName = getOption(interaction, 'display_name');
  const invokerId = interaction.member.user.id;

  if (!displayName || displayName.trim().length === 0 || displayName.length > 32) {
    return ephemeralMessage('Display name must be 1-32 characters.');
  }

  const db = createFirestoreClient(env);

  // 1. Check staff permission
  const staffResults = await db.queryCollection('staff', 'discordId', 'EQUAL', invokerId);
  if (staffResults.length === 0) {
    return ephemeralMessage('You do not have staff permissions to use this command.');
  }

  // 2. Find team by tag (query by field, not doc ID, in case tag was edited)
  const teamResults = await db.queryCollection('teams', 'tag', 'EQUAL', tag);
  if (teamResults.length === 0) {
    return ephemeralMessage(`No team found with tag **${tag}**.`);
  }
  const team = teamResults[0];
  const teamId = team.id;

  const roster = team.roster || [];

  // 3. Check roster size
  if (roster.length >= MAX_ROSTER_SIZE) {
    return ephemeralMessage(
      `**[${team.tag}] ${team.name}** already has ${MAX_ROSTER_SIZE}/${MAX_ROSTER_SIZE} drivers.`
    );
  }

  // 4. Check if player is already on this team
  if (roster.some(d => d.discordId === playerId)) {
    return ephemeralMessage(`<@${playerId}> is already on **[${team.tag}] ${team.name}**.`);
  }

  // 5. Cross-team uniqueness check
  const allTeams = await db.listDocuments('teams');
  for (const t of allTeams) {
    if (t.id === teamId) continue;
    const tRoster = t.roster || [];
    if (tRoster.some(d => d.discordId === playerId)) {
      return ephemeralMessage(
        `<@${playerId}> is already on **[${t.tag}] ${t.name}**. Remove them first.`
      );
    }
  }

  // 6. Build new roster
  const newRoster = [...roster, { name: displayName, role: 'Member', discordId: playerId }];

  // 7. Atomic batch write to teams + standings
  await db.batchWrite([
    db.buildUpdate('teams', teamId, { roster: newRoster }),
    db.buildUpdate('standings', teamId, { roster: newRoster }),
  ]);

  return ephemeralMessage(
    `Added **${displayName}** (<@${playerId}>) to **[${team.tag}] ${team.name}** (${newRoster.length}/${MAX_ROSTER_SIZE} drivers).`
  );
}
