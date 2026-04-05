import './nav.js';
import {
  db, auth, collection, doc, getDoc, getDocs, query, orderBy, onSnapshot,
  updateDoc, Timestamp, onAuthStateChanged
} from './firebase.js';
import { finalizeMatch } from './finalize.js';
import { postToDiscord, raceResultMessage, mapWinnerMessage, matchFinalizedMessage, banpickCompleteMessage } from './discord.js';

// --- MAPS (same as banpick) ---

const MAPS = [
  { id: 0, name: 'Akina', image: '/img/akina_day.png' },
  { id: 1, name: 'Tsuchisaka', image: '/img/tsuchisaka_day.png' },
  { id: 2, name: 'Tsubaki', image: '/img/tsubaki_day.png' },
  { id: 3, name: 'Irohazaka', image: '/img/irohazaka_day.png' },
  { id: 4, name: 'Akagi', image: '/img/akagi_day.png' },
  { id: 5, name: 'Usui', image: '/img/usui_day.png' },
  { id: 6, name: 'Myogi', image: '/img/myogi_day.png' },
  { id: 7, name: 'Sadamine', image: '/img/sadamine_day.png' },
  { id: 9, name: 'Nagao', image: '/img/nagao_day.png' },
  { id: 10, name: 'Tsukuba', image: '/img/tsukuba_day.png' },
  { id: 11, name: 'Nanamagari', image: '/img/nanamagari_day.png' },
  { id: 12, name: 'Takigahara', image: '/img/takigahara_day.png' },
  { id: 13, name: 'Ashinoko', image: '/img/ashinoko_day.png' },
  { id: 14, name: 'Enna Skyline', image: '/img/enna_day.png' },
  { id: 15, name: 'Shomaru', image: '/img/shomaru_day.png' }
];

// --- URL PARAMS ---

const params = new URLSearchParams(window.location.search);
const matchId = params.get('id');

// --- STATE ---

let matchData = null;
let sessionData = null;
let isStaff = false;
let currentUser = null;
let standingsCache = [];
let sessionUnsubscribe = null;
let lastProcessedSessionState = null; // Track to avoid duplicate processing

// --- DOM REFS ---

const loadingState = document.getElementById('loadingState');
const notFoundState = document.getElementById('notFoundState');

// --- TOAST ---

let _tt;
function toast(msg, err = false) {
  const el = document.getElementById('toast');
  clearTimeout(_tt);
  el.textContent = msg;
  el.className = 'show' + (err ? ' err' : '');
  _tt = setTimeout(() => el.className = '', 3200);
}

// --- INIT ---

if (!matchId) {
  // No match ID — show not-found
  if (loadingState) loadingState.style.display = 'none';
  if (notFoundState) notFoundState.style.display = 'block';
} else {
  // Auth check (non-blocking)
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      try {
        const staffDoc = await getDoc(doc(db, 'staff', user.uid));
        isStaff = staffDoc.exists();
      } catch (e) {
        console.error('Staff check failed:', e);
        isStaff = false;
      }
    } else {
      isStaff = false;
    }
    // Re-render if match data is already loaded so staff controls appear
    if (matchData) render();
  });

  // Listen to match document in real-time
  onSnapshot(doc(db, 'matches', matchId), (snap) => {
    if (loadingState) loadingState.style.display = 'none';

    if (!snap.exists()) {
      if (notFoundState) notFoundState.style.display = 'block';
      return;
    }

    matchData = { id: snap.id, ...snap.data() };
    render();
  });
}

// --- RENDER ---

