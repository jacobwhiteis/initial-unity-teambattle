import { ephemeralMessage, getOption, getResolvedRole, removeRoleFromMember } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

const MAX_ROSTER_SIZE = 8;

export async function handleRemoveDriver(interaction, env) {
  const role = getResolvedRole(interaction, 'team');
  if (!role || !role.name) {
    return ephemeralMessage('Could not resolve the team role. Please select a valid role.');
  }
  const tag = role.name.toUpperCase();
  const playerId = getOption(interaction, 'player');
  const invokerId = interaction.member.user.id;

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

  // 3. Find driver in roster
  const driver = roster.find(d => d.discordId === playerId);
  if (!driver) {
    return ephemeralMessage(`<@${playerId}> is not on **[${team.tag}] ${team.name}**'s roster.`);
  }

  // 4. Remove driver and batch write (teams + standings + drivers)
  const newRoster = roster.filter(d => d.discordId !== playerId);

  await db.batchWrite([
    db.buildUpdate('teams', teamId, { roster: newRoster }),
    db.buildUpdate('standings', teamId, { roster: newRoster }),
    db.buildDelete('drivers', playerId),
  ]);

  let roleWarning = '';
  try {
    const removed = await removeRoleFromMember(env, interaction.guild_id, playerId, role.id);
    if (!removed) roleWarning = '\n⚠️ Could not remove the Discord role. Please remove it manually.';
  } catch (e) {
    console.error('Failed to remove Discord role:', e);
    roleWarning = '\n⚠️ Could not remove the Discord role. Please remove it manually.';
  }

  return ephemeralMessage(
    `Removed **${driver.name}** (<@${playerId}>) from **[${team.tag}] ${team.name}** (${newRoster.length}/${MAX_ROSTER_SIZE} drivers).${roleWarning}`
  );
}
