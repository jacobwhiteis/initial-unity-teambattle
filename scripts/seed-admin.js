import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize with project ID — uses Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS
const app = initializeApp({ projectId: 'iur-teambattle' });
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// Team data
// ---------------------------------------------------------------------------

const teams = [
  {
    id: 'mtd', name: 'Mountain Drifters', tag: 'MTD',
    captainDiscordId: '100000000000000001',
    roster: [
      { name: 'Takumi', role: 'Leader' },
      { name: 'Itsuki', role: 'Member' },
      { name: 'Kenji', role: 'Member' },
    ],
    active: true,
  },
  {
    id: 'nkr', name: 'Night Racers', tag: 'NKR',
    captainDiscordId: '200000000000000001',
    roster: [
      { name: 'Nakazato', role: 'Leader' },
      { name: 'Shingo', role: 'Co-Leader' },
      { name: 'Sayuki', role: 'Member' },
    ],
    active: true,
  },
  {
    id: 'akg', name: 'Akagi Ghosts', tag: 'AKG',
    captainDiscordId: '300000000000000001',
    roster: [
      { name: 'Ryosuke', role: 'Leader' },
      { name: 'Keisuke', role: 'Co-Leader' },
    ],
    active: true,
  },
  {
    id: 'pjd', name: 'Project Downhill', tag: 'PJD',
    captainDiscordId: '400000000000000001',
    roster: [
      { name: 'Tomoyuki', role: 'Leader' },
      { name: 'Kai', role: 'Co-Leader' },
      { name: 'Wataru', role: 'Member' },
      { name: 'Sakamoto', role: 'Member' },
    ],
    active: true,
  },
  {
    id: 'sst', name: 'Speed Stars', tag: 'SST',
    captainDiscordId: '500000000000000001',
    roster: [
      { name: 'Iketani', role: 'Leader' },
      { name: 'Yuichi', role: 'Co-Leader' },
    ],
    active: true,
  },
  {
    id: 'emp', name: 'Emperors', tag: 'EMP',
    captainDiscordId: '600000000000000001',
    roster: [
      { name: 'Sudo', role: 'Leader' },
      { name: 'Kyoichi', role: 'Co-Leader' },
      { name: 'Seiji', role: 'Member' },
    ],
    active: true,
  },
  {
    id: 'ibl', name: 'Impact Blue', tag: 'IBL',
    captainDiscordId: '700000000000000001',
    roster: [
      { name: 'Mako', role: 'Leader' },
      { name: 'Sayuki', role: 'Co-Leader' },
    ],
    active: true,
  },
  {
    id: 'tsj', name: 'Tsuchisaka Junction', tag: 'TSJ',
    captainDiscordId: '800000000000000001',
    roster: [
      { name: 'Go', role: 'Leader' },
      { name: 'Shinigami', role: 'Member' },
    ],
    active: true,
  },
  {
    id: 'tds', name: 'Todo School', tag: 'TDS',
    captainDiscordId: '900000000000000001',
    roster: [
      { name: 'Daiki', role: 'Leader' },
      { name: 'Smiley', role: 'Member' },
    ],
    active: true,
  },
  {
    id: 'sbr', name: 'Sideburns Racing', tag: 'SBR',
    captainDiscordId: '110000000000000001',
    roster: [
      { name: 'Hojo', role: 'Leader' },
      { name: 'Fumihiro', role: 'Member' },
    ],
    active: true,
  },
  {
    id: 'rns', name: 'Rotary Nation', tag: 'RNS',
    captainDiscordId: '120000000000000001',
    roster: [
      { name: 'Amemiya', role: 'Leader' },
      { name: 'Kosuke', role: 'Member' },
    ],
    active: true,
  },
  {
    id: 'nwc', name: 'Night Wolves Crew', tag: 'NWC',
    captainDiscordId: '130000000000000001',
    roster: [
      { name: 'Rin', role: 'Leader' },
    ],
    active: true,
  },
];

