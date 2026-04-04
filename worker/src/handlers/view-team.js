import { ephemeralMessage, getOption } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

function getTier(pos) {
  if (pos == null) return 'Unranked';
  if (pos >= 1 && pos <= 5) return 'Adept';
  if (pos >= 6 && pos <= 10) return 'Proficient';
  if (pos >= 11 && pos <= 15) return 'Intermediate';
  return 'Novice';
}

export async function handleViewTeam(interaction, env) {
  const tag = getOption(interaction, 'team_tag').toUpperCase();

  const db = createFirestoreClient(env);

  const teamResults = await db.queryCollection('teams', 'tag', 'EQUAL', tag);
  if (teamResults.length === 0) {
    return ephemeralMessage(`No team found with tag **${tag}**.`);
  }
  const team = teamResults[0];

  const standing = await db.getDocument('standings', team.id);
  if (!standing) {
    return ephemeralMessage(`No standings data found for **[${tag}] ${team.name}**.`);
  }

  const pos = standing.position;
  const tier = getTier(pos);
  const posStr = pos != null ? `#${pos}` : 'Unranked';
  const wins = standing.wins || 0;
  const losses = standing.losses || 0;
  const winRate = standing.winRate || 0;
  const crp = standing.crp || 0;
  const streak = standing.streak || 0;
  const streakStr = streak > 0 ? `W${streak}` : streak < 0 ? `L${Math.abs(streak)}` : 'None';

  const roster = standing.roster || [];
  const rosterLines = roster.length > 0
    ? roster.map(d => `• ${d.name} — ${d.car || '?'}`).join('\n')
    : '• No drivers';

  const msg = [
    `**[${standing.teamTag}] ${standing.teamName}** — ${posStr} ${tier}`,
    `Record: ${wins}W ${losses}L (${winRate}%) — ${crp} CRP`,
    `Streak: ${streakStr}`,
    '',
    `**Roster (${roster.length}):**`,
    rosterLines,
  ].join('\n');

  return ephemeralMessage(msg);
}
