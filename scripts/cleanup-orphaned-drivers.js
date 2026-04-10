/**
 * Cleanup script: removes drivers/{discordId} docs whose team no longer exists.
 * Run: GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json node scripts/cleanup-orphaned-drivers.js
 * Or set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID || 'iur-teambattle' });
const db = getFirestore();

const driversSnap = await db.collection('drivers').get();
const toDelete = [];

for (const driverDoc of driversSnap.docs) {
  const { teamId, teamName, name } = driverDoc.data();
  if (!teamId) {
    console.log(`  [skip] ${driverDoc.id} — no teamId field`);
    continue;
  }
  const teamSnap = await db.collection('teams').doc(teamId).get();
  if (!teamSnap.exists) {
    console.log(`  [orphan] ${name} (${driverDoc.id}) — team "${teamName}" (${teamId}) no longer exists`);
    toDelete.push(driverDoc.ref);
  } else {
    console.log(`  [ok] ${name} (${driverDoc.id}) — team "${teamName}" exists`);
  }
}

if (toDelete.length === 0) {
  console.log('\nNo orphaned driver documents found.');
} else {
  console.log(`\nDeleting ${toDelete.length} orphaned driver document(s)...`);
  const batch = db.batch();
  for (const ref of toDelete) batch.delete(ref);
  await batch.commit();
  console.log('Done.');
}