function render() {
  if (!matchData) return;

  // -- Header (always) --
  const teamANameEl = document.getElementById('teamAName');
  const teamBNameEl = document.getElementById('teamBName');
  const battleScoreEl = document.getElementById('battleScore');
  const battleStatusEl = document.getElementById('battleStatus');

  const tagA = matchData.teamATag ? ` [${matchData.teamATag}]` : '';
  const tagB = matchData.teamBTag ? ` [${matchData.teamBTag}]` : '';
  if (teamANameEl) teamANameEl.textContent = (matchData.teamAName || '—') + tagA;
  if (teamBNameEl) teamBNameEl.textContent = (matchData.teamBName || '—') + tagB;

  const scoreA = matchData.liveScore?.teamA || 0;
  const scoreB = matchData.liveScore?.teamB || 0;
  if (battleScoreEl) battleScoreEl.textContent = `${scoreA} \u2014 ${scoreB}`;

  // Status badge
  if (battleStatusEl) {
    if (matchData.status === 'banpick') {
      battleStatusEl.innerHTML = '<span class="badge badge-banpick">Ban/Pick</span>';
    } else if (matchData.status === 'in_progress') {
      battleStatusEl.innerHTML = '<span class="badge badge-live">Live</span>';
    } else if (matchData.status === 'completed') {
      battleStatusEl.innerHTML = '<span class="badge badge-completed">Completed</span>';
    }
  }

  // Winner highlight
  if (teamANameEl) teamANameEl.classList.toggle('winner', matchData.status === 'completed' && matchData.winner === matchData.teamA);
  if (teamBNameEl) teamBNameEl.classList.toggle('winner', matchData.status === 'completed' && matchData.winner === matchData.teamB);

  // -- Status-specific rendering --
  const banpickState = document.getElementById('banpickState');
  const banpickBanner = document.getElementById('banpickBanner');
  const mapCards = document.getElementById('mapCards');
  const finalizeBar = document.getElementById('finalizeBar');
  const crpResult = document.getElementById('crpResult');

  // Always set up session listener if we have a session and match isn't completed
  if (matchData.banpickSessionId && !sessionUnsubscribe && matchData.status !== 'completed') {
    sessionUnsubscribe = onSnapshot(doc(db, 'sessions', matchData.banpickSessionId), (snap) => {
      if (!snap.exists()) return;
      sessionData = snap.data();
      handleSessionUpdate();
    });
  }

  if (matchData.status === 'banpick') {
    if (banpickState) banpickState.style.display = 'block';
    if (banpickBanner) banpickBanner.style.display = 'none';
    if (mapCards) mapCards.style.display = 'none';
    if (finalizeBar) finalizeBar.style.display = 'none';
    if (crpResult) crpResult.style.display = 'none';

    // Set banpick link
    const banpickLink = document.getElementById('banpickLink');
    if (banpickLink && matchData.banpickSessionId) {
      const url = `${window.location.origin}/banpick?join=${matchData.banpickSessionId}`;
      banpickLink.href = url;
      banpickLink.textContent = url;
    }

  } else if (matchData.status === 'in_progress') {
    if (banpickState) banpickState.style.display = 'none';
    if (mapCards) mapCards.style.display = 'flex';
    if (crpResult) crpResult.style.display = 'none';

    // Show ban/pick banner if session is in a ban/pick phase
    const isBanpickActive = sessionData && !['RACING', 'COMPLETE'].includes(sessionData.phase);
    if (banpickBanner) {
      if (isBanpickActive) {
        const url = `${window.location.origin}/banpick?join=${matchData.banpickSessionId}`;
        banpickBanner.innerHTML = `<p>Ban/Pick is in progress for the next maps.</p><p><a href="${url}" target="_blank">${url}</a></p>`;
        banpickBanner.style.display = 'block';
      } else {
        banpickBanner.style.display = 'none';
      }
    }

    renderMapCards();

  } else if (matchData.status === 'completed') {
    if (banpickState) banpickState.style.display = 'none';
    if (banpickBanner) banpickBanner.style.display = 'none';
    if (mapCards) mapCards.style.display = 'flex';
    if (finalizeBar) finalizeBar.style.display = 'none';

    // Clean up session listener
    if (sessionUnsubscribe) {
      sessionUnsubscribe();
      sessionUnsubscribe = null;
    }

    renderMapCards();
  }
}

