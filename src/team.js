import './nav.js';
import { db, collection, doc, getDoc, getDocs, query, orderBy, where } from './firebase.js';
import { getTier } from './crp.js';

const teamTitle = document.getElementById('teamTitle');
const teamSubtitle = document.getElementById('teamSubtitle');
const teamContainer = document.getElementById('teamContainer');

const params = new URLSearchParams(window.location.search);
const teamTag = params.get('t');

if (!teamTag) {
  window.location.href = '/';
}

async function loadTeam() {
  // Find team by tag
  const teamsQuery = query(collection(db, 'teams'), where('tag', '==', teamTag.toUpperCase()));
  const teamsSnapshot = await getDocs(teamsQuery);

  if (teamsSnapshot.empty) {
    teamTitle.textContent = 'Team Not Found';
    teamContainer.innerHTML = `
      <p style="text-align: center; color: var(--text-dim); padding: 40px 0;">
        No team with tag "${teamTag}" found.
        <a href="/" style="color: var(--primary);">Back to standings</a>
      </p>
    `;
    return;
  }

  const teamDoc = teamsSnapshot.docs[0];
  const team = { id: teamDoc.id, ...teamDoc.data() };

  // Get standings for this team
  const standingsDoc = await getDoc(doc(db, 'standings', team.id));
  const standings = standingsDoc.exists() ? standingsDoc.data() : null;

  // Update page title
  teamTitle.innerHTML = `<span>${team.tag}</span> ${team.name}`;
  document.title = `${team.name} [${team.tag}] — IU Team Battles`;

  const winPct = standings && (standings.wins + standings.losses > 0)
    ? Math.round((standings.wins / (standings.wins + standings.losses)) * 100)
    : 0;
  const streak = standings
    ? standings.streak > 0
      ? `W${standings.streak}`
      : standings.streak < 0
        ? `L${Math.abs(standings.streak)}`
        : '-'
    : '-';

  const tier = standings ? getTier(standings.position) : 'Unranked';
  const posStr = standings?.position ? `#${standings.position}` : 'Unranked';

  teamSubtitle.textContent = standings
    ? `${posStr} · ${tier} — ${standings.wins}W ${standings.losses}L (${winPct}%) — ${streak} streak — ${standings.crp || 0} CRP`
    : 'No matches played';

  // Get matches for this team (only completed)
  const matchesA = await getDocs(query(
    collection(db, 'matches'),
    where('teamA', '==', team.id),
    orderBy('date', 'desc')
  ));
  const matchesB = await getDocs(query(
    collection(db, 'matches'),
    where('teamB', '==', team.id),
    orderBy('date', 'desc')
  ));

  const allMatches = [
    ...matchesA.docs.map(d => ({ id: d.id, ...d.data() })),
    ...matchesB.docs.map(d => ({ id: d.id, ...d.data() }))
  ].filter(m => m.status === 'completed')
   .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

  // Render
  let html = '';

  // Roster
  if (team.roster && team.roster.length > 0) {
    html += '<h3 class="section-header">Roster</h3>';
    html += '<div class="roster-grid">';
    team.roster.forEach(player => {
      const roleLabel = player.role === 'Leader' ? ' ★' : player.role === 'Co-Leader' ? ' ☆' : '';
      html += `<span class="roster-player">${player.name}${roleLabel}</span>`;
    });
    html += '</div>';
  }

  // Match history
  html += '<h3 class="section-header">Match History</h3>';

  if (allMatches.length === 0) {
    html += '<p style="color: var(--text-dim);">No matches recorded yet</p>';
  } else {
    html += '<div style="display: flex; flex-direction: column; gap: 10px;">';
    allMatches.forEach(match => {
      const isTeamAWinner = match.winner === match.teamA;
      const dateStr = match.date?.toDate
        ? match.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
      const tagA = match.teamATag ? ` [${match.teamATag}]` : '';
      const tagB = match.teamBTag ? ` [${match.teamBTag}]` : '';

      html += `
        <div class="match-card" onclick="window.location.href='/match?id=${match.id}'">
          <div class="match-teams">
            <span class="match-team ${isTeamAWinner ? 'winner' : 'loser'}">${match.teamAName}${tagA}</span>
            <span class="match-score">${match.score?.teamA ?? 0} — ${match.score?.teamB ?? 0}</span>
            <span class="match-team ${!isTeamAWinner ? 'winner' : 'loser'}">${match.teamBName}${tagB}</span>
          </div>
          <span class="match-date">${dateStr}</span>
        </div>
      `;
    });
    html += '</div>';
  }

  teamContainer.innerHTML = html;
}

loadTeam();
