import { ephemeralMessage, getOption, getResolvedRole, addRoleToMember } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

const MAX_ROSTER_SIZE = 6;
const VALID_CARS = [
  'AE86','FD3S','RPS13','BNR32','CE9A','EG6','SW20','FC3S',
  'AP1','NA6CE','NA1','GC8F','DC2','JZA80','S14','ZZW30','EA11R','CN9A'
];

export async function handleAddDriver(interaction, env) {
  const role = getResolvedRole(interaction, 'team');
  if (!role || !role.name) {
    return ephemeralMessage('Could not resolve the team role. Please select a valid role.');
  }
  const tag = role.name.toUpperCase();
  const playerId = getOption(interaction, 'player');
  const displayName = getOption(interaction, 'display_name');
  const car = (getOption(interaction, 'car') || '').toUpperCase();
  const invokerId = interaction.member.user.id;

  if (!displayName || displayName.trim().length === 0 || displayName.length > 32) {
    return ephemeralMessage('Display name must be 1-32 characters.');
  }

  if (!car || !VALID_CARS.includes(car)) {
    return ephemeralMessage(`Invalid car. Valid options: ${VALID_CARS.join(', ')}`);
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

  // 5. Cross-team uniqueness check via drivers collection
  const existingDriver = await db.getDocument('drivers', playerId);
  if (existingDriver) {
    return ephemeralMessage(
      `<@${playerId}> is already on **[${existingDriver.teamTag}] ${existingDriver.teamName}**. Remove them first.`
    );
  }

  // 6. Build new roster
  const newRoster = [...roster, { name: displayName, role: 'Member', discordId: playerId, car }];

  // 7. Atomic batch write to teams + standings + drivers
  await db.batchWrite([
    db.buildUpdate('teams', teamId, { roster: newRoster }),
    db.buildUpdate('standings', teamId, { roster: newRoster }),
    db.buildUpdate('drivers', playerId, { name: displayName, car, teamId, teamTag: team.tag, teamName: team.name }),
  ]);

  let roleWarning = '';
  try {
    const added = await addRoleToMember(env, interaction.guild_id, playerId, role.id);
    if (!added) roleWarning = '\n⚠️ Could not assign the Discord role. Please assign it manually.';
  } catch (e) {
    console.error('Failed to add Discord role:', e);
    roleWarning = '\n⚠️ Could not assign the Discord role. Please assign it manually.';
  }

  return ephemeralMessage(
    `Added **${displayName}** (<@${playerId}>) to **[${team.tag}] ${team.name}** (${newRoster.length}/${MAX_ROSTER_SIZE} drivers).${roleWarning}`
  );
}
