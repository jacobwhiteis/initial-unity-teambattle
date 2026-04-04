import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA7kGIAULwsycGbcJa95RKwiLiEjQmFOSA",
  authDomain: "iur-teambattle.firebaseapp.com",
  projectId: "iur-teambattle",
  storageBucket: "iur-teambattle.firebasestorage.app",
  messagingSenderId: "835376362147",
  appId: "1:835376362147:web:a56478d5d516a35b278516"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// Team data
// ---------------------------------------------------------------------------

const teams = [
  {
    id: 'mtd',
    name: 'Mountain Drifters',
    tag: 'MTD',
    captainDiscordId: '100000000000000001',
    roster: [
      { name: 'Takumi', car: 'AE86', role: 'Leader', discordId: '100000000000000001' },
      { name: 'Itsuki', car: 'AE85', role: 'Member', discordId: '100000000000000002' },
      { name: 'Kenji', car: 'S14', role: 'Member', discordId: '100000000000000003' },
    ],
    active: true,
  },
  {
    id: 'nkr',
    name: 'Night Racers',
    tag: 'NKR',
    captainDiscordId: '200000000000000001',
    roster: [
      { name: 'Nakazato', car: 'BNR32', role: 'Leader', discordId: '200000000000000001' },
      { name: 'Shingo', car: 'EG6', role: 'Co-Leader', discordId: '200000000000000002' },
      { name: 'Sayuki', car: 'NA6CE', role: 'Member', discordId: '200000000000000003' },
    ],
    active: true,
  },
  {
    id: 'akg',
    name: 'Akagi Ghosts',
    tag: 'AKG',
    captainDiscordId: '300000000000000001',
    roster: [
      { name: 'Ryosuke', car: 'FC3S', role: 'Leader', discordId: '300000000000000001' },
      { name: 'Keisuke', car: 'FD3S', role: 'Co-Leader', discordId: '300000000000000002' },
    ],
    active: true,
  },
  {
    id: 'pjd',
    name: 'Project Downhill',
    tag: 'PJD',
    captainDiscordId: '400000000000000001',
    roster: [
      { name: 'Tomoyuki', car: 'CE9A', role: 'Leader', discordId: '400000000000000001' },
      { name: 'Kai', car: 'SW20', role: 'Co-Leader', discordId: '400000000000000002' },
      { name: 'Wataru', car: 'AE86', role: 'Member', discordId: '400000000000000003' },
      { name: 'Sakamoto', car: 'DC2', role: 'Member', discordId: '400000000000000004' },
    ],
    active: true,
  },
  {
    id: 'sst',
    name: 'Speed Stars',
    tag: 'SST',
    captainDiscordId: '500000000000000001',
    roster: [
      { name: 'Iketani', car: 'S14', role: 'Leader', discordId: '500000000000000001' },
      { name: 'Yuichi', car: 'RPS13', role: 'Co-Leader', discordId: '500000000000000002' },
    ],
    active: true,
  },
  {
    id: 'emp',
    name: 'Emperors',
    tag: 'EMP',
    captainDiscordId: '600000000000000001',
    roster: [
      { name: 'Sudo', car: 'CN9A', role: 'Leader', discordId: '600000000000000001' },
      { name: 'Kyoichi', car: 'CE9A', role: 'Co-Leader', discordId: '600000000000000002' },
      { name: 'Seiji', car: 'JZA80', role: 'Member', discordId: '600000000000000003' },
    ],
    active: true,
  },
  {
    id: 'ibl',
    name: 'Impact Blue',
    tag: 'IBL',
    captainDiscordId: '700000000000000001',
    roster: [
      { name: 'Mako', car: 'NA6CE', role: 'Leader', discordId: '700000000000000001' },
      { name: 'Sayuki', car: 'NA6CE', role: 'Co-Leader', discordId: '700000000000000002' },
    ],
    active: true,
  },
  {
    id: 'tsj',
    name: 'Tsuchisaka Junction',
    tag: 'TSJ',
    captainDiscordId: '800000000000000001',
    roster: [
      { name: 'Go', car: 'EA11R', role: 'Leader', discordId: '800000000000000001' },
      { name: 'Shinigami', car: 'AE86', role: 'Member', discordId: '800000000000000002' },
    ],
    active: true,
  },
  {
    id: 'tds',
    name: 'Todo School',
    tag: 'TDS',
    captainDiscordId: '900000000000000001',
    roster: [
      { name: 'Daiki', car: 'NA1', role: 'Leader', discordId: '900000000000000001' },
      { name: 'Smiley', car: 'DC2', role: 'Member', discordId: '900000000000000002' },
    ],
    active: true,
  },
  {
    id: 'sbr',
    name: 'Sideburns Racing',
    tag: 'SBR',
    captainDiscordId: '110000000000000001',
    roster: [
      { name: 'Hojo', car: 'GC8F', role: 'Leader', discordId: '110000000000000001' },
      { name: 'Fumihiro', car: 'FC3S', role: 'Member', discordId: '110000000000000002' },
    ],
    active: true,
  },
  {
    id: 'rns',
    name: 'Rotary Nation',
    tag: 'RNS',
    captainDiscordId: '120000000000000001',
    roster: [
      { name: 'Amemiya', car: 'FD3S', role: 'Leader', discordId: '120000000000000001' },
      { name: 'Kosuke', car: 'FC3S', role: 'Member', discordId: '120000000000000002' },
    ],
    active: true,
  },
  {
    id: 'nwc',
    name: 'Night Wolves Crew',
    tag: 'NWC',
    captainDiscordId: '130000000000000001',
    roster: [
      { name: 'Rin', car: 'BNR32', role: 'Leader', discordId: '130000000000000001' },
    ],
    active: true,
  },
];

