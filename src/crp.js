/**
 * CRP (Competition Rating Points) Calculation Engine
 *
 * Pure utility module -- no DOM or Firebase dependencies.
 */

// ---------------------------------------------------------------------------
// Tier helpers
// ---------------------------------------------------------------------------

/**
 * Returns a division label based on ladder position.
 * @param {number|null} pos - Ladder position (1-based), or null for unranked.
 * @returns {string}
 */
export function getTier(pos) {
  if (pos == null) return "Unranked";
  if (pos >= 1 && pos <= 5) return "Elite";
  if (pos >= 6 && pos <= 10) return "Division 1";
  if (pos >= 11 && pos <= 15) return "Division 2";
  return "Division 3";
}

/**
 * CSS-safe slug of the division label (spaces stripped).
 * Used to build class names like `tier-Division1`.
 * @param {number|null} pos
 * @returns {string}
 */
export function getTierClass(pos) {
  return getTier(pos).replace(/\s+/g, "");
}

/**
 * Whether `challengerPos` may issue a challenge against `declinerPos`.
 * Rule: same division, and decliner ranked above challenger (lower position number).
 * @param {number|null} challengerPos
 * @param {number|null} declinerPos
 * @returns {boolean}
 */
export function canChallenge(challengerPos, declinerPos) {
  if (challengerPos == null || declinerPos == null) return false;
  if (declinerPos >= challengerPos) return false;
  return getTier(challengerPos) === getTier(declinerPos);
}

// ---------------------------------------------------------------------------
// Position-based CRP value tables
// ---------------------------------------------------------------------------

export const POS_RULES = {
  1:  { win: 32, loss: 16, home: 7, streak: 12, format: "BO5" },
  2:  { win: 27, loss: 13,  home: 6, streak: 12, format: "BO5" },
  3:  { win: 22, loss: 10,  home: 6, streak: 12, format: "BO5" },
  4:  { win: 17, loss: 7,  home: 5, streak: 12, format: "BO5" },
  5:  { win: 15, loss: 5,  home: 5, streak: 12, format: "BO5" },
  6:  { win: 10,  loss: 4,  home: 4, streak: 8,  format: "BO3" },
  7:  { win: 7,  loss: 2,  home: 3, streak: 8,  format: "BO3" },
  8:  { win: 7,  loss: 2,  home: 3, streak: 8,  format: "BO3" },
  9:  { win: 7,  loss: 2,  home: 3, streak: 8,  format: "BO3" },
  10: { win: 5,  loss: 2,  home: 3, streak: 8,  format: "BO3" },
  11: { win: 5,  loss: 2,  home: 3, streak: 5,  format: "BO3" },
  12: { win: 4,  loss: 1,  home: 2, streak: 5,  format: "BO3" },
  13: { win: 4,  loss: 1,  home: 2, streak: 5,  format: "BO3" },
  14: { win: 4,  loss: 1,  home: 2, streak: 5,  format: "BO3" },
  15: { win: 4,  loss: 1,  home: 2, streak: 5,  format: "BO3" },
  16: { win: 3,  loss: 1,  home: 2, streak: 4,  format: "BO3" }
};

export const DIVISION3_RULES = { win: 2, loss: 1, home: 2, streak: 4, format: "BO3" };

// ---------------------------------------------------------------------------
// Rule look-up
// ---------------------------------------------------------------------------

/**
 * Returns the CRP rules object for the given ladder position.
 * Falls back to DIVISION3_RULES for positions outside POS_RULES.
 * @param {number|null} pos
 * @returns {{ win: number, loss: number, home: number, streak: number, format: string }}
 */
export function getRules(pos) {
  if (pos != null && POS_RULES[pos]) {
    return POS_RULES[pos];
  }
  return DIVISION3_RULES;
}

// ---------------------------------------------------------------------------
// Main CRP calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the CRP awarded after a match.
 *
 * Each team's points are derived from the *opponent's* position rules:
 *   - Winner receives the loser's "win" value.
 *   - Loser receives the winner's "loss" value.
 *
 * Home bonus: each team uses the opponent's "home" value if they held home
 * advantage during the match.
 *
 * Streak bonus: every 4th consecutive win, the winner receives their own
 * position's "streak" value (not the opponent's).
 *
 * @param {{ position: number|null, consecutive_wins: number }} winner
 * @param {{ position: number|null, consecutive_wins: number }} loser
 * @param {'winner'|'loser'|'both'|'none'} homeFor - Which side held home advantage.
 * @returns {{
 *   winnerTotal: number,
 *   loserTotal: number,
 *   winnerBase: number,
 *   loserBase: number,
 *   winnerHome: number,
 *   loserHome: number,
 *   streakBonus: number,
 *   newStreak: number,
 *   winnerRules: object,
 *   loserRules: object,
 * }}
 */
export function calcCRP(winner, loser, homeFor) {
  const winnerRules = getRules(winner.position);
  const loserRules = getRules(loser.position);

  // Base CRP -- derived from the *opponent's* rules
  const winnerBase = loserRules.win;
  const loserBase = winnerRules.loss;

  // Home bonus -- winner earns the loser's home value only if they beat the
  // loser on the loser's home map. Losers never earn a home bonus.
  let winnerHome = 0;
  const loserHome = 0;

  if (homeFor === "loser" || homeFor === "both") {
    winnerHome = loserRules.home;
  }

  // Streak bonus -- every 4th consecutive win for the winner
  const newStreak = (winner.consecutive_wins || 0) + 1;
  const streakBonus = newStreak % 4 === 0 ? winnerRules.streak : 0;

  // Totals
  const winnerTotal = winnerBase + winnerHome + streakBonus;
  const loserTotal = loserBase + loserHome;

  return {
    winnerTotal,
    loserTotal,
    winnerBase,
    loserBase,
    winnerHome,
    loserHome,
    streakBonus,
    newStreak,
    winnerRules,
    loserRules,
  };
}

// ---------------------------------------------------------------------------
// Decline CRP
// ---------------------------------------------------------------------------

/**
 * CRP for a challenge-decline. Both teams get 50% of the relevant base value
 * (rounded to nearest integer). No home bonus, no streak bonus.
 *
 * @param {{ position: number|null }} challenger - lower-ranked team (the one moving up)
 * @param {{ position: number|null }} decliner   - higher-ranked team (the one declining)
 */
export function calcDeclineCRP(challenger, decliner) {
  const challengerRules = getRules(challenger.position);
  const declinerRules = getRules(decliner.position);
  const challengerTotal = Math.round(declinerRules.win * 0.5);
  const declinerTotal = Math.round(challengerRules.loss * 0.5);
  return {
    challengerTotal,
    declinerTotal,
    challengerBase: challengerTotal,
    declinerBase: declinerTotal,
    challengerRules,
    declinerRules,
  };
}
