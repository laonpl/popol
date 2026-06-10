import dotenv from 'dotenv';
import { adminDb } from '../src/config/firebase.js';

dotenv.config();

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find(arg => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : '';
}

const fromUid = argValue('from');
const toUid = argValue('to');
const dryRun = !process.argv.includes('--apply');

if (!fromUid || !toUid || fromUid === toUid) {
  console.error('Usage: node scripts/recover-user-data.js --from=<oldUid> --to=<newUid> [--apply]');
  process.exit(1);
}

async function getDocsForUser(collectionName, uid) {
  const snap = await adminDb.collection(collectionName).where('userId', '==', uid).get();
  return snap.docs;
}

async function main() {
  const collections = ['experiences', 'portfolios', 'jobMatches'];
  const summary = {};

  for (const collectionName of collections) {
    const docs = await getDocsForUser(collectionName, fromUid);
    summary[collectionName] = docs.map(doc => doc.id);
  }

  console.log(JSON.stringify({
    dryRun,
    fromUid,
    toUid,
    counts: Object.fromEntries(Object.entries(summary).map(([key, docs]) => [key, docs.length])),
    sampleIds: Object.fromEntries(Object.entries(summary).map(([key, docs]) => [key, docs.slice(0, 10)])),
  }, null, 2));

  if (dryRun) {
    console.log('Dry run only. Re-run with --apply to update userId fields.');
    return;
  }

  for (const collectionName of collections) {
    const ids = summary[collectionName];
    for (let i = 0; i < ids.length; i += 450) {
      const batch = adminDb.batch();
      ids.slice(i, i + 450).forEach(id => {
        batch.update(adminDb.collection(collectionName).doc(id), {
          userId: toUid,
          legacyUserId: fromUid,
          recoveredAt: new Date(),
          updatedAt: new Date(),
        });
      });
      await batch.commit();
    }
  }

  const oldProfile = await adminDb.collection('profiles').doc(fromUid).get();
  if (oldProfile.exists) {
    await adminDb.collection('profiles').doc(toUid).set({
      ...oldProfile.data(),
      uid: toUid,
      legacyUserId: fromUid,
      recoveredAt: new Date(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  console.log('Recovery applied.');
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
