import { ephemeralMessage, getOption, getResolvedRole } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

export async function handleLinkTeam(interaction, env) {
  const role = getResolvedRole(interaction, 'team');
  if (!role || !role.name) {
    return ephemeralMessage('Could not resolve the team role. Please select a valid role.');
  }
  const tag = getOption(interaction, 'team_tag').toUpperCase();
  const invokerId = interaction.member.user.id;

  const db = createFirestoreClient(env);

  // 1. Check staff permission
  const staffResults = await db.queryCollection('staff', 'discordId', 'EQUAL', invokerId);
  if (staffResults.length === 0) {
    return ephemeralMessage('You do not have staff permissions to use this command.');
  }

  // 2. Find team by tag
  const teamResults = await db.queryCollection('teams', 'tag', 'EQUAL', tag);
  if (teamResults.length === 0) {
    return ephemeralMessage(`No team found with tag **${tag}**.`);
  }
  const team = teamResults[0];

  // 3. Check if another team already uses this role
  const existing = await db.queryCollection('teams', 'discordRoleId', 'EQUAL', role.id);
  if (existing.length > 0 && existing[0].id !== team.id) {
    return ephemeralMessage(`Role **${role.name}** is already linked to **[${existing[0].tag}] ${existing[0].name}**.`);
  }

  // 4. Save the discordRoleId on the team doc
  await db.batchWrite([
    db.buildUpdate('teams', team.id, { discordRoleId: role.id }),
  ]);

  return ephemeralMessage(`Linked role **${role.name}** to **[${team.tag}] ${team.name}**.`);
}