// --- SESSION UPDATE HANDLER ---

let transitioning = false;

function handleSessionUpdate() {
  if (!sessionData || !matchData) return;

  const stateKey = `${sessionData.phase}:${sessionData.round}`;
  if (stateKey === lastProcessedSessionState) return;

  // RACING phase = round of ban/pick just completed, add maps
  if (sessionData.phase === 'RACING') {
    lastProcessedSessionState = stateKey;
    addMapsForRound(sessionData.round);
  }

  // DECIDER phase = decider map determined
  if (sessionData.phase === 'DECIDER') {
    lastProcessedSessionState = stateKey;
    addDeciderMap();
  }

  // Re-render to update banpick banner visibility
  if (matchData.status === 'in_progress') {
    render();
  }
}

async function addMapsForRound(round) {
  if (transitioning) return;
  transitioning = true;

  const threadId = matchData.discordThreadId || null;
  const teamAName = matchData.teamAName;
  const teamBName = matchData.teamBName;

  try {
    if (round === 1) {
      // Round 1 — transition match to in_progress
      // Guard: only transition if still in banpick status
      if (matchData.status !== 'banpick') { transitioning = false; return; }

      const homeAMap = MAPS.find(m => m.id === sessionData.homeA);
      const homeBMap = MAPS.find(m => m.id === sessionData.homeB);
      const picks = sessionData.picks || [];
      const format = matchData.format || 'BO3';

      const mapResults = [
        { mapName: homeAMap?.name, mapId: sessionData.homeA, type: 'home_a', uphillWinner: null, downhillWinner: null, tiebreaker: null, mapWinner: null },
        { mapName: homeBMap?.name, mapId: sessionData.homeB, type: 'home_b', uphillWinner: null, downhillWinner: null, tiebreaker: null, mapWinner: null },
      ];

      // BO5: round 1 also includes secondary picks (all 4 maps upfront)
      if (format === 'BO5' && picks.length > 0) {
        picks.forEach(pickId => {
          const pickMap = MAPS.find(m => m.id === pickId);
          mapResults.push({ mapName: pickMap?.name, mapId: pickId, type: 'pick', uphillWinner: null, downhillWinner: null, tiebreaker: null, mapWinner: null });
        });
      }

      const banpickResult = { homeA: sessionData.homeA, homeB: sessionData.homeB };
      if (picks.length > 0) banpickResult.picks = picks;

      await updateDoc(doc(db, 'matches', matchId), {
        status: 'in_progress',
        banpickResult,
        mapResults,
      });

      let mapsMsg = `🗺️ **Maps Selected:**\nMap 1: **${homeAMap?.name}** (${teamAName} Home)\nMap 2: **${homeBMap?.name}** (${teamBName} Home)`;
      picks.forEach((pickId, i) => {
        const pickMap = MAPS.find(m => m.id === pickId);
        mapsMsg += `\nMap ${3 + i}: **${pickMap?.name}** (Pick)`;
      });
      await postToDiscord(threadId, mapsMsg);
      postToDiscord(threadId, `🏁 **Time to race!** First up: **${homeAMap?.name}** (Map 1)`);
    }
  } catch (e) {
    console.error('Failed to add maps for round:', e);
  }
  transitioning = false;
}

