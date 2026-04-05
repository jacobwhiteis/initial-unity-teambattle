import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Use GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON file,
// or set individual env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
let credential;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  credential = applicationDefault();
} else {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }
  credential = cert({ projectId, clientEmail, privateKey });
}

const app = initializeApp({ credential });
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// Load team data from teams.json
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const teamsPath = resolve(__dirname, '..', 'teams.json');
const teams = JSON.parse(readFileSync(teamsPath, 'utf-8'));

// ---------------------------------------------------------------------------
// Seed Firestore
// ---------------------------------------------------------------------------

async function clearCollection(name) {
  const snap = await db.collection(name).get();
  for (const d of snap.docs) {
    await d.ref.delete();
  }
  console.log(`  Cleared ${snap.size} docs from ${name}`);
}

async function seed() {
  // Clear existing data
  console.log('Clearing existing data...');
  await clearCollection('teams');
  await clearCollection('standings');
  await clearCollection('matches');
  await clearCollection('sessions');
  await clearCollection('drivers');

  console.log('Seeding teams...');
  for (const team of teams) {
    const teamId = team.tag.toLowerCase();
    await db.doc(`teams/${teamId}`).set({
      name: team.name,
      tag: team.tag,
      roster: team.roster,
      active: true,
      createdAt: Timestamp.now(),
    });
    console.log(`  + teams/${teamId} — [${team.tag}] ${team.name}`);
  }

  console.log('Seeding standings...');
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const teamId = team.tag.toLowerCase();
    await db.doc(`standings/${teamId}`).set({
      teamName: team.name,
      teamTag: team.tag,
      wins: 0,
      losses: 0,
      mapWins: 0,
      mapLosses: 0,
      winRate: 0,
      streak: 0,
      rank: 0,
      crp: 0,
      position: i + 1,
      consecutive_wins: 0,
      roster: team.roster,
      match_history: [],
      lastMatchDate: null,
    });
    console.log(`  + standings/${teamId} — position ${i + 1}`);
  }

  console.log('\nDone! Seeded:');
  console.log(`  ${teams.length} teams`);
  console.log(`  ${teams.length} standings`);
  console.log(`  0 matches (fresh start)`);

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
