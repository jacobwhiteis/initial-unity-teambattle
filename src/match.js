import './nav.js';
import { db, auth, doc, getDoc, onAuthStateChanged } from './firebase.js';

const matchContainer = document.getElementById('matchContainer');

const params = new URLSearchParams(window.location.search);
const matchId = params.get('id');

if (!matchId) {
  window.location.href = '/';
}

let isStaff = false;

// Auth check (non-blocking)
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const staffDoc = await getDoc(doc(db, 'staff', user.uid));
      isStaff = staffDoc.exists();
    } catch (e) {
      isStaff = false;
    }
  }
  loadMatch();
});

async function loadMatch() {
  const matchDoc = await getDoc(doc(db, 'matches', matchId));

  if (!matchDoc.exists()) {
    matchContainer.innerHTML = `
      <p style="text-align: center; color: var(--text-dim); padding: 40px 0;">
        Match not found.
        <a href="/" style="color: var(--primary);">Back to standings</a>
      </p>
    `;
    return;
  }

  const match = matchDoc.data();

  // Only show non-completed matches to staff
  if (match.status !== 'completed' && !isStaff) {
    matchContainer.innerHTML = `
      <p style="text-align: center; color: var(--text-dim); padding: 40px 0;">
        This match is still in progress.
        <a href="/" style="color: var(--primary);">Back to standings</a>
      </p>
    `;
    return;
  }

  // If match is in-progress or banpick and user is staff, redirect to battle page
  if (match.status !== 'completed' && isStaff) {
    window.location.href = `/battle?id=${matchId}`;
    return;
  }

  const isTeamAWinner = match.winner === match.teamA;
  const tagA = match.teamATag ? ` [${match.teamATag}]` : '';
  const tagB = match.teamBTag ? ` [${match.teamBTag}]` : '';

  document.title = `${match.teamAName} vs ${match.teamBName} — IU Team Battles`;

  const dateStr = match.date?.toDate
    ? match.date.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  let html = `
    <div class="match-detail-header">
      <div class="match-detail-teams">
        <span class="match-detail-team ${isTeamAWinner ? 'winner' : ''}">${match.teamAName}${tagA}</span>
        <span class="match-detail-score">${match.score?.teamA ?? 0} — ${match.score?.teamB ?? 0}</span>
        <span class="match-detail-team ${!isTeamAWinner ? 'winner' : ''}">${match.teamBName}${tagB}</span>
      </div>
      <p style="color: var(--text-dim);">${match.format} — ${dateStr}</p>
    </div>
  `;

  // Map breakdown — prefer mapResults (from battle), fall back to maps (from quick-log)
  const mapResults = match.mapResults || match.maps || [];

  if (mapResults.length > 0) {
    html += '<h3 class="section-header">Map Breakdown</h3>';

    mapResults.forEach((map, i) => {
      const mapWinnerId = map.mapWinner;
      const mapWinnerName = mapWinnerId === match.teamA ? match.teamAName : mapWinnerId === match.teamB ? match.teamBName : '—';
      const mapWinnerSide = mapWinnerId === match.teamA ? 'team-a' : 'team-b';

      const typeLabel = map.type === 'home_a' ? `${match.teamAName} Home`
        : map.type === 'home_b' ? `${match.teamBName} Home`
        : map.type === 'decider' ? 'Decider'
        : '';

      // Race results
      let racesHtml = '';

      if (map.uphillWinner) {
        const uphillName = map.uphillWinner === match.teamA ? match.teamAName : match.teamBName;
        racesHtml += `
          <div class="race-result">
            <div class="race-label">Uphill</div>
            <div class="race-winner">${uphillName}</div>
          </div>`;
      }

      if (map.downhillWinner) {
        const downhillName = map.downhillWinner === match.teamA ? match.teamAName : match.teamBName;
        racesHtml += `
          <div class="race-result">
            <div class="race-label">Downhill</div>
            <div class="race-winner">${downhillName}</div>
          </div>`;
      }

      if (map.tiebreaker) {
        const tiebreakerName = map.tiebreaker === match.teamA ? match.teamAName : match.teamBName;
        racesHtml += `
          <div class="race-result">
            <div class="race-label">Tiebreaker</div>
            <div class="race-winner">${tiebreakerName}</div>
          </div>`;
      }

      html += `
        <div class="map-card">
          <div class="map-card-header">
            <span class="map-name">Map ${i + 1}: ${map.mapName || '—'}</span>
            ${typeLabel ? `<span style="color:var(--text-mute);font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;">${typeLabel}</span>` : ''}
            ${mapWinnerId ? `<span class="map-winner-badge ${mapWinnerSide}">${mapWinnerName}</span>` : ''}
          </div>
          ${racesHtml ? `<div class="map-races">${racesHtml}</div>` : ''}
        </div>
      `;
    });
  }

  // Notes
  if (match.notes) {
    html += `
      <div style="margin-top: 24px; padding: 16px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 8px;">
        <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 2px; color: var(--text-dim); margin-bottom: 8px;">Notes</div>
        <p style="color: var(--text-muted);">${match.notes}</p>
      </div>
    `;
  }

  html += `
    <div style="text-align: center; margin-top: 40px;">
      <a href="/" style="color: var(--primary); text-decoration: none; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 2px;">
        &larr; Back to Standings
      </a>
    </div>
  `;

  matchContainer.innerHTML = html;
}