async function addDeciderMap() {
  if (transitioning) return;
  transitioning = true;

  try {
    const allIds = MAPS.map(m => m.id);
    const taken = [sessionData.homeA, sessionData.homeB, ...sessionData.bans, ...(sessionData.picks || [])];
    const deciderId = allIds.find(id => !taken.includes(id));
    const deciderMap = MAPS.find(m => m.id === deciderId);

    const existingResults = matchData.mapResults || [];
    // Guard: don't add if decider already exists
    if (existingResults.some(m => m.type === 'decider')) { transitioning = false; return; }
    const newMap = { mapName: deciderMap?.name, mapId: deciderId, type: 'decider', uphillWinner: null, downhillWinner: null, tiebreaker: null, mapWinner: null };
    const updatedResults = [...existingResults, newMap];
    const banpickResult = { ...matchData.banpickResult, decider: deciderId };

    await updateDoc(doc(db, 'matches', matchId), {
      mapResults: updatedResults,
      banpickResult,
    });

    const threadId = matchData.discordThreadId || null;
    await postToDiscord(threadId, `🗺️ **Decider Map:** Map ${updatedResults.length}: **${deciderMap?.name}**`);
    postToDiscord(threadId, `🏁 **Time to race!** Decider: **${deciderMap?.name}** (Map ${updatedResults.length})`);
  } catch (e) {
    console.error('Failed to add decider map:', e);
  }
  transitioning = false;
}

// --- RESUME BAN/PICK ---

async function resumeBanpick(nextRound, firstBanPhase) {
  if (!matchData.banpickSessionId) return;

  const score = matchData.liveScore || { teamA: 0, teamB: 0 };

  try {
    await updateDoc(doc(db, 'sessions', matchData.banpickSessionId), {
      round: nextRound,
      phase: firstBanPhase,
      liveScore: score,
    });
    toast(`Ban/Pick resumed for round ${nextRound}`);
  } catch (e) {
    console.error('Failed to resume ban/pick:', e);
    toast('Failed to resume ban/pick', true);
  }
}

// --- MAP CARDS RENDERING ---

function renderMapCards() {
  const container = document.getElementById('mapCards');
  if (!container) return;
  container.style.display = 'flex';

  const results = matchData.mapResults || [];
  const isCompleted = matchData.status === 'completed';
  const format = matchData.format || 'BO3';
  const score = matchData.liveScore || { teamA: 0, teamB: 0 };

  // Determine which map is currently active (first map without a winner)
  const activeIdx = results.findIndex(m => !m.mapWinner);

  container.innerHTML = results.map((map, i) => {
    // Hide unplayed maps (no winner) on completed matches
    if (isCompleted && !map.mapWinner) return '';
    // Progressive reveal: hide maps that shouldn't be shown yet
    // BO3: hide decider until score is 1-1
    if (format === 'BO3' && map.type === 'decider' && score.teamA < 1 && score.teamB < 1) return '';
    // BO5: hide map 4 (index 3) until map 3 has a winner (avoid spoiling picks)
    if (format === 'BO5' && i === 3 && results[2] && !results[2].mapWinner) return '';
    // BO5: hide decider until score is 2-2
    if (format === 'BO5' && map.type === 'decider' && (score.teamA < 2 || score.teamB < 2)) return '';

    const isActive = i === activeIdx && !isCompleted;
    const isDone = map.mapWinner !== null;
    const canEdit = isStaff && !isCompleted;
    const activeClass = isActive ? 'active' : isDone ? 'completed' : '';

    const typeLabel = map.type === 'home_a' ? `${matchData.teamAName} Home`
      : map.type === 'home_b' ? `${matchData.teamBName} Home`
      : map.type === 'pick' ? 'Pick'
      : 'Decider';

    const winnerLabel = isDone
      ? `<span class="map-card-winner">${map.mapWinner === matchData.teamA ? matchData.teamAName : matchData.teamBName} wins</span>`
      : '';

    return `<div class="battle-map-card ${activeClass}" data-map-idx="${i}">
      <div class="map-card-header">
        <span class="map-card-title">Map ${i + 1}: ${map.mapName || '\u2014'}</span>
        <span class="map-card-type">${typeLabel}</span>
        ${winnerLabel}
      </div>
      <div class="map-card-body">
        ${renderRaceRow(map, i, 'uphill', 'Uphill', isActive && isStaff, canEdit)}
        ${renderRaceRow(map, i, 'downhill', 'Downhill', isActive && isStaff, canEdit)}
        ${renderTiebreakerRow(map, i, isActive && isStaff, canEdit)}
      </div>
    </div>`;
  }).join('');

  // Wire up click handlers for race buttons
  container.querySelectorAll('.race-btn:not(.undo-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.mapIdx);
      const race = btn.dataset.race;
      const team = btn.dataset.team;
      recordRaceResult(idx, race, team);
    });
  });

  // Wire up undo buttons
  container.querySelectorAll('.undo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.mapIdx);
      const race = btn.dataset.race;
      undoRaceResult(idx, race);
    });
  });

  // Check for finalization
  checkForWinner();
}

