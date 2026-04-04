import './nav.js';
import { db, doc, getDoc } from './firebase.js';

const matchContainer = document.getElementById('matchContainer');

const params = new URLSearchParams(window.location.search);
const matchId = params.get('id');

if (!matchId) {
  window.location.href = '/';
}

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
  const isTeamAWinner = match.winner === match.teamA;

  document.title = `${match.teamAName} vs ${match.teamBName} — IU Team Battles`;

  const dateStr = match.date?.toDate
    ? match.date.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  let html = `
    <div class="match-detail-header">
      <div class="match-detail-teams">
        <span class="match-detail-team ${isTeamAWinner ? 'winner' : ''}">${match.teamAName}</span>
        <span class="match-detail-score">${match.score?.teamA ?? 0} — ${match.score?.teamB ?? 0}</span>
        <span class="match-detail-team ${!isTeamAWinner ? 'winner' : ''}">${match.teamBName}</span>
      </div>
      <p style="color: var(--text-dim);">${match.format} — ${dateStr}</p>
    </div>
  `;

  // Map breakdown
  if (match.maps && match.maps.length > 0) {
    html += '<h3 class="section-header">Map Breakdown</h3>';

    match.maps.forEach((map, i) => {
      const mapWinnerName = map.mapWinner === match.teamA ? match.teamAName : match.teamBName;
      const mapWinnerSide = map.mapWinner === match.teamA ? 'team-a' : 'team-b';

      const uphillWinnerName = map.uphillWinner === match.teamA ? match.teamAName : match.teamBName;
      const downhillWinnerName = map.downhillWinner === match.teamA ? match.teamAName : match.teamBName;

      html += `
        <div class="map-card">
          <div class="map-card-header">
            <span class="map-name">Map ${i + 1}: ${map.mapName}</span>
            <span class="map-winner-badge ${mapWinnerSide}">${mapWinnerName}${map.tiebreaker ? ' (tiebreaker: ' + map.tiebreaker + ')' : ''}</span>
          </div>
          <div class="map-races">
            <div class="race-result">
              <div class="race-label">Downhill</div>
              <div class="race-winner">${downhillWinnerName}</div>
              ${map.drivers ? `
                <div class="race-drivers">
                  ${match.teamAName}: ${map.drivers.teamA?.downhill || '?'} vs ${match.teamBName}: ${map.drivers.teamB?.downhill || '?'}
                </div>
              ` : ''}
            </div>
            <div class="race-result">
              <div class="race-label">Uphill</div>
              <div class="race-winner">${uphillWinnerName}</div>
              ${map.drivers ? `
                <div class="race-drivers">
                  ${match.teamAName}: ${map.drivers.teamA?.uphill || '?'} vs ${match.teamBName}: ${map.drivers.teamB?.uphill || '?'}
                </div>
              ` : ''}
            </div>
          </div>
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

loadMatch();