// ---------------------------------------------------------------------------
// Helper: Timestamp from days ago
// ---------------------------------------------------------------------------

function ts(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return Timestamp.fromDate(d);
}

// ---------------------------------------------------------------------------
// Standings — pre-computed rankings with CRP, position, match history
// ---------------------------------------------------------------------------

const standings = [
  {
    id: 'mtd',
    teamName: 'Mountain Drifters', teamTag: 'MTD',
    wins: 14, losses: 3, mapWins: 32, mapLosses: 12, winRate: 82,
    streak: 5, rank: 1,
    crp: 287, position: 1, consecutive_wins: 5,
    roster: teams.find(t => t.id === 'mtd').roster,
    lastMatchDate: ts(1),
    match_history: [
      { opponent: 'Night Racers', result: 'Win', crp_gained: 25, home_map_bonus: false, streak_bonus: 0, pos_before: 1, pos_after: 1, timestamp: ts(1) },
      { opponent: 'Emperors', result: 'Win', crp_gained: 8, home_map_bonus: true, streak_bonus: 12, pos_before: 1, pos_after: 1, timestamp: ts(4) },
      { opponent: 'Akagi Ghosts', result: 'Win', crp_gained: 20, home_map_bonus: false, streak_bonus: 0, pos_before: 1, pos_after: 1, timestamp: ts(8) },
      { opponent: 'Speed Stars', result: 'Loss', crp_gained: 7, home_map_bonus: false, streak_bonus: 0, pos_before: 1, pos_after: 1, timestamp: ts(14) },
      { opponent: 'Impact Blue', result: 'Win', crp_gained: 6, home_map_bonus: false, streak_bonus: 0, pos_before: 1, pos_after: 1, timestamp: ts(18) },
    ],
  },
  {
    id: 'akg',
    teamName: 'Akagi Ghosts', teamTag: 'AKG',
    wins: 12, losses: 4, mapWins: 28, mapLosses: 14, winRate: 75,
    streak: 2, rank: 2,
    crp: 243, position: 2, consecutive_wins: 2,
    roster: teams.find(t => t.id === 'akg').roster,
    lastMatchDate: ts(2),
    match_history: [
      { opponent: 'Project Downhill', result: 'Win', crp_gained: 15, home_map_bonus: false, streak_bonus: 0, pos_before: 2, pos_after: 2, timestamp: ts(2) },
      { opponent: 'Night Racers', result: 'Win', crp_gained: 25, home_map_bonus: true, streak_bonus: 0, pos_before: 3, pos_after: 2, timestamp: ts(6) },
      { opponent: 'Mountain Drifters', result: 'Loss', crp_gained: 22, home_map_bonus: false, streak_bonus: 0, pos_before: 2, pos_after: 2, timestamp: ts(8) },
      { opponent: 'Emperors', result: 'Win', crp_gained: 8, home_map_bonus: false, streak_bonus: 0, pos_before: 3, pos_after: 3, timestamp: ts(15) },
    ],
  },
  {
    id: 'nkr',
    teamName: 'Night Racers', teamTag: 'NKR',
    wins: 11, losses: 5, mapWins: 26, mapLosses: 16, winRate: 69,
    streak: -1, rank: 3,
    crp: 221, position: 3, consecutive_wins: 0,
    roster: teams.find(t => t.id === 'nkr').roster,
    lastMatchDate: ts(1),
    match_history: [
      { opponent: 'Mountain Drifters', result: 'Loss', crp_gained: 22, home_map_bonus: false, streak_bonus: 0, pos_before: 2, pos_after: 3, timestamp: ts(1) },
      { opponent: 'Speed Stars', result: 'Win', crp_gained: 10, home_map_bonus: false, streak_bonus: 0, pos_before: 2, pos_after: 2, timestamp: ts(5) },
      { opponent: 'Akagi Ghosts', result: 'Loss', crp_gained: 16, home_map_bonus: true, streak_bonus: 0, pos_before: 2, pos_after: 3, timestamp: ts(6) },
      { opponent: 'Impact Blue', result: 'Win', crp_gained: 6, home_map_bonus: false, streak_bonus: 0, pos_before: 3, pos_after: 3, timestamp: ts(12) },
    ],
  },
  {
    id: 'pjd',
    teamName: 'Project Downhill', teamTag: 'PJD',
    wins: 10, losses: 5, mapWins: 24, mapLosses: 15, winRate: 67,
    streak: 3, rank: 4,
    crp: 198, position: 4, consecutive_wins: 3,
    roster: teams.find(t => t.id === 'pjd').roster,
    lastMatchDate: ts(2),
    match_history: [
      { opponent: 'Akagi Ghosts', result: 'Loss', crp_gained: 16, home_map_bonus: false, streak_bonus: 0, pos_before: 4, pos_after: 4, timestamp: ts(2) },
      { opponent: 'Todo School', result: 'Win', crp_gained: 3, home_map_bonus: false, streak_bonus: 0, pos_before: 4, pos_after: 4, timestamp: ts(7) },
      { opponent: 'Speed Stars', result: 'Win', crp_gained: 10, home_map_bonus: true, streak_bonus: 0, pos_before: 5, pos_after: 4, timestamp: ts(11) },
    ],
  },
  {
    id: 'emp',
    teamName: 'Emperors', teamTag: 'EMP',
    wins: 9, losses: 6, mapWins: 22, mapLosses: 17, winRate: 60,
    streak: 1, rank: 5,
    crp: 176, position: 5, consecutive_wins: 1,
    roster: teams.find(t => t.id === 'emp').roster,
    lastMatchDate: ts(3),
    match_history: [
      { opponent: 'Sideburns Racing', result: 'Win', crp_gained: 3, home_map_bonus: false, streak_bonus: 0, pos_before: 5, pos_after: 5, timestamp: ts(3) },
      { opponent: 'Mountain Drifters', result: 'Loss', crp_gained: 22, home_map_bonus: true, streak_bonus: 0, pos_before: 5, pos_after: 5, timestamp: ts(4) },
      { opponent: 'Night Wolves Crew', result: 'Win', crp_gained: 2, home_map_bonus: false, streak_bonus: 0, pos_before: 6, pos_after: 5, timestamp: ts(10) },
    ],
  },
  {
    id: 'sst',
    teamName: 'Speed Stars', teamTag: 'SST',
    wins: 8, losses: 7, mapWins: 20, mapLosses: 18, winRate: 53,
    streak: -2, rank: 6,
    crp: 152, position: 6, consecutive_wins: 0,
    roster: teams.find(t => t.id === 'sst').roster,
    lastMatchDate: ts(5),
    match_history: [
      { opponent: 'Night Racers', result: 'Loss', crp_gained: 12, home_map_bonus: false, streak_bonus: 0, pos_before: 5, pos_after: 6, timestamp: ts(5) },
      { opponent: 'Mountain Drifters', result: 'Win', crp_gained: 32, home_map_bonus: false, streak_bonus: 0, pos_before: 6, pos_after: 5, timestamp: ts(14) },
      { opponent: 'Todo School', result: 'Win', crp_gained: 3, home_map_bonus: true, streak_bonus: 0, pos_before: 6, pos_after: 6, timestamp: ts(20) },
    ],
  },
  {
    id: 'ibl',
    teamName: 'Impact Blue', teamTag: 'IBL',
    wins: 7, losses: 8, mapWins: 18, mapLosses: 20, winRate: 47,
    streak: -1, rank: 7,
    crp: 124, position: 7, consecutive_wins: 0,
    roster: teams.find(t => t.id === 'ibl').roster,
    lastMatchDate: ts(9),
    match_history: [
      { opponent: 'Tsuchisaka Junction', result: 'Loss', crp_gained: 4, home_map_bonus: false, streak_bonus: 0, pos_before: 7, pos_after: 7, timestamp: ts(9) },
      { opponent: 'Night Racers', result: 'Loss', crp_gained: 12, home_map_bonus: false, streak_bonus: 0, pos_before: 7, pos_after: 7, timestamp: ts(12) },
      { opponent: 'Rotary Nation', result: 'Win', crp_gained: 3, home_map_bonus: false, streak_bonus: 0, pos_before: 7, pos_after: 7, timestamp: ts(17) },
    ],
  },
  {
    id: 'rns',
    teamName: 'Rotary Nation', teamTag: 'RNS',
    wins: 6, losses: 8, mapWins: 16, mapLosses: 20, winRate: 43,
    streak: 2, rank: 8,
    crp: 98, position: 8, consecutive_wins: 2,
    roster: teams.find(t => t.id === 'rns').roster,
    lastMatchDate: ts(6),
    match_history: [
      { opponent: 'Todo School', result: 'Win', crp_gained: 3, home_map_bonus: false, streak_bonus: 0, pos_before: 9, pos_after: 8, timestamp: ts(6) },
      { opponent: 'Night Wolves Crew', result: 'Win', crp_gained: 2, home_map_bonus: true, streak_bonus: 0, pos_before: 9, pos_after: 9, timestamp: ts(13) },
      { opponent: 'Impact Blue', result: 'Loss', crp_gained: 4, home_map_bonus: false, streak_bonus: 0, pos_before: 8, pos_after: 9, timestamp: ts(17) },
    ],
  },
  {
    id: 'tsj',
    teamName: 'Tsuchisaka Junction', teamTag: 'TSJ',
    wins: 5, losses: 9, mapWins: 14, mapLosses: 22, winRate: 36,
    streak: 1, rank: 9,
    crp: 82, position: 9, consecutive_wins: 1,
    roster: teams.find(t => t.id === 'tsj').roster,
    lastMatchDate: ts(9),
    match_history: [
      { opponent: 'Impact Blue', result: 'Win', crp_gained: 6, home_map_bonus: false, streak_bonus: 0, pos_before: 9, pos_after: 9, timestamp: ts(9) },
      { opponent: 'Sideburns Racing', result: 'Loss', crp_gained: 2, home_map_bonus: false, streak_bonus: 0, pos_before: 8, pos_after: 9, timestamp: ts(16) },
    ],
  },
  {
    id: 'tds',
    teamName: 'Todo School', teamTag: 'TDS',
    wins: 4, losses: 10, mapWins: 12, mapLosses: 24, winRate: 29,
    streak: -3, rank: 10,
    crp: 64, position: 10, consecutive_wins: 0,
    roster: teams.find(t => t.id === 'tds').roster,
    lastMatchDate: ts(6),
    match_history: [
      { opponent: 'Rotary Nation', result: 'Loss', crp_gained: 4, home_map_bonus: false, streak_bonus: 0, pos_before: 8, pos_after: 10, timestamp: ts(6) },
      { opponent: 'Project Downhill', result: 'Loss', crp_gained: 9, home_map_bonus: false, streak_bonus: 0, pos_before: 9, pos_after: 9, timestamp: ts(7) },
      { opponent: 'Sideburns Racing', result: 'Win', crp_gained: 3, home_map_bonus: false, streak_bonus: 0, pos_before: 10, pos_after: 10, timestamp: ts(19) },
    ],
  },
  {
    id: 'sbr',
    teamName: 'Sideburns Racing', teamTag: 'SBR',
    wins: 5, losses: 8, mapWins: 14, mapLosses: 20, winRate: 38,
    streak: -1, rank: 11,
    crp: 71, position: 11, consecutive_wins: 0,
    roster: teams.find(t => t.id === 'sbr').roster,
    lastMatchDate: ts(3),
    match_history: [
      { opponent: 'Emperors', result: 'Loss', crp_gained: 7, home_map_bonus: false, streak_bonus: 0, pos_before: 11, pos_after: 11, timestamp: ts(3) },
      { opponent: 'Tsuchisaka Junction', result: 'Win', crp_gained: 6, home_map_bonus: false, streak_bonus: 0, pos_before: 11, pos_after: 11, timestamp: ts(16) },
      { opponent: 'Todo School', result: 'Loss', crp_gained: 4, home_map_bonus: false, streak_bonus: 0, pos_before: 10, pos_after: 11, timestamp: ts(19) },
    ],
  },
  {
    id: 'nwc',
    teamName: 'Night Wolves Crew', teamTag: 'NWC',
    wins: 2, losses: 10, mapWins: 8, mapLosses: 24, winRate: 17,
    streak: -4, rank: 12,
    crp: 38, position: 12, consecutive_wins: 0,
    roster: teams.find(t => t.id === 'nwc').roster,
    lastMatchDate: ts(10),
    match_history: [
      { opponent: 'Emperors', result: 'Loss', crp_gained: 7, home_map_bonus: false, streak_bonus: 0, pos_before: 11, pos_after: 12, timestamp: ts(10) },
      { opponent: 'Rotary Nation', result: 'Loss', crp_gained: 4, home_map_bonus: true, streak_bonus: 0, pos_before: 11, pos_after: 11, timestamp: ts(13) },
    ],
  },
];

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

