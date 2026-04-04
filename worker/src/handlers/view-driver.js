import { ephemeralMessage, getOption } from '../lib/discord.js';
import { createFirestoreClient } from '../lib/firestore.js';

function getTier(pos) {
  if (pos == null) return 'Unranked';
  if (pos >= 1 && pos <= 5) return 'Adept';
  if (pos >= 6 && pos <= 10) return 'Proficient';
  if (pos >= 11 && pos <= 15) return 'Intermediate';
  return 'Novice';
}

export async function handleViewDriver(interaction, env) {
  const playerId = getOption(interaction, 'player');

  const db = createFirestoreClient(env);

  // Try drivers collection first
  let driverDoc = await db.getDocument('drivers', playerId);

  // Fallback: scan teams for legacy drivers not yet in drivers collection
  if (!driverDoc) {
    const allTeams = await db.listDocuments('teams');
    for (const t of allTeams) {
      const roster = t.roster || [];
      const found = roster.find(d => d.discordId === playerId);
      if (found) {
        driverDoc = { name: found.name, car: found.car, teamId: t.id, teamTag: t.tag, teamName: t.name };
        // Self-heal: create the drivers doc for future lookups
        await db.batchWrite([
          db.buildUpdate('drivers', playerId, driverDoc),
        ]);
        break;
      }
    }
  }

  if (!driverDoc) {
    return ephemeralMessage(`<@${playerId}> is not on any team's roster.`);
  }

  const standing = await db.getDocument('standings', driverDoc.teamId);
  const pos = standing?.position;
  const tier = getTier(pos);
  const posStr = pos != null ? `#${pos}` : 'Unranked';
  const wins = standing?.wins || 0;
  const losses = standing?.losses || 0;
  const winRate = standing?.winRate || 0;
  const crp = standing?.crp || 0;

  const msg = [
    `**${driverDoc.name}** — ${driverDoc.car || '?'}`,
    `Team: [${driverDoc.teamTag}] ${driverDoc.teamName} (${posStr} ${tier})`,
    `Team Record: ${wins}W ${losses}L (${winRate}%) — ${crp} CRP`,
  ].join('\n');

  return ephemeralMessage(msg);
}
