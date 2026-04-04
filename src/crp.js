/**
 * CRP (Competition Rating Points) Calculation Engine
 *
 * Pure utility module -- no DOM or Firebase dependencies.
 * Ported from the PoC in league_interface.html.
 */

// ---------------------------------------------------------------------------
// Tier helpers
// ---------------------------------------------------------------------------

/**
 * Returns a tier label based on ladder position.
 * @param {number|null} pos - Ladder position (1-based), or null for unranked.
 * @returns {string}
 */
export function getTier(pos) {
  if (pos == null) return "Unranked";
  if (pos >= 1 && pos <= 5) return "Adept";
  if (pos >= 6 && pos <= 10) return "Proficient";
  if (pos >= 11 && pos <= 15) return "Intermediate";
  return "Novice";
}

// ---------------------------------------------------------------------------
// Position-based CRP value tables
// ---------------------------------------------------------------------------

export const POS_RULES = {
  1:  { win: 32, loss: 22, home: 8, streak: 12, format: "BO5" },
  2:  { win: 25, loss: 16, home: 6, streak: 12, format: "BO5" },
  3:  { win: 20, loss: 12, home: 6, streak: 12, format: "BO5" },
  4:  { win: 15, loss: 9,  home: 5, streak: 12, format: "BO5" },
  5:  { win: 10, loss: 7,  home: 4, streak: 12, format: "BO3" },
  6:  { win: 8,  loss: 5,  home: 4, streak: 8,  format: "BO3" },
  7:  { win: 6,  loss: 4,  home: 3, streak: 8,  format: "BO3" },
  8:  { win: 6,  loss: 4,  home: 3, streak: 8,  format: "BO3" },
  9:  { win: 6,  loss: 4,  home: 3, streak: 8,  format: "BO3" },
  10: { win: 5,  loss: 4,  home: 3, streak: 8,  format: "BO3" },
  11: { win: 4,  loss: 3,  home: 3, streak: 6,  format: "BO3" },
  12: { win: 3,  loss: 2,  home: 2, streak: 6,  format: "BO3" },
  13: { win: 3,  loss: 2,  home: 2, streak: 6,  format: "BO3" },
  14: { win: 3,  loss: 2,  home: 2, streak: 6,  format: "BO3" },
  15: { win: 3,  loss: 2,  home: 2, streak: 6,  format: "BO3" },
};

export const NOVICE_RULES = { win: 2, loss: 1, home: 2, streak: 4, format: "BO3" };

// ---------------------------------------------------------------------------
// Rule look-up
// ---------------------------------------------------------------------------

/**
 * Returns the CRP rules object for the given ladder position.
 * Falls back to NOVICE_RULES for positions outside POS_RULES.
 * @param {number|null} pos
 * @returns {{ win: number, loss: number, home: number, streak: number, format: string }}
 */
export function getRules(pos) {
  if (pos != null && POS_RULES[pos]) {
    return POS_RULES[pos];
  }
  return NOVICE_RULES;
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
 * Streak bonus: every 4th consecutive win, the winner receives the loser's
 * "streak" value.
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

  // Home bonus -- each side uses the opponent's home value
  let winnerHome = 0;
  let loserHome = 0;

  if (homeFor === "winner" || homeFor === "both") {
    winnerHome = loserRules.home;
  }
  if (homeFor === "loser" || homeFor === "both") {
    loserHome = winnerRules.home;
  }

  // Streak bonus -- every 4th consecutive win for the winner
  const newStreak = (winner.consecutive_wins || 0) + 1;
  const streakBonus = newStreak % 4 === 0 ? loserRules.streak : 0;

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