// Tag map
const tagMap = {};
teams.forEach(t => { tagMap[t.id] = t.tag; });

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function ts(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return Timestamp.fromDate(d);
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

const standings = [
  { id: 'mtd', teamName: 'Mountain Drifters', teamTag: 'MTD', wins: 14, losses: 3, mapWins: 32, mapLosses: 12, winRate: 82, streak: 5, rank: 1, crp: 287, position: 1, consecutive_wins: 5, roster: teams.find(t => t.id === 'mtd').roster, lastMatchDate: ts(1), match_history: [
    { opponent: 'Night Racers', result: 'Win', crp_gained: 25, home_map_bonus: false, streak_bonus: 0, pos_before: 1, pos_after: 1, timestamp: ts(1) },
    { opponent: 'Emperors', result: 'Win', crp_gained: 8, home_map_bonus: true, streak_bonus: 12, pos_before: 1, pos_after: 1, timestamp: ts(4) },
    { opponent: 'Akagi Ghosts', result: 'Win', crp_gained: 20, home_map_bonus: false, streak_bonus: 0, pos_before: 1, pos_after: 1, timestamp: ts(8) },
    { opponent: 'Speed Stars', result: 'Loss', crp_gained: 7, home_map_bonus: false, streak_bonus: 0, pos_before: 1, pos_after: 1, timestamp: ts(14) },
    { opponent: 'Impact Blue', result: 'Win', crp_gained: 6, home_map_bonus: false, streak_bonus: 0, pos_before: 1, pos_after: 1, timestamp: ts(18) },
  ]},
  { id: 'akg', teamName: 'Akagi Ghosts', teamTag: 'AKG', wins: 12, losses: 4, mapWins: 28, mapLosses: 14, winRate: 75, streak: 2, rank: 2, crp: 243, position: 2, consecutive_wins: 2, roster: teams.find(t => t.id === 'akg').roster, lastMatchDate: ts(2), match_history: [
    { opponent: 'Project Downhill', result: 'Win', crp_gained: 15, home_map_bonus: false, streak_bonus: 0, pos_before: 2, pos_after: 2, timestamp: ts(2) },
    { opponent: 'Night Racers', result: 'Win', crp_gained: 25, home_map_bonus: true, streak_bonus: 0, pos_before: 3, pos_after: 2, timestamp: ts(6) },
    { opponent: 'Mountain Drifters', result: 'Loss', crp_gained: 22, home_map_bonus: false, streak_bonus: 0, pos_before: 2, pos_after: 2, timestamp: ts(8) },
  ]},
  { id: 'nkr', teamName: 'Night Racers', teamTag: 'NKR', wins: 11, losses: 5, mapWins: 26, mapLosses: 16, winRate: 69, streak: -1, rank: 3, crp: 221, position: 3, consecutive_wins: 0, roster: teams.find(t => t.id === 'nkr').roster, lastMatchDate: ts(1), match_history: [
    { opponent: 'Mountain Drifters', result: 'Loss', crp_gained: 22, home_map_bonus: false, streak_bonus: 0, pos_before: 2, pos_after: 3, timestamp: ts(1) },
    { opponent: 'Speed Stars', result: 'Win', crp_gained: 10, home_map_bonus: false, streak_bonus: 0, pos_before: 2, pos_after: 2, timestamp: ts(5) },
    { opponent: 'Akagi Ghosts', result: 'Loss', crp_gained: 16, home_map_bonus: true, streak_bonus: 0, pos_before: 2, pos_after: 3, timestamp: ts(6) },
  ]},
  { id: 'pjd', teamName: 'Project Downhill', teamTag: 'PJD', wins: 10, losses: 5, mapWins: 24, mapLosses: 15, winRate: 67, streak: 3, rank: 4, crp: 198, position: 4, consecutive_wins: 3, roster: teams.find(t => t.id === 'pjd').roster, lastMatchDate: ts(2), match_history: [
    { opponent: 'Akagi Ghosts', result: 'Loss', crp_gained: 16, home_map_bonus: false, streak_bonus: 0, pos_before: 4, pos_after: 4, timestamp: ts(2) },
    { opponent: 'Todo School', result: 'Win', crp_gained: 3, home_map_bonus: false, streak_bonus: 0, pos_before: 4, pos_after: 4, timestamp: ts(7) },
  ]},
  { id: 'emp', teamName: 'Emperors', teamTag: 'EMP', wins: 9, losses: 6, mapWins: 22, mapLosses: 17, winRate: 60, streak: 1, rank: 5, crp: 176, position: 5, consecutive_wins: 1, roster: teams.find(t => t.id === 'emp').roster, lastMatchDate: ts(3), match_history: [
    { opponent: 'Sideburns Racing', result: 'Win', crp_gained: 3, home_map_bonus: false, streak_bonus: 0, pos_before: 5, pos_after: 5, timestamp: ts(3) },
    { opponent: 'Mountain Drifters', result: 'Loss', crp_gained: 22, home_map_bonus: true, streak_bonus: 0, pos_before: 5, pos_after: 5, timestamp: ts(4) },
  ]},
  { id: 'sst', teamName: 'Speed Stars', teamTag: 'SST', wins: 8, losses: 7, mapWins: 20, mapLosses: 18, winRate: 53, streak: -2, rank: 6, crp: 152, position: 6, consecutive_wins: 0, roster: teams.find(t => t.id === 'sst').roster, lastMatchDate: ts(5), match_history: [
    { opponent: 'Night Racers', result: 'Loss', crp_gained: 12, home_map_bonus: false, streak_bonus: 0, pos_before: 5, pos_after: 6, timestamp: ts(5) },
    { opponent: 'Mountain Drifters', result: 'Win', crp_gained: 32, home_map_bonus: false, streak_bonus: 0, pos_before: 6, pos_after: 5, timestamp: ts(14) },
  ]},
  { id: 'ibl', teamName: 'Impact Blue', teamTag: 'IBL', wins: 7, losses: 8, mapWins: 18, mapLosses: 20, winRate: 47, streak: -1, rank: 7, crp: 124, position: 7, consecutive_wins: 0, roster: teams.find(t => t.id === 'ibl').roster, lastMatchDate: ts(9), match_history: [
    { opponent: 'Tsuchisaka Junction', result: 'Loss', crp_gained: 4, home_map_bonus: false, streak_bonus: 0, pos_before: 7, pos_after: 7, timestamp: ts(9) },
  ]},
  { id: 'rns', teamName: 'Rotary Nation', teamTag: 'RNS', wins: 6, losses: 8, mapWins: 16, mapLosses: 20, winRate: 43, streak: 2, rank: 8, crp: 98, position: 8, consecutive_wins: 2, roster: teams.find(t => t.id === 'rns').roster, lastMatchDate: ts(6), match_history: [
    { opponent: 'Todo School', result: 'Win', crp_gained: 3, home_map_bonus: false, streak_bonus: 0, pos_before: 9, pos_after: 8, timestamp: ts(6) },
  ]},
  { id: 'tsj', teamName: 'Tsuchisaka Junction', teamTag: 'TSJ', wins: 5, losses: 9, mapWins: 14, mapLosses: 22, winRate: 36, streak: 1, rank: 9, crp: 82, position: 9, consecutive_wins: 1, roster: teams.find(t => t.id === 'tsj').roster, lastMatchDate: ts(9), match_history: [
    { opponent: 'Impact Blue', result: 'Win', crp_gained: 6, home_map_bonus: false, streak_bonus: 0, pos_before: 9, pos_after: 9, timestamp: ts(9) },
  ]},
  { id: 'tds', teamName: 'Todo School', teamTag: 'TDS', wins: 4, losses: 10, mapWins: 12, mapLosses: 24, winRate: 29, streak: -3, rank: 10, crp: 64, position: 10, consecutive_wins: 0, roster: teams.find(t => t.id === 'tds').roster, lastMatchDate: ts(6), match_history: [
    { opponent: 'Rotary Nation', result: 'Loss', crp_gained: 4, home_map_bonus: false, streak_bonus: 0, pos_before: 8, pos_after: 10, timestamp: ts(6) },
  ]},
  { id: 'sbr', teamName: 'Sideburns Racing', teamTag: 'SBR', wins: 5, losses: 8, mapWins: 14, mapLosses: 20, winRate: 38, streak: -1, rank: 11, crp: 71, position: 11, consecutive_wins: 0, roster: teams.find(t => t.id === 'sbr').roster, lastMatchDate: ts(3), match_history: [
    { opponent: 'Emperors', result: 'Loss', crp_gained: 7, home_map_bonus: false, streak_bonus: 0, pos_before: 11, pos_after: 11, timestamp: ts(3) },
  ]},
  { id: 'nwc', teamName: 'Night Wolves Crew', teamTag: 'NWC', wins: 2, losses: 10, mapWins: 8, mapLosses: 24, winRate: 17, streak: -4, rank: 12, crp: 38, position: 12, consecutive_wins: 0, roster: teams.find(t => t.id === 'nwc').roster, lastMatchDate: ts(10), match_history: [
    { opponent: 'Emperors', result: 'Loss', crp_gained: 7, home_map_bonus: false, streak_bonus: 0, pos_before: 11, pos_after: 12, timestamp: ts(10) },
  ]},
];

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

const matches = [
  { id: 'match_001', teamA: 'mtd', teamB: 'nkr', teamAName: 'Mountain Drifters', teamBName: 'Night Racers', format: 'BO3', status: 'completed', winner: 'mtd', score: { teamA: 2, teamB: 1 },
    mapResults: [
      { mapName: 'Akina', mapId: 0, type: 'home_a', uphillWinner: 'mtd', downhillWinner: 'mtd', tiebreaker: null, mapWinner: 'mtd' },
      { mapName: 'Akagi', mapId: 4, type: 'home_b', uphillWinner: 'nkr', downhillWinner: 'mtd', tiebreaker: 'nkr', mapWinner: 'nkr' },
      { mapName: 'Usui', mapId: 5, type: 'decider', uphillWinner: 'mtd', downhillWinner: 'mtd', tiebreaker: null, mapWinner: 'mtd' },
    ],
    date: ts(1), recordedBy: 'admin', notes: 'Takumi clutched on Usui to close it out' },
  { id: 'match_002', teamA: 'akg', teamB: 'pjd', teamAName: 'Akagi Ghosts', teamBName: 'Project Downhill', format: 'BO3', status: 'completed', winner: 'akg', score: { teamA: 2, teamB: 1 },
    mapResults: [
      { mapName: 'Akagi', mapId: 4, type: 'home_a', uphillWinner: 'akg', downhillWinner: 'akg', tiebreaker: null, mapWinner: 'akg' },
      { mapName: 'Irohazaka', mapId: 3, type: 'home_b', uphillWinner: 'pjd', downhillWinner: 'pjd', tiebreaker: null, mapWinner: 'pjd' },
      { mapName: 'Myogi', mapId: 6, type: 'decider', uphillWinner: 'akg', downhillWinner: 'pjd', tiebreaker: 'akg', mapWinner: 'akg' },
    ],
    date: ts(2), recordedBy: 'admin', notes: 'Ryosuke won the tiebreaker on Myogi' },
  { id: 'match_003', teamA: 'emp', teamB: 'sbr', teamAName: 'Emperors', teamBName: 'Sideburns Racing', format: 'BO3', status: 'completed', winner: 'emp', score: { teamA: 2, teamB: 0 },
    mapResults: [
      { mapName: 'Irohazaka', mapId: 3, type: 'home_a', uphillWinner: 'emp', downhillWinner: 'emp', tiebreaker: null, mapWinner: 'emp' },
      { mapName: 'Akagi', mapId: 4, type: 'home_b', uphillWinner: 'emp', downhillWinner: 'sbr', tiebreaker: 'emp', mapWinner: 'emp' },
    ],
    date: ts(3), recordedBy: 'admin', notes: '' },
  { id: 'match_004', teamA: 'mtd', teamB: 'emp', teamAName: 'Mountain Drifters', teamBName: 'Emperors', format: 'BO3', status: 'completed', winner: 'mtd', score: { teamA: 2, teamB: 0 },
    mapResults: [
      { mapName: 'Akina', mapId: 0, type: 'home_a', uphillWinner: 'mtd', downhillWinner: 'mtd', tiebreaker: null, mapWinner: 'mtd' },
      { mapName: 'Irohazaka', mapId: 3, type: 'home_b', uphillWinner: 'mtd', downhillWinner: 'emp', tiebreaker: 'mtd', mapWinner: 'mtd' },
    ],
    date: ts(4), recordedBy: 'admin', notes: 'MTD dominated 2-0' },
  { id: 'match_005', teamA: 'nkr', teamB: 'sst', teamAName: 'Night Racers', teamBName: 'Speed Stars', format: 'BO3', status: 'completed', winner: 'nkr', score: { teamA: 2, teamB: 1 },
    mapResults: [
      { mapName: 'Myogi', mapId: 6, type: 'home_a', uphillWinner: 'sst', downhillWinner: 'sst', tiebreaker: null, mapWinner: 'sst' },
      { mapName: 'Akagi', mapId: 4, type: 'home_b', uphillWinner: 'nkr', downhillWinner: 'nkr', tiebreaker: null, mapWinner: 'nkr' },
      { mapName: 'Usui', mapId: 5, type: 'decider', uphillWinner: 'nkr', downhillWinner: 'sst', tiebreaker: 'nkr', mapWinner: 'nkr' },
    ],
    date: ts(5), recordedBy: 'admin', notes: 'Nakazato won the Usui tiebreaker' },
  { id: 'match_006', teamA: 'akg', teamB: 'nkr', teamAName: 'Akagi Ghosts', teamBName: 'Night Racers', format: 'BO3', status: 'completed', winner: 'akg', score: { teamA: 2, teamB: 0 },
    mapResults: [
      { mapName: 'Akagi', mapId: 4, type: 'home_a', uphillWinner: 'akg', downhillWinner: 'akg', tiebreaker: null, mapWinner: 'akg' },
      { mapName: 'Usui', mapId: 5, type: 'home_b', uphillWinner: 'akg', downhillWinner: 'akg', tiebreaker: null, mapWinner: 'akg' },
    ],
    date: ts(6), recordedBy: 'admin', notes: 'AKG took position #2 from NKR' },
  { id: 'match_007', teamA: 'rns', teamB: 'tds', teamAName: 'Rotary Nation', teamBName: 'Todo School', format: 'BO3', status: 'completed', winner: 'rns', score: { teamA: 2, teamB: 0 },
    mapResults: [
      { mapName: 'Sadamine', mapId: 7, type: 'home_a', uphillWinner: 'rns', downhillWinner: 'rns', tiebreaker: null, mapWinner: 'rns' },
      { mapName: 'Akina', mapId: 0, type: 'home_b', uphillWinner: 'rns', downhillWinner: 'tds', tiebreaker: 'rns', mapWinner: 'rns' },
    ],
    date: ts(6), recordedBy: 'admin', notes: '' },
  { id: 'match_008', teamA: 'pjd', teamB: 'tds', teamAName: 'Project Downhill', teamBName: 'Todo School', format: 'BO3', status: 'completed', winner: 'pjd', score: { teamA: 2, teamB: 0 },
    mapResults: [
      { mapName: 'Irohazaka', mapId: 3, type: 'home_a', uphillWinner: 'pjd', downhillWinner: 'pjd', tiebreaker: null, mapWinner: 'pjd' },
      { mapName: 'Tsuchisaka', mapId: 1, type: 'home_b', uphillWinner: 'pjd', downhillWinner: 'tds', tiebreaker: 'pjd', mapWinner: 'pjd' },
    ],
    date: ts(7), recordedBy: 'admin', notes: '' },
  { id: 'match_009', teamA: 'mtd', teamB: 'akg', teamAName: 'Mountain Drifters', teamBName: 'Akagi Ghosts', format: 'BO3', status: 'completed', winner: 'mtd', score: { teamA: 2, teamB: 1 },
    mapResults: [
      { mapName: 'Akina', mapId: 0, type: 'home_a', uphillWinner: 'mtd', downhillWinner: 'akg', tiebreaker: 'mtd', mapWinner: 'mtd' },
      { mapName: 'Akagi', mapId: 4, type: 'home_b', uphillWinner: 'akg', downhillWinner: 'akg', tiebreaker: null, mapWinner: 'akg' },
      { mapName: 'Myogi', mapId: 6, type: 'decider', uphillWinner: 'mtd', downhillWinner: 'mtd', tiebreaker: null, mapWinner: 'mtd' },
    ],
    date: ts(8), recordedBy: 'admin', notes: 'Epic battle for the top spot' },
  { id: 'match_010', teamA: 'tsj', teamB: 'ibl', teamAName: 'Tsuchisaka Junction', teamBName: 'Impact Blue', format: 'BO3', status: 'completed', winner: 'tsj', score: { teamA: 2, teamB: 1 },
    mapResults: [
      { mapName: 'Tsuchisaka', mapId: 1, type: 'home_a', uphillWinner: 'tsj', downhillWinner: 'tsj', tiebreaker: null, mapWinner: 'tsj' },
      { mapName: 'Usui', mapId: 5, type: 'home_b', uphillWinner: 'ibl', downhillWinner: 'ibl', tiebreaker: null, mapWinner: 'ibl' },
      { mapName: 'Akina', mapId: 0, type: 'decider', uphillWinner: 'tsj', downhillWinner: 'ibl', tiebreaker: 'tsj', mapWinner: 'tsj' },
    ],
    date: ts(9), recordedBy: 'admin', notes: 'Go won the Akina tiebreaker' },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function clearCollection(name) {
  const snap = await db.collection(name).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  if (snap.size > 0) await batch.commit();
  console.log(`  Cleared ${snap.size} docs from ${name}`);
}

async function seed() {
  console.log('Clearing existing data...');
  await clearCollection('teams');
  await clearCollection('standings');
  await clearCollection('matches');
  await clearCollection('sessions');

  console.log('Seeding teams...');
  for (const team of teams) {
    const { id, ...data } = team;
    data.createdAt = Timestamp.now();
    await db.collection('teams').doc(id).set(data);
    console.log(`  + teams/${id}`);
  }

  console.log('Seeding standings...');
  for (const standing of standings) {
    const { id, ...data } = standing;
    await db.collection('standings').doc(id).set(data);
    console.log(`  + standings/${id}`);
  }

  console.log('Seeding matches...');
  for (const match of matches) {
    const { id, ...data } = match;
    data.teamATag = tagMap[data.teamA] || '';
    data.teamBTag = tagMap[data.teamB] || '';
    await db.collection('matches').doc(id).set(data);
    console.log(`  + matches/${id}`);
  }

  console.log(`\nDone! Seeded ${teams.length} teams, ${standings.length} standings, ${matches.length} matches`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
