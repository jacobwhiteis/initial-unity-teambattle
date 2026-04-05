import './nav.js';
import { db, collection, doc, getDoc, getDocs, query, orderBy, where } from './firebase.js';
import { getTier } from './crp.js';

const teamTitle = document.getElementById('teamTitle');
const teamStats = document.getElementById('teamStats');
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

  const wins = standings?.wins || 0;
  const losses = standings?.losses || 0;
  const winPct = (wins + losses > 0) ? Math.round((wins / (wins + losses)) * 100) : 0;
  const streak = standings
    ? standings.streak > 0
      ? `W${standings.streak}`
      : standings.streak < 0
        ? `L${Math.abs(standings.streak)}`
        : '-'
    : '-';
  const streakClass = standings?.streak > 0 ? 'streak-pos' : standings?.streak < 0 ? 'streak-neg' : '';

  const tier = standings ? getTier(standings.position) : 'Unranked';
  const posStr = standings?.position ? `#${standings.position}` : '-';
  const mapWins = standings?.mapWins || 0;
  const mapLosses = standings?.mapLosses || 0;

  if (standings) {
    const rateClass = winPct >= 60 ? 'rate-high' : winPct >= 40 ? 'rate-mid' : 'rate-low';

    teamStats.innerHTML = `
      <div class="team-profile-stats">
        <div class="profile-stats-primary">
          <div class="profile-stat profile-stat-pos">
            <span class="profile-stat-value">${posStr}</span>
            <span class="profile-stat-label">Position</span>
          </div>
          <div class="profile-stat profile-stat-tier">
            <span class="profile-stat-value"><span class="tier-badge tier-${tier}">${tier}</span></span>
            <span class="profile-stat-label">Tier</span>
          </div>
          <div class="profile-stat profile-stat-crp">
            <span class="profile-stat-value">${standings.crp || 0}</span>
            <span class="profile-stat-label">CRP</span>
          </div>
        </div>
        <div class="profile-stats-secondary">
          <div class="profile-stat">
            <span class="profile-stat-value"><span class="w">${wins}</span><span style="color:var(--text-mute);margin:0 .15em;">-</span><span class="l">${losses}</span></span>
            <span class="profile-stat-label">Record</span>
          </div>
          <div class="profile-stat profile-stat-winrate">
            <span class="profile-stat-value">${winPct}%</span>
            <span class="profile-stat-label">Win Rate</span>
            <div class="winrate-bar-track"><div class="winrate-bar-fill ${rateClass}" style="width:${winPct}%"></div></div>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value"><span class="w">${mapWins}</span><span style="color:var(--text-mute);margin:0 .15em;">-</span><span class="l">${mapLosses}</span></span>
            <span class="profile-stat-label">Maps</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value ${streakClass}">${streak}</span>
            <span class="profile-stat-label">Streak</span>
          </div>
        </div>
      </div>
    `;
  } else {
    teamStats.innerHTML = '<p style="color:var(--text-dim);margin-top:.5rem;">No matches played</p>';
  }

  // Get matches for this team (only completed)
  let allMatches = [];
  try {
    const matchesA = await getDocs(query(
      collection(db, 'matches'),
      where('teamA', '==', team.id)
    ));
    const matchesB = await getDocs(query(
      collection(db, 'matches'),
      where('teamB', '==', team.id)
    ));

    allMatches = [
      ...matchesA.docs.map(d => ({ id: d.id, ...d.data() })),
      ...matchesB.docs.map(d => ({ id: d.id, ...d.data() }))
    ].filter(m => m.status === 'completed')
     .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
  } catch (e) {
    console.error('Failed to load matches:', e);
  }

  // Render
  let html = '';

  // Roster
  if (team.roster && team.roster.length > 0) {
    html += '<h3 class="section-header">Roster</h3>';
    html += '<div class="roster-grid">';
    team.roster.forEach(player => {
      const roleLabel = player.role === 'Leader' ? ' ★' : player.role === 'Co-Leader' ? ' ☆' : '';
      const carLabel = player.car ? ` · ${player.car}` : '';
      html += `<span class="roster-player">${player.name}${roleLabel}${carLabel}</span>`;
    });
    html += '</div>';
  }

  // Coaches
  const teamStaff = team.teamStaff || [];
  if (teamStaff.length > 0) {
    html += '<h3 class="section-header">Coaches</h3>';
    html += '<div class="roster-grid">';
    teamStaff.forEach(s => {
      html += `<span class="roster-player">${s.name}</span>`;
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
      const mapList = match.mapResults?.length ? match.mapResults : match.maps || [];
      const mapNames = mapList.filter(m => m.mapWinner != null).map(m => m.mapName).join(', ');

      html += `
        <div class="match-card" onclick="window.location.href='/match?id=${match.id}'">
          <div class="match-teams">
            <span class="match-team ${isTeamAWinner ? 'winner' : 'loser'}">${match.teamAName}${tagA}</span>
            <span class="match-score">${match.score?.teamA ?? 0} — ${match.score?.teamB ?? 0}</span>
            <span class="match-team ${!isTeamAWinner ? 'winner' : 'loser'}">${match.teamBName}${tagB}</span>
          </div>
          <div class="match-meta">
            ${mapNames ? `<span class="match-maps">${mapNames}</span>` : ''}
            <span class="match-date">${dateStr}</span>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  teamContainer.innerHTML = html;
}

loadTeam();
