import { ephemeralMessage, getOption } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

export async function handleViewTeamHistory(interaction, env) {
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

  const history = standing.match_history || [];
  if (history.length === 0) {
    return ephemeralMessage(`**[${standing.teamTag}] ${standing.teamName}** has no matches played yet.`);
  }

  const total = history.length;
  const shown = history.slice(0, 10);

  const lines = [`**[${standing.teamTag}] ${standing.teamName}** — Match History`];
  if (total > 10) {
    lines.push(`Showing 10 of ${total} matches`);
  }
  lines.push('');

  for (const m of shown) {
    const result = m.result === 'Win' ? 'W' : 'L';
    const crp = m.crp_gained || 0;
    let line = `${result} vs ${m.opponent} — +${crp} CRP`;

    if (m.pos_before != null && m.pos_after != null) {
      line += ` (#${m.pos_before} → #${m.pos_after})`;
    }

    if (m.streak_bonus && m.streak_bonus > 0) {
      line += ` 🔥+${m.streak_bonus} streak`;
    }

    lines.push(line);
  }

  return ephemeralMessage(lines.join('\n'));
}
