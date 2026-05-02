import { db, doc, getDoc } from './firebase.js';

let cachedWebhookUrl = null;

async function getWebhookUrl() {
  if (cachedWebhookUrl) return cachedWebhookUrl;
  try {
    const configDoc = await getDoc(doc(db, 'config', 'discord'));
    if (configDoc.exists()) {
      cachedWebhookUrl = configDoc.data().webhookUrl || null;
    }
  } catch (e) {
    console.error('Failed to load webhook config:', e);
  }
  return cachedWebhookUrl;
}

/**
 * Post a message to a Discord thread via webhook.
 * @param {string} threadId - Discord thread/channel ID
 * @param {string} content - Plain text message
 * @param {Array} [embeds] - Optional Discord embed objects
 * @returns {Promise<boolean>} - true if sent successfully
 */
export async function postToDiscord(threadId, content, embeds = []) {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) return false;

  const url = threadId ? `${webhookUrl}?thread_id=${threadId}` : webhookUrl;
  const body = { content };
  if (embeds.length) body.embeds = embeds;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Discord webhook failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('Discord webhook error:', e);
    return false;
  }
}

/**
 * Clear the cached webhook URL (call when admin updates it).
 */
export function clearWebhookCache() {
  cachedWebhookUrl = null;
}

// --- Pre-built message helpers ---

export function battleCreatedMessage(teamAName, teamBName, banpickUrl) {
  return `\u2694\uFE0F **Team Battle Created:** ${teamAName} vs ${teamBName}\n\uD83D\uDDFA\uFE0F Ban/Pick: ${banpickUrl}`;
}

export function banpickCompleteMessage(teamAName, teamBName, maps) {
  const mapList = maps.map((m, i) => `Map ${i + 1}: **${m.mapName}** (${m.type.replace('_', ' ').replace('home a', teamAName + ' Home').replace('home b', teamBName + ' Home').replace('decider', 'Decider')})`).join(' | ');
  return `\uD83D\uDDFA\uFE0F **Maps Selected:** ${mapList}`;
}

export function raceResultMessage(mapName, raceType, winnerName) {
  const emoji = raceType === 'tiebreaker' ? '\u26A1' : '\uD83C\uDFD4\uFE0F';
  const label = raceType.charAt(0).toUpperCase() + raceType.slice(1);
  return `${emoji} **${mapName} ${label}:** ${winnerName} wins!`;
}

export function mapWinnerMessage(mapNum, mapName, winnerName, scoreA, scoreB, teamAName, teamBName) {
  return `\uD83C\uDFC1 **Map ${mapNum} \u2014 ${mapName}:** ${winnerName} takes it! (Score: ${teamAName} ${scoreA} \u2014 ${scoreB} ${teamBName})`;
}

export function matchFinalizedMessage(winnerName, loserName, scoreA, scoreB, teamAName, teamBName, winnerCRP, loserCRP) {
  return `\uD83C\uDFC6 **MATCH COMPLETE:** ${winnerName} defeats ${loserName} ${teamAName === winnerName ? scoreA : scoreB}\u2014${teamAName === winnerName ? scoreB : scoreA}! (+${winnerCRP} CRP)`;
}

export function declineFinalizedMessage(challengerName, declinerName, challengerCRP, declinerCRP, newChallengerPos) {
  return `\uD83D\uDEA9 **${declinerName}** declined the challenge from **${challengerName}**. ${challengerName} moves to #${newChallengerPos}. CRP: +${challengerCRP} / +${declinerCRP}.`;
}
