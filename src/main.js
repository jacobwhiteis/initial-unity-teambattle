import './nav.js';
import { db, collection, query, orderBy, limit, onSnapshot } from './firebase.js';
import { getTier, getRules } from './crp.js';

// ---------------------------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------------------------

const leaderboardBody = document.getElementById('leaderboard-body');
const matchesContainer = document.getElementById('matchesContainer');
const pageTitle = document.querySelector('.page-title');
const pageSub = document.querySelector('.page-sub');
const boardTabs = document.querySelectorAll('.board-tab');

// ---------------------------------------------------------------------------
// Current board mode
// ---------------------------------------------------------------------------

let currentMode = 'position'; // 'position' or 'crp'
let currentStandings = [];

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

boardTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    boardTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentMode = tab.dataset.board;

    // Update page title and subtitle based on mode
    if (currentMode === 'position') {
      pageTitle.textContent = 'Position Leaderboard';
      pageSub.textContent = 'Teams ranked by league position \u00b7 Click a team to expand details';
    } else {
      pageTitle.textContent = 'CRP Rankings';
      pageSub.textContent = 'Teams ranked by total Competition Rating Points earned';
    }

    renderBoard(sortStandings(currentStandings, currentMode), currentMode);
  });
});

// ---------------------------------------------------------------------------
// Sorting functions
// ---------------------------------------------------------------------------

function sortStandings(standings, mode) {
  const list = [...standings];
  if (mode === 'position') {
    const ranked = list.filter(t => t.position != null && t.position > 0)
      .sort((a, b) => a.position - b.position);
    const unranked = list.filter(t => t.position == null || t.position <= 0);
    return [...ranked, ...unranked];
  } else {
    // CRP mode: sort by CRP descending, tie-break by position
    return list.sort((a, b) => {
      const crpDiff = (b.crp || 0) - (a.crp || 0);
      if (crpDiff !== 0) return crpDiff;
      const aPosValid = a.position != null && a.position > 0;
      const bPosValid = b.position != null && b.position > 0;
      if (aPosValid && bPosValid) return a.position - b.position;
      if (aPosValid) return -1;
      if (bPosValid) return 1;
      return 0;
    });
  }
}

// ---------------------------------------------------------------------------
// Render Leaderboard
// ---------------------------------------------------------------------------

function renderBoard(teams, mode) {
  if (!teams.length) {
    leaderboardBody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No teams found.</div></td></tr>';
    return;
  }

  leaderboardBody.innerHTML = '';

  teams.forEach((team, i) => {
    const crpRank = i + 1;
    const tier = getTier(team.position);
    const drivers = team.roster || [];
    const driverPreview = drivers.map(d => d.name).join(', ');
    const streak = team.consecutive_wins || 0;

    // Rank display: position mode shows actual position, CRP mode shows CRP rank
    let rankDisp;
    if (mode === 'crp') {
      rankDisp = crpRank;
    } else {
      rankDisp = (team.position != null && team.position > 0) ? team.position : '\u2014';
    }

    // Rank color class
    const displayNum = mode === 'crp' ? crpRank : (team.position || 999);
    const rankClass = displayNum === 1 ? 'r1' : displayNum === 2 ? 'r2' : displayNum === 3 ? 'r3' : '';

    // Streak display
    const streakHtml = streak >= 2
      ? `<span class="streak-pill">\ud83d\udd25 ${streak}</span>`
      : '<span style="color:var(--text-mute)">\u2014</span>';

    // Data row
    const tr = document.createElement('tr');
    tr.className = 'data-row';
    tr.innerHTML = `
      <td class="rank-cell ${rankClass}">${rankDisp}</td>
      <td>
        <div><span class="tag-badge">${team.teamTag || ''}</span><span class="team-name">${team.teamName || team.name || ''}</span></div>
        ${driverPreview ? `<div class="team-sub">${driverPreview}</div>` : ''}
      </td>
      <td class="c"><span class="tier-badge tier-${tier}">${tier}</span></td>
      <td class="c"><span class="wl-cell"><span class="w">${team.wins || 0}</span><span class="s">/</span><span class="l">${team.losses || 0}</span></span></td>
      <td class="c">${streakHtml}</td>
      <td class="r"><span class="crp-val">${team.crp || 0}</span></td>
    `;

    // Expand row (hidden by default)
    const expTr = document.createElement('tr');
    expTr.className = 'expand-row';
    expTr.style.display = 'none';
    expTr.innerHTML = '<td colspan="6"><div class="expand-inner"></div></td>';

    tr.addEventListener('click', () => toggleExpand(leaderboardBody, tr, expTr, team, mode));

    leaderboardBody.appendChild(tr);
    leaderboardBody.appendChild(expTr);
  });
}

