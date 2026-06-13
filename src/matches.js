import './nav.js';
import { db, collection, query, orderBy, onSnapshot } from './firebase.js';

// ---------------------------------------------------------------------------
// Battle History — all completed team battles this season
// ---------------------------------------------------------------------------

const matchesContainer = document.getElementById('matchesContainer');

const matchesQuery = query(
  collection(db, 'matches'),
  orderBy('date', 'desc')
);

onSnapshot(matchesQuery, (snapshot) => {
  const completed = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(m => m.status === 'completed');

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
        <span class="match-score">${match.score?.teamA ?? 0} — ${match.score?.teamB ?? 0}</span>
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