// --- RACE ROW RENDERING ---

function renderRaceRow(map, mapIdx, raceType, label, canPickWinner, canUndo) {
  const field = raceType + 'Winner';
  const winner = map[field];

  if (winner) {
    const winnerName = winner === matchData.teamA ? matchData.teamAName : matchData.teamBName;
    const undoBtn = canUndo ? ` <button class="race-btn undo-btn" data-map-idx="${mapIdx}" data-race="${raceType}" style="font-size:.7rem;padding:.2rem .5rem;color:var(--text-mute);">Undo</button>` : '';
    return `<div class="race-row">
      <span class="race-label">${label}</span>
      <span class="race-result-text">${winnerName}${undoBtn}</span>
    </div>`;
  }

  if (!canPickWinner) {
    return `<div class="race-row">
      <span class="race-label">${label}</span>
      <span style="color:var(--text-mute);font-size:.82rem;">\u2014</span>
    </div>`;
  }

  return `<div class="race-row">
    <span class="race-label">${label}</span>
    <div class="race-btns">
      <button class="race-btn" data-map-idx="${mapIdx}" data-race="${raceType}" data-team="${matchData.teamA}">${matchData.teamAName}</button>
      <button class="race-btn" data-map-idx="${mapIdx}" data-race="${raceType}" data-team="${matchData.teamB}">${matchData.teamBName}</button>
    </div>
  </div>`;
}

// --- TIEBREAKER ROW ---

function renderTiebreakerRow(map, mapIdx, canPickWinner, canUndo) {
  if (!map.uphillWinner || !map.downhillWinner) return '';
  if (map.uphillWinner === map.downhillWinner) return '';

  if (map.tiebreaker) {
    const winnerName = map.tiebreaker === matchData.teamA ? matchData.teamAName : matchData.teamBName;
    const undoBtn = canUndo ? ` <button class="race-btn undo-btn" data-map-idx="${mapIdx}" data-race="tiebreaker" style="font-size:.7rem;padding:.2rem .5rem;color:var(--text-mute);">Undo</button>` : '';
    return `<div class="race-row">
      <span class="race-label">Tiebreaker</span>
      <span class="race-result-text">${winnerName}${undoBtn}</span>
    </div>`;
  }

  if (!canPickWinner) {
    return `<div class="race-row">
      <span class="race-label">Tiebreaker</span>
      <span style="color:var(--text-mute);font-size:.82rem;">\u2014</span>
    </div>`;
  }

  return `<div class="race-row">
    <span class="race-label">Tiebreaker</span>
    <div class="race-btns">
      <button class="race-btn" data-map-idx="${mapIdx}" data-race="tiebreaker" data-team="${matchData.teamA}">${matchData.teamAName}</button>
      <button class="race-btn" data-map-idx="${mapIdx}" data-race="tiebreaker" data-team="${matchData.teamB}">${matchData.teamBName}</button>
    </div>
  </div>`;
}

// --- RECORD RACE RESULT ---

