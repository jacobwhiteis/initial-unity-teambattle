/**
 * Match finalization module -- shared by admin quick-log and battle flows.
 *
 * Calculates CRP, updates standings, handles position swaps, and writes the
 * completed match document to Firestore in a single atomic batch.
 */

import { doc, collection, writeBatch, Timestamp, updateDoc } from './firebase.js';
import { calcCRP, calcDeclineCRP, getRules } from './crp.js';

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
      home_map_bonus: homeFor === 'loser' || homeFor === 'both',
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
      home_map_bonus: false,
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

/**
 * Finalize a challenge-decline. Half-CRP, no bonuses, forced position swap,
 * W/L incremented but streak counters frozen on both sides.
 *
 * Caller must validate strict adjacency (challenger.position === decliner.position + 1)
 * before calling this.
 *
 * @param {object} db
 * @param {{ challengerId: string, declinerId: string,
 *           challengerName: string, declinerName: string,
 *           recordedBy: string }} params
 * @param {object} challengerStanding - lower-ranked team's standings doc
 * @param {object} declinerStanding   - higher-ranked team's standings doc
 * @returns {Promise<{challengerCRP: number, declinerCRP: number,
 *                    newChallengerPos: number, newDeclinerPos: number}>}
 */
export async function finalizeDecline(db, params, challengerStanding, declinerStanding) {
  const { challengerId, declinerId, challengerName, declinerName, recordedBy } = params;

  const c = calcDeclineCRP(challengerStanding, declinerStanding);
  const now = Timestamp.now();
  const batch = writeBatch(db);

  // Match doc — type='decline' so it's distinguishable from real matches
  const matchRef = doc(collection(db, 'matches'));
  batch.set(matchRef, {
    teamA: challengerId,
    teamB: declinerId,
    teamAName: challengerName,
    teamBName: declinerName,
    format: 'DECLINE',
    status: 'completed',
    type: 'decline',
    winner: challengerId,
    score: { teamA: 0, teamB: 0 },
    maps: [],
    mapResults: [],
    date: now,
    finalizedAt: now,
    recordedBy,
    notes: 'Challenge declined',
  });

  // Position swap — adjacency was validated upstream, so just swap the two slots.
  const cPos = challengerStanding.position;
  const dPos = declinerStanding.position;
  const newChallengerPos = dPos;
  const newDeclinerPos = dPos + 1;

  // Challenger: W++, CRP+, position swap, streak counters UNCHANGED, mapWins UNCHANGED.
  const challengerWins = (challengerStanding.wins || 0) + 1;
  const challengerLosses = challengerStanding.losses || 0;
  const challengerHistory = [
    {
      opponent: declinerName,
      result: 'Win (Decline)',
      crp_gained: c.challengerTotal,
      home_map_bonus: false,
      streak_bonus: 0,
      pos_before: cPos,
      pos_after: newChallengerPos,
      timestamp: now,
    },
    ...(challengerStanding.match_history || []),
  ].slice(0, 50);

  batch.update(doc(db, 'standings', challengerId), {
    crp: (challengerStanding.crp || 0) + c.challengerTotal,
    wins: challengerWins,
    winRate: Math.round((challengerWins / (challengerWins + challengerLosses)) * 100),
    position: newChallengerPos,
    rank: newChallengerPos,
    match_history: challengerHistory,
    lastMatchDate: now,
  });

  // Decliner: L++, CRP+, position swap, streak counters UNCHANGED, mapLosses UNCHANGED.
  const declinerWins = declinerStanding.wins || 0;
  const declinerLosses = (declinerStanding.losses || 0) + 1;
  const declinerHistory = [
    {
      opponent: challengerName,
      result: 'Loss (Decline)',
      crp_gained: c.declinerTotal,
      home_map_bonus: false,
      streak_bonus: 0,
      pos_before: dPos,
      pos_after: newDeclinerPos,
      timestamp: now,
    },
    ...(declinerStanding.match_history || []),
  ].slice(0, 50);

  // Decline ends a winstreak: reset consecutive_wins, flip/extend streak into a loss streak.
  const declinerNewStreak = (declinerStanding.streak < 0 ? declinerStanding.streak - 1 : -1);

  batch.update(doc(db, 'standings', declinerId), {
    crp: (declinerStanding.crp || 0) + c.declinerTotal,
    losses: declinerLosses,
    consecutive_wins: 0,
    streak: declinerNewStreak,
    winRate: Math.round((declinerWins / (declinerWins + declinerLosses)) * 100),
    position: newDeclinerPos,
    rank: newDeclinerPos,
    match_history: declinerHistory,
    lastMatchDate: now,
  });

  await batch.commit();

  return {
    challengerCRP: c.challengerTotal,
    declinerCRP: c.declinerTotal,
    newChallengerPos,
    newDeclinerPos,
  };
}
