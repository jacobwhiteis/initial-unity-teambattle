/**
 * Match finalization module -- shared by admin quick-log and battle flows.
 *
 * Calculates CRP, updates standings, handles position swaps, and writes the
 * completed match document to Firestore in a single atomic batch.
 */

import { doc, collection, writeBatch, Timestamp, updateDoc } from './firebase.js';
import { calcCRP, getRules } from './crp.js';

/**
 * Finalize a match: calculate CRP, update standings, handle position swaps.
 *
 * @param {object} db - Firestore database instance
 * @param {object} params
 * @param {string|null} params.matchId - ID of existing match doc to update (or null to create new)
 * @param {string} params.winnerId - team ID of the winner
 * @param {string} params.loserId - team ID of the loser
 * @param {string} params.winnerName - team name of winner
 * @param {string} params.loserName - team name of loser
 * @param {string} params.homeFor - 'winner'|'loser'|'both'|'none'
 * @param {object} params.score - { teamA: number, teamB: number }
 * @param {string} params.format - 'BO3'|'BO5'
 * @param {string} params.recordedBy - UID of staff who recorded
 * @param {string} [params.notes] - optional notes
 * @param {object} params.matchData - additional match doc fields to set/merge (e.g. maps, mapResults, banpickResult)
 * @param {object} winnerStanding - current standings doc for winner
 * @param {object} loserStanding - current standings doc for loser
 * @param {Array} allStandings - all standings docs (for position shift calculation)
 * @returns {Promise<{winnerCRP: number, loserCRP: number, positionShifted: boolean}>}
 */
export async function finalizeMatch(db, params, winnerStanding, loserStanding, allStandings) {
  const {
    matchId,
    winnerId,
    loserId,
    winnerName,
    loserName,
    homeFor,
    score,
    format,
    recordedBy,
    notes,
    matchData = {},
  } = params;

  // 1. CRP calculation
  const c = calcCRP(winnerStanding, loserStanding, homeFor);
  const now = Timestamp.now();

  // 2. Batch
  const batch = writeBatch(db);

  // 3/4. Match document
  if (matchId) {
    // Update existing match doc (battle flow)
    const matchRef = doc(db, 'matches', matchId);
    batch.update(matchRef, {
      status: 'completed',
      finalizedAt: now,
      winner: winnerId,
      score,
      ...matchData,
    });
  } else {
    // Create new match doc (quick-log flow)
    const matchRef = doc(collection(db, 'matches'));
    batch.set(matchRef, {
      teamA: winnerId,
      teamB: loserId,
      teamAName: winnerName,
      teamBName: loserName,
      format,
      status: 'completed',
      winner: winnerId,
      score,
      maps: [],
      date: now,
      recordedBy,
      notes: notes || '',
      ...matchData,
    });
  }

  // 5. Position shift logic
  const wPos = winnerStanding.position;
  const lPos = loserStanding.position;
  let newWinnerPos = wPos;
  let newLoserPos = lPos;
  let positionShifted = false;

  if (wPos != null && lPos != null && wPos > lPos) {
    // Lower-ranked beats higher-ranked: winner takes loser's position
    // Everyone between shifts down by 1
    positionShifted = true;
    allStandings.forEach(s => {
      if (s.id !== winnerId && s.position != null && s.position >= lPos && s.position < wPos) {
        const ref = doc(db, 'standings', s.id);
        batch.update(ref, { position: s.position + 1, rank: s.position + 1 });
      }
    });
    newWinnerPos = lPos;
    newLoserPos = lPos + 1; // loser shifts down 1
  }

  // 6. Winner standings update
  const winnerNewStreak = (winnerStanding.streak > 0 ? winnerStanding.streak + 1 : 1);
  const winnerWins = (winnerStanding.wins || 0) + 1;
  const winnerLosses = winnerStanding.losses || 0;
  const winnerHistory = [
    {
      opponent: loserName,
      result: 'Win',
      crp_gained: c.winnerTotal,
      home_map_bonus: homeFor === 'winner' || homeFor === 'both',
      streak_bonus: c.streakBonus,
      pos_before: wPos,
      pos_after: newWinnerPos,
      timestamp: now,
    },
    ...(winnerStanding.match_history || []),
  ].slice(0, 50);

  batch.update(doc(db, 'standings', winnerId), {
    crp: (winnerStanding.crp || 0) + c.winnerTotal,
    wins: winnerWins,
    consecutive_wins: (winnerStanding.consecutive_wins || 0) + 1,
    streak: winnerNewStreak,
    winRate: Math.round((winnerWins / (winnerWins + winnerLosses)) * 100),
    position: newWinnerPos,
    rank: newWinnerPos ?? winnerStanding.rank,
    match_history: winnerHistory,
    lastMatchDate: now,
    mapWins: (winnerStanding.mapWins || 0) + (score.teamA || 0) + (score.teamB || 0),
  });

  // 7. Loser standings update
  const loserNewStreak = (loserStanding.streak < 0 ? loserStanding.streak - 1 : -1);
  const loserWins = loserStanding.wins || 0;
  const loserLosses = (loserStanding.losses || 0) + 1;
  const loserHistory = [
    {
      opponent: winnerName,
      result: 'Loss',
      crp_gained: c.loserTotal,
      home_map_bonus: homeFor === 'loser' || homeFor === 'both',
      streak_bonus: 0,
      pos_before: lPos,
      pos_after: newLoserPos,
      timestamp: now,
    },
    ...(loserStanding.match_history || []),
  ].slice(0, 50);

  batch.update(doc(db, 'standings', loserId), {
    crp: (loserStanding.crp || 0) + c.loserTotal,
    losses: loserLosses,
    consecutive_wins: 0,
    streak: loserNewStreak,
    winRate: Math.round((loserWins / (loserWins + loserLosses)) * 100),
    position: newLoserPos,
    rank: newLoserPos ?? loserStanding.rank,
    match_history: loserHistory,
    lastMatchDate: now,
  });

  // 8. Commit
  await batch.commit();

  // 9. Return summary
  return {
    winnerCRP: c.winnerTotal,
    loserCRP: c.loserTotal,
    positionShifted,
  };
}