async function recordRaceResult(mapIdx, raceType, teamId) {
  const results = [...matchData.mapResults];
  const map = { ...results[mapIdx] };

  const field = raceType === 'tiebreaker' ? 'tiebreaker' : raceType + 'Winner';
  map[field] = teamId;

  // Auto-calculate map winner
  if (map.uphillWinner && map.downhillWinner) {
    if (map.uphillWinner === map.downhillWinner) {
      map.mapWinner = map.uphillWinner;
    } else if (map.tiebreaker) {
      map.mapWinner = map.tiebreaker;
    }
  }

  results[mapIdx] = map;

  // Capture old state before updateDoc triggers onSnapshot
  const prevMapWinner = matchData.mapResults[mapIdx].mapWinner;

  // Recalculate live score
  const liveScore = { teamA: 0, teamB: 0 };
  results.forEach(m => {
    if (m.mapWinner === matchData.teamA) liveScore.teamA++;
    else if (m.mapWinner === matchData.teamB) liveScore.teamB++;
  });

  await updateDoc(doc(db, 'matches', matchId), {
    mapResults: results,
    liveScore,
  });

  // Post Discord updates
  const threadId = matchData.discordThreadId || null;
  const teamName = teamId === matchData.teamA ? matchData.teamAName : matchData.teamBName;
  const mapName = map.mapName;

  // Race result message
  await postToDiscord(threadId, raceResultMessage(mapName, raceType, teamName));

  // If map winner just determined, post that too and check for ban/pick resumption
  if (map.mapWinner && !prevMapWinner) {
    const mapWinnerName = map.mapWinner === matchData.teamA ? matchData.teamAName : matchData.teamBName;
    await postToDiscord(threadId, mapWinnerMessage(
      mapIdx + 1, mapName, mapWinnerName,
      liveScore.teamA, liveScore.teamB,
      matchData.teamAName, matchData.teamBName
    ));

    // Check if we need to resume ban/pick for more maps
    checkBanpickResumption(liveScore, results);

    // If there's a next map ready to race (no winner yet, no ban/pick resumption), announce it
    const format = matchData.format || 'BO3';
    const threshold = format === 'BO5' ? 3 : 2;
    const hasWinner = liveScore.teamA >= threshold || liveScore.teamB >= threshold;
    if (!hasWinner) {
      const nextIdx = results.findIndex(m => !m.mapWinner);
      if (nextIdx !== -1) {
        const nextMap = results[nextIdx];
        postToDiscord(threadId, `🏁 **Next up: ${nextMap.mapName}** (Map ${nextIdx + 1})`);
      }
    }
  }
}

// --- BAN/PICK RESUMPTION LOGIC ---

function checkBanpickResumption(score, results) {
  const format = matchData.format || 'BO3';
  const threshold = format === 'BO5' ? 3 : 2;

  // If someone already won, no need to resume
  if (score.teamA >= threshold || score.teamB >= threshold) return;

  const completedMaps = results.filter(m => m.mapWinner !== null).length;

  if (format === 'BO3') {
    // After 2 home maps: if 1-1, resume for decider bans
    if (completedMaps === 2 && score.teamA === 1 && score.teamB === 1) {
      // Higher-ranked (Team A) bans first
      resumeBanpick(2, 'BAN_A');
    }
  } else if (format === 'BO5') {
    // After 4 maps (if score is 2-2): resume for decider bans
    if (completedMaps === 4 && score.teamA === 2 && score.teamB === 2) {
      // Higher-ranked (Team A) bans first (score is tied)
      resumeBanpick(2, 'BAN_A');
    }
  }
}

// --- UNDO RACE RESULT ---

async function undoRaceResult(mapIdx, raceType) {
  const results = [...matchData.mapResults];
  const map = { ...results[mapIdx] };

  if (raceType === 'tiebreaker') {
    map.tiebreaker = null;
    map.mapWinner = null;
  } else {
    const field = raceType + 'Winner';
    map[field] = null;
    // Clear tiebreaker and map winner since a race was undone
    map.tiebreaker = null;
    map.mapWinner = null;
  }

  results[mapIdx] = map;

  // Recalculate live score
  const liveScore = { teamA: 0, teamB: 0 };
  results.forEach(m => {
    if (m.mapWinner === matchData.teamA) liveScore.teamA++;
    else if (m.mapWinner === matchData.teamB) liveScore.teamB++;
  });

  await updateDoc(doc(db, 'matches', matchId), {
    mapResults: results,
    liveScore,
  });
}