// ---------------------------------------------------------------------------
// Toggle Expand
// ---------------------------------------------------------------------------

function toggleExpand(tbody, tr, expTr, team, mode) {
  const isOpen = expTr.style.display !== 'none';

  // Close all expand rows first
  tbody.querySelectorAll('.expand-row').forEach(r => r.style.display = 'none');

  if (isOpen) return;

  const inner = expTr.querySelector('.expand-inner');
  const drivers = team.roster || [];
  const hist = team.match_history || [];

  // Drivers section
  let driverHtml = '<div class="exp-section"><h4>Drivers</h4>';
  if (drivers.length) {
    drivers.forEach(d => {
      const rc = d.role === 'Leader' ? 'leader' : d.role === 'Co-Leader' ? 'coleader' : '';
      driverHtml += `<div class="driver-row">
        <span class="role-pill ${rc}">${d.role || 'Member'}</span>
        <span>${d.name}</span>
        ${d.car ? `<span style="color:var(--text-mute);font-size:.82rem;margin-left:.25rem;">\u00b7 ${d.car}</span>` : ''}
      </div>`;
    });
  } else {
    driverHtml += '<div style="color:var(--text-mute);font-size:.82rem">No drivers assigned.</div>';
  }
  driverHtml += '</div>';

  // History section — always shows both position and CRP changes
  let histHtml = `<div class="exp-section"><h4>Match History</h4>`;
  if (hist.length) {
    hist.slice(0, 10).forEach(m => {
      const bc = m.result === 'Win' ? 'win' : 'loss';
      const ts = m.timestamp ? (typeof m.timestamp === 'string' ? m.timestamp.split('T')[0] :
        m.timestamp.toDate ? m.timestamp.toDate().toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '') : '';

      // Position change
      const posBefore = m.pos_before != null ? `#${m.pos_before}` : '\u2014';
      const posAfter = m.pos_after != null ? `#${m.pos_after}` : '\u2014';
      const posChanged = m.pos_before !== m.pos_after;
      const posStr = posChanged
        ? `<span style="color:var(--text-dim)">${posBefore}</span> <span style="color:var(--text-mute)">\u2192</span> <span style="color:${m.result === 'Win' ? 'var(--win)' : 'var(--loss)'}">${posAfter}</span>`
        : `<span style="color:var(--text-mute)">${posAfter}</span>`;

      // CRP change
      const crpStr = `<span style="color:${m.result === 'Win' ? 'var(--win)' : 'var(--text-dim)'}">+${m.crp_gained || 0}</span>`;

      histHtml += `<div class="match-row"><span class="res-pill ${bc}">${m.result}</span><span class="match-opp">vs ${m.opponent}</span><span class="match-crp" style="font-size:.82rem">${posStr}</span><span class="match-crp" style="font-size:.82rem">${crpStr} CRP</span><span class="match-ts">${ts}</span></div>`;
    });
  } else {
    histHtml += '<div style="color:var(--text-mute);font-size:.82rem">No matches logged yet.</div>';
  }
  histHtml += '</div>';

  const linkHtml = `<div style="margin-top:.75rem;text-align:right;"><a href="/team?t=${team.teamTag || ''}" style="color:var(--primary);font-size:.82rem;text-decoration:none;">View full team page &rarr;</a></div>`;

  inner.innerHTML = driverHtml + histHtml + linkHtml;
  expTr.style.display = 'table-row';
}