const matches = [
  {
    id: 'match_001',
    teamA: 'mtd', teamB: 'nkr',
    teamAName: 'Mountain Drifters', teamBName: 'Night Racers',
    format: 'BO5', status: 'completed', winner: 'mtd',
    score: { teamA: 3, teamB: 1 },
    maps: [
      { mapName: 'Akina', uphillWinner: 'mtd', downhillWinner: 'mtd', mapWinner: 'mtd', drivers: { teamA: { uphill: 'Takumi', downhill: 'Itsuki' }, teamB: { uphill: 'Nakazato', downhill: 'Shingo' } } },
      { mapName: 'Akagi', uphillWinner: 'nkr', downhillWinner: 'mtd', tiebreaker: 'mtd', mapWinner: 'mtd', drivers: { teamA: { uphill: 'Kenji', downhill: 'Takumi' }, teamB: { uphill: 'Shingo', downhill: 'Nakazato' } } },
      { mapName: 'Myogi', uphillWinner: 'nkr', downhillWinner: 'nkr', mapWinner: 'nkr', drivers: { teamA: { uphill: 'Itsuki', downhill: 'Kenji' }, teamB: { uphill: 'Nakazato', downhill: 'Sayuki' } } },
      { mapName: 'Usui', uphillWinner: 'mtd', downhillWinner: 'mtd', mapWinner: 'mtd', drivers: { teamA: { uphill: 'Takumi', downhill: 'Takumi' }, teamB: { uphill: 'Shingo', downhill: 'Nakazato' } } },
    ],
    date: ts(1), recordedBy: 'admin',
    notes: 'Takumi clutched on Usui to close it out',
  },
  {
    id: 'match_002',
    teamA: 'akg', teamB: 'pjd',
    teamAName: 'Akagi Ghosts', teamBName: 'Project Downhill',
    format: 'BO5', status: 'completed', winner: 'akg',
    score: { teamA: 3, teamB: 2 },
    maps: [
      { mapName: 'Akagi', uphillWinner: 'akg', downhillWinner: 'akg', mapWinner: 'akg', drivers: { teamA: { uphill: 'Ryosuke', downhill: 'Keisuke' }, teamB: { uphill: 'Tomoyuki', downhill: 'Kai' } } },
      { mapName: 'Irohazaka', uphillWinner: 'pjd', downhillWinner: 'pjd', mapWinner: 'pjd', drivers: { teamA: { uphill: 'Keisuke', downhill: 'Ryosuke' }, teamB: { uphill: 'Wataru', downhill: 'Tomoyuki' } } },
      { mapName: 'Happogahara', uphillWinner: 'akg', downhillWinner: 'pjd', tiebreaker: 'pjd', mapWinner: 'pjd', drivers: { teamA: { uphill: 'Ryosuke', downhill: 'Keisuke' }, teamB: { uphill: 'Kai', downhill: 'Sakamoto' } } },
      { mapName: 'Myogi', uphillWinner: 'akg', downhillWinner: 'akg', mapWinner: 'akg', drivers: { teamA: { uphill: 'Keisuke', downhill: 'Ryosuke' }, teamB: { uphill: 'Tomoyuki', downhill: 'Wataru' } } },
      { mapName: 'Usui', uphillWinner: 'akg', downhillWinner: 'pjd', tiebreaker: 'akg', mapWinner: 'akg', drivers: { teamA: { uphill: 'Ryosuke', downhill: 'Keisuke' }, teamB: { uphill: 'Kai', downhill: 'Tomoyuki' } } },
    ],
    date: ts(2), recordedBy: 'admin',
    notes: 'Incredible 5-map series, Ryosuke won the tiebreaker on Usui',
  },
  {
    id: 'match_003',
    teamA: 'emp', teamB: 'sbr',
    teamAName: 'Emperors', teamBName: 'Sideburns Racing',
    format: 'BO3', status: 'completed', winner: 'emp',
    score: { teamA: 2, teamB: 0 },
    maps: [
      { mapName: 'Irohazaka', uphillWinner: 'emp', downhillWinner: 'emp', mapWinner: 'emp', drivers: { teamA: { uphill: 'Sudo', downhill: 'Kyoichi' }, teamB: { uphill: 'Hojo', downhill: 'Fumihiro' } } },
      { mapName: 'Akagi', uphillWinner: 'emp', downhillWinner: 'sbr', tiebreaker: 'emp', mapWinner: 'emp', drivers: { teamA: { uphill: 'Kyoichi', downhill: 'Seiji' }, teamB: { uphill: 'Fumihiro', downhill: 'Hojo' } } },
    ],
    date: ts(3), recordedBy: 'admin', notes: '',
  },
  {
    id: 'match_004',
    teamA: 'mtd', teamB: 'emp',
    teamAName: 'Mountain Drifters', teamBName: 'Emperors',
    format: 'BO5', status: 'completed', winner: 'mtd',
    score: { teamA: 3, teamB: 0 },
    maps: [
      { mapName: 'Akina', uphillWinner: 'mtd', downhillWinner: 'mtd', mapWinner: 'mtd', drivers: { teamA: { uphill: 'Takumi', downhill: 'Itsuki' }, teamB: { uphill: 'Sudo', downhill: 'Kyoichi' } } },
      { mapName: 'Irohazaka', uphillWinner: 'mtd', downhillWinner: 'emp', tiebreaker: 'mtd', mapWinner: 'mtd', drivers: { teamA: { uphill: 'Takumi', downhill: 'Kenji' }, teamB: { uphill: 'Kyoichi', downhill: 'Seiji' } } },
      { mapName: 'Myogi', uphillWinner: 'mtd', downhillWinner: 'mtd', mapWinner: 'mtd', drivers: { teamA: { uphill: 'Kenji', downhill: 'Takumi' }, teamB: { uphill: 'Seiji', downhill: 'Sudo' } } },
    ],
    date: ts(4), recordedBy: 'admin', notes: 'MTD dominated 3-0',
  },
  {
    id: 'match_005',
    teamA: 'nkr', teamB: 'sst',
    teamAName: 'Night Racers', teamBName: 'Speed Stars',
    format: 'BO3', status: 'completed', winner: 'nkr',
    score: { teamA: 2, teamB: 1 },
    maps: [
      { mapName: 'Myogi', uphillWinner: 'sst', downhillWinner: 'sst', mapWinner: 'sst', drivers: { teamA: { uphill: 'Nakazato', downhill: 'Shingo' }, teamB: { uphill: 'Iketani', downhill: 'Yuichi' } } },
      { mapName: 'Akagi', uphillWinner: 'nkr', downhillWinner: 'nkr', mapWinner: 'nkr', drivers: { teamA: { uphill: 'Shingo', downhill: 'Nakazato' }, teamB: { uphill: 'Yuichi', downhill: 'Iketani' } } },
      { mapName: 'Usui', uphillWinner: 'nkr', downhillWinner: 'sst', tiebreaker: 'nkr', mapWinner: 'nkr', drivers: { teamA: { uphill: 'Nakazato', downhill: 'Sayuki' }, teamB: { uphill: 'Iketani', downhill: 'Yuichi' } } },
    ],
    date: ts(5), recordedBy: 'admin', notes: 'Close series, Nakazato won the Usui tiebreaker',
  },
  {
    id: 'match_006',
    teamA: 'akg', teamB: 'nkr',
    teamAName: 'Akagi Ghosts', teamBName: 'Night Racers',
    format: 'BO5', status: 'completed', winner: 'akg',
    score: { teamA: 3, teamB: 1 },
    maps: [
      { mapName: 'Akagi', uphillWinner: 'akg', downhillWinner: 'akg', mapWinner: 'akg', drivers: { teamA: { uphill: 'Ryosuke', downhill: 'Keisuke' }, teamB: { uphill: 'Nakazato', downhill: 'Shingo' } } },
      { mapName: 'Myogi', uphillWinner: 'nkr', downhillWinner: 'nkr', mapWinner: 'nkr', drivers: { teamA: { uphill: 'Keisuke', downhill: 'Ryosuke' }, teamB: { uphill: 'Shingo', downhill: 'Nakazato' } } },
      { mapName: 'Usui', uphillWinner: 'akg', downhillWinner: 'akg', mapWinner: 'akg', drivers: { teamA: { uphill: 'Ryosuke', downhill: 'Keisuke' }, teamB: { uphill: 'Nakazato', downhill: 'Sayuki' } } },
      { mapName: 'Irohazaka', uphillWinner: 'akg', downhillWinner: 'nkr', tiebreaker: 'akg', mapWinner: 'akg', drivers: { teamA: { uphill: 'Keisuke', downhill: 'Ryosuke' }, teamB: { uphill: 'Shingo', downhill: 'Nakazato' } } },
    ],
    date: ts(6), recordedBy: 'admin', notes: 'AKG took position #2 from NKR',
  },
  {
    id: 'match_007',
    teamA: 'rns', teamB: 'tds',
    teamAName: 'Rotary Nation', teamBName: 'Todo School',
    format: 'BO3', status: 'completed', winner: 'rns',
    score: { teamA: 2, teamB: 0 },
    maps: [
      { mapName: 'Sadamine', uphillWinner: 'rns', downhillWinner: 'rns', mapWinner: 'rns', drivers: { teamA: { uphill: 'Amemiya', downhill: 'Kosuke' }, teamB: { uphill: 'Daiki', downhill: 'Smiley' } } },
      { mapName: 'Akina', uphillWinner: 'rns', downhillWinner: 'tds', tiebreaker: 'rns', mapWinner: 'rns', drivers: { teamA: { uphill: 'Amemiya', downhill: 'Kosuke' }, teamB: { uphill: 'Smiley', downhill: 'Daiki' } } },
    ],
    date: ts(6), recordedBy: 'admin', notes: '',
  },
  {
    id: 'match_008',
    teamA: 'pjd', teamB: 'tds',
    teamAName: 'Project Downhill', teamBName: 'Todo School',
    format: 'BO3', status: 'completed', winner: 'pjd',
    score: { teamA: 2, teamB: 0 },
    maps: [
      { mapName: 'Irohazaka', uphillWinner: 'pjd', downhillWinner: 'pjd', mapWinner: 'pjd', drivers: { teamA: { uphill: 'Tomoyuki', downhill: 'Kai' }, teamB: { uphill: 'Daiki', downhill: 'Smiley' } } },
      { mapName: 'Happogahara', uphillWinner: 'pjd', downhillWinner: 'tds', tiebreaker: 'pjd', mapWinner: 'pjd', drivers: { teamA: { uphill: 'Wataru', downhill: 'Sakamoto' }, teamB: { uphill: 'Smiley', downhill: 'Daiki' } } },
    ],
    date: ts(7), recordedBy: 'admin', notes: '',
  },
  {
    id: 'match_009',
    teamA: 'mtd', teamB: 'akg',
    teamAName: 'Mountain Drifters', teamBName: 'Akagi Ghosts',
    format: 'BO5', status: 'completed', winner: 'mtd',
    score: { teamA: 3, teamB: 2 },
    maps: [
      { mapName: 'Akina', uphillWinner: 'mtd', downhillWinner: 'akg', tiebreaker: 'mtd', mapWinner: 'mtd', drivers: { teamA: { uphill: 'Takumi', downhill: 'Itsuki' }, teamB: { uphill: 'Keisuke', downhill: 'Ryosuke' } } },
      { mapName: 'Akagi', uphillWinner: 'akg', downhillWinner: 'akg', mapWinner: 'akg', drivers: { teamA: { uphill: 'Kenji', downhill: 'Takumi' }, teamB: { uphill: 'Ryosuke', downhill: 'Keisuke' } } },
      { mapName: 'Irohazaka', uphillWinner: 'mtd', downhillWinner: 'mtd', mapWinner: 'mtd', drivers: { teamA: { uphill: 'Takumi', downhill: 'Kenji' }, teamB: { uphill: 'Keisuke', downhill: 'Ryosuke' } } },
      { mapName: 'Usui', uphillWinner: 'akg', downhillWinner: 'akg', mapWinner: 'akg', drivers: { teamA: { uphill: 'Itsuki', downhill: 'Kenji' }, teamB: { uphill: 'Ryosuke', downhill: 'Keisuke' } } },
      { mapName: 'Myogi', uphillWinner: 'mtd', downhillWinner: 'mtd', mapWinner: 'mtd', drivers: { teamA: { uphill: 'Takumi', downhill: 'Takumi' }, teamB: { uphill: 'Keisuke', downhill: 'Ryosuke' } } },
    ],
    date: ts(8), recordedBy: 'admin', notes: 'Epic 5-map battle for the top spot',
  },
  {
    id: 'match_010',
    teamA: 'tsj', teamB: 'ibl',
    teamAName: 'Tsuchisaka Junction', teamBName: 'Impact Blue',
    format: 'BO3', status: 'completed', winner: 'tsj',
    score: { teamA: 2, teamB: 1 },
    maps: [
      { mapName: 'Tsuchisaka', uphillWinner: 'tsj', downhillWinner: 'tsj', mapWinner: 'tsj', drivers: { teamA: { uphill: 'Go', downhill: 'Shinigami' }, teamB: { uphill: 'Mako', downhill: 'Sayuki' } } },
      { mapName: 'Usui', uphillWinner: 'ibl', downhillWinner: 'ibl', mapWinner: 'ibl', drivers: { teamA: { uphill: 'Shinigami', downhill: 'Go' }, teamB: { uphill: 'Sayuki', downhill: 'Mako' } } },
      { mapName: 'Akina', uphillWinner: 'tsj', downhillWinner: 'ibl', tiebreaker: 'tsj', mapWinner: 'tsj', drivers: { teamA: { uphill: 'Go', downhill: 'Shinigami' }, teamB: { uphill: 'Mako', downhill: 'Sayuki' } } },
    ],
    date: ts(9), recordedBy: 'admin', notes: 'Go won the Akina tiebreaker',
  },
];

// ---------------------------------------------------------------------------
// Seed Firestore
// ---------------------------------------------------------------------------

async function seed() {
  console.log('Seeding teams...');
  for (const team of teams) {
    const { id, ...data } = team;
    data.createdAt = Timestamp.now();
    await setDoc(doc(db, 'teams', id), data);
    console.log(`  + teams/${id}`);
  }

  console.log('Seeding standings...');
  for (const standing of standings) {
    const { id, ...data } = standing;
    await setDoc(doc(db, 'standings', id), data);
    console.log(`  + standings/${id}`);
  }

  console.log('Seeding matches...');
  for (const match of matches) {
    const { id, ...data } = match;
    await setDoc(doc(db, 'matches', id), data);
    console.log(`  + matches/${id}`);
  }

  console.log('\nDone! Seeded:');
  console.log(`  ${teams.length} teams`);
  console.log(`  ${standings.length} standings`);
  console.log(`  ${matches.length} matches`);

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