// --- WINNER DETECTION ---

function checkForWinner() {
  if (matchData.status === 'completed') {
    document.getElementById('finalizeBar').style.display = 'none';
    return;
  }

  const score = matchData.liveScore || { teamA: 0, teamB: 0 };
  const threshold = matchData.format === 'BO5' ? 3 : 2;

  let detectedWinner = null;
  if (score.teamA >= threshold) detectedWinner = matchData.teamA;
  else if (score.teamB >= threshold) detectedWinner = matchData.teamB;

  if (detectedWinner) {
    const winnerName = detectedWinner === matchData.teamA ? matchData.teamAName : matchData.teamBName;

    document.getElementById('finalizeText').textContent = `${winnerName} has won the series ${score.teamA}\u2014${score.teamB}. Confirm to finalize and apply CRP.`;

    if (isStaff) {
      document.getElementById('finalizeBar').style.display = 'block';
      document.getElementById('finalizeBtn').onclick = () => doFinalize(detectedWinner);
    }
  } else {
    document.getElementById('finalizeBar').style.display = 'none';
  }
}

// --- FINALIZE ---

async function doFinalize(winnerId) {
  const loserId = winnerId === matchData.teamA ? matchData.teamB : matchData.teamA;
  const winnerName = winnerId === matchData.teamA ? matchData.teamAName : matchData.teamBName;
  const loserName = winnerId === matchData.teamA ? matchData.teamBName : matchData.teamAName;

  // Both teams play on each other's home maps
  const homeFor = 'both';

  // Load standings for finalization
  const standingsSnap = await getDocs(query(collection(db, 'standings'), orderBy('rank', 'asc')));
  const allStandings = standingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const winnerStanding = allStandings.find(s => s.id === winnerId);
  const loserStanding = allStandings.find(s => s.id === loserId);

  if (!winnerStanding || !loserStanding) {
    toast('Standings not found for teams', true);
    return;
  }

  const score = matchData.liveScore || { teamA: 0, teamB: 0 };

  try {
    const result = await finalizeMatch(db, {
      matchId,
      winnerId,
      loserId,
      winnerName,
      loserName,
      homeFor,
      score,
      format: matchData.format,
      recordedBy: currentUser?.uid || 'unknown',
      notes: '',
      matchData: {
        mapResults: matchData.mapResults,
        banpickResult: matchData.banpickResult,
      }
    }, winnerStanding, loserStanding, allStandings);

    // Post Discord finalization message
    postToDiscord(matchData.discordThreadId || null, matchFinalizedMessage(
        winnerName, loserName,
        score.teamA, score.teamB,
        matchData.teamAName, matchData.teamBName,
        result.winnerCRP, result.loserCRP
      ));

    // Show CRP result
    const crpEl = document.getElementById('crpResult');
    crpEl.innerHTML = `<div class="card" style="max-width:500px;margin:0 auto;text-align:center;">
      <h4 style="color:var(--accent);margin-bottom:1rem;">Match Finalized</h4>
      <div style="padding:1rem 0;">
        <div style="font-size:1.1rem;margin-bottom:.5rem;"><b>${winnerName}</b> +${result.winnerCRP} CRP</div>
        <div style="font-size:.9rem;color:var(--text-dim);">${loserName} +${result.loserCRP} CRP</div>
        ${result.positionShifted ? '<div style="color:var(--accent);margin-top:.5rem;font-size:.88rem;">Position shift applied</div>' : ''}
      </div>
    </div>`;
    crpEl.style.display = 'block';

    toast(`Match finalized: ${winnerName} wins!`);
  } catch (e) {
    console.error(e);
    toast('Finalization failed: ' + e.message, true);
  }
}
