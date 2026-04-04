import { ephemeralMessage } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

export async function handleStandings(interaction, env) {
  const db = createFirestoreClient(env);

  const all = await db.listDocuments('standings');

  const ranked = all
    .filter(t => t.position != null)
    .sort((a, b) => a.position - b.position);

  const unranked = all.filter(t => t.position == null);

  if (ranked.length === 0 && unranked.length === 0) {
    return ephemeralMessage('No teams in standings yet.');
  }

  const lines = ['**Team Battle Standings**', ''];

  for (const t of ranked) {
    const pos = String(t.position).padStart(2, ' ');
    const wins = t.wins || 0;
    const losses = t.losses || 0;
    const crp = t.crp || 0;
    lines.push(`\`#${pos}\` **[${t.teamTag}] ${t.teamName}** — ${wins}W ${losses}L — ${crp} CRP`);
  }

  if (unranked.length > 0) {
    lines.push('', '── Unranked ──');
    for (const t of unranked) {
      const wins = t.wins || 0;
      const losses = t.losses || 0;
      const crp = t.crp || 0;
      lines.push(`**[${t.teamTag}] ${t.teamName}** — ${wins}W ${losses}L — ${crp} CRP`);
    }
  }

  return ephemeralMessage(lines.join('\n'));
}