// ---------------------------------------------------------------------------
// Firestore Listener for Standings
// ---------------------------------------------------------------------------

const standingsQuery = query(collection(db, 'standings'), orderBy('rank', 'asc'));
onSnapshot(standingsQuery, (snapshot) => {
  currentStandings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderBoard(sortStandings(currentStandings, currentMode), currentMode);
});

// ---------------------------------------------------------------------------
// Live Battles + Recent Matches
// ---------------------------------------------------------------------------

const liveBattlesSection = document.getElementById('liveBattlesSection');
const liveBattlesContainer = document.getElementById('liveBattlesContainer');

const matchesQuery = query(
  collection(db, 'matches'),
  orderBy('date', 'desc'),
  limit(20)
);

onSnapshot(matchesQuery, (snapshot) => {
  const allMatches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const live = allMatches.filter(m => m.status === 'banpick' || m.status === 'in_progress');
  const completed = allMatches.filter(m => m.status === 'completed').slice(0, 10);

  // --- Live Battles ---
  if (live.length === 0) {
    liveBattlesSection.style.display = 'none';
  } else {
    liveBattlesSection.style.display = '';
    liveBattlesContainer.innerHTML = '';

    live.forEach(match => {
      const card = document.createElement('div');
      card.className = 'match-card live-match-card';

      const scoreA = match.liveScore?.teamA ?? match.score?.teamA ?? 0;
      const scoreB = match.liveScore?.teamB ?? match.score?.teamB ?? 0;
      const tagA = match.teamATag ? ` [${match.teamATag}]` : '';
      const tagB = match.teamBTag ? ` [${match.teamBTag}]` : '';

      const isLive = match.status === 'in_progress';
      const statusPill = isLive
        ? '<span class="status-pill status-live"><span class="pulse-dot"></span>LIVE</span>'
        : '<span class="status-pill status-banpick">BAN/PICK</span>';

      card.innerHTML = `
        <div class="match-teams">
          <span class="match-team">${match.teamAName}${tagA}</span>
          <span class="match-score">${scoreA} \u2014 ${scoreB}</span>
          <span class="match-team">${match.teamBName}${tagB}</span>
        </div>
        <div class="match-meta">
          ${statusPill}
        </div>
      `;

      card.addEventListener('click', () => {
        window.location.href = `/battle?id=${match.id}`;
      });

      liveBattlesContainer.appendChild(card);
    });
  }

  // --- Recent Matches ---
  if (completed.length === 0) {
    matchesContainer.innerHTML = '<div class="empty-state">No matches recorded yet</div>';
    return;
  }

  matchesContainer.innerHTML = '';

  completed.forEach(match => {
    const card = document.createElement('div');
    card.className = 'match-card';

    const isTeamAWinner = match.winner === match.teamA;
    const dateStr = match.date?.toDate
      ? match.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';

    const mapList = match.mapResults?.length ? match.mapResults : match.maps || [];
    const mapNames = mapList.filter(m => m.mapWinner != null).map(m => m.mapName).join(', ');

    const tagA = match.teamATag ? ` [${match.teamATag}]` : '';
    const tagB = match.teamBTag ? ` [${match.teamBTag}]` : '';

    card.innerHTML = `
      <div class="match-teams">
        <span class="match-team ${isTeamAWinner ? 'winner' : 'loser'}">${match.teamAName}${tagA}</span>
        <span class="match-score">${match.score?.teamA ?? 0} \u2014 ${match.score?.teamB ?? 0}</span>
        <span class="match-team ${!isTeamAWinner ? 'winner' : 'loser'}">${match.teamBName}${tagB}</span>
      </div>
      <div class="match-meta">
        ${mapNames ? `<span class="match-maps">${mapNames}</span>` : ''}
        <span class="match-date">${dateStr}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      window.location.href = `/match?id=${match.id}`;
    });

    matchesContainer.appendChild(card);
  });
});
