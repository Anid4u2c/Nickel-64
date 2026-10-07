// Create one disposable test identity and setlist, verify browser-equivalent access,
// then delete both. Does not impersonate Dave, Rob or any existing app user.
import { randomUUID } from 'node:crypto';
import { initializeApp as initializeAdmin,cert,deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { initializeApp,deleteApp } from 'firebase/app';
import { getAuth,signInWithCustomToken,signOut } from 'firebase/auth';
import { getFirestore,doc,runTransaction,getDocFromServer,collection,query,where,getDocs,serverTimestamp,Timestamp,terminate } from 'firebase/firestore';
import { firebaseConfig,databaseId } from '../dist/firebase-config.js';
const uid='deployment-check-'+randomUUID(),recordId='deployment-check-'+randomUUID();
const admin=initializeAdmin({credential:cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),projectId:'nickel-64'});
const browser=initializeApp(firebaseConfig,'deployment-check'),auth=getAuth(browser),db=getFirestore(browser,databaseId);
let createdUser=false;
try {
  await adminAuth(admin).createUser({uid,email:uid+'@example.com',emailVerified:true});createdUser=true;
  const token=await adminAuth(admin).createCustomToken(uid);
  await signInWithCustomToken(auth,token);
  const ref=doc(db,'setlists',recordId);
  await runTransaction(db,async transaction=>{
    if((await transaction.get(ref)).exists())throw new Error('Unexpected test record');
    transaction.set(ref,{ownerUid:uid,ownerEmail:uid+'@example.com',access:{},sharedWith:[],event:'Deployment verification (temporary)',notes:'Automatically removed after the check.',eventDate:Timestamp.fromDate(new Date('2027-06-12T00:00:00Z')),startMinutes:1350,endMinutes:60,durationMinutes:150,songIds:[0,1],createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  });
  const saved=await getDocFromServer(ref);
  if(!saved.exists()||saved.data().durationMinutes!==150)throw new Error('Saved event duration mismatch');
  const inbox=await getDocs(query(collection(db,'setlists'),where('ownerUid','==',uid)));
  if(inbox.size!==1)throw new Error('Saved setlist missing from client inbox');
  await runTransaction(db,async transaction=>{const current=await transaction.get(ref);transaction.update(ref,{notes:'Updated verification',updatedAt:serverTimestamp()});if(current.data().ownerUid!==uid)throw new Error('Incorrect owner');});
  await runTransaction(db,async transaction=>{await transaction.get(ref);transaction.update(ref,{access:{'sharing-check@example.com':'editor'},sharedWith:['sharing-check@example.com'],updatedAt:serverTimestamp()});});
  await getDocs(query(collection(db,'setlists'),where('sharedWith','array-contains','sharing-check@example.com'))).then(()=>{throw new Error('Unrelated share query was permitted');},error=>{if(error.code!=='permission-denied')throw error;});
  await getDocs(query(collection(db,'setlists'),where('sharedWith','array-contains',uid+'@example.com')));
  await signOut(auth);
  let denied=false;try{await getDocFromServer(ref);}catch(error){if(error.code==='permission-denied')denied=true;else throw error;}
  if(!denied)throw new Error('Unauthenticated data was readable');
  console.log('PASS: live Firebase sign-in, transactional save/update, inbox query, duration readback, and signed-out access denial.');
} catch(error) { console.error('Live verification failed:',error.code||'unknown',error.message);process.exitCode=1; }
finally {
  await adminFirestore(admin,databaseId).doc('setlists/'+recordId).delete();
  if(createdUser)await adminAuth(admin).deleteUser(uid);
  await terminate(db);await deleteApp(browser);await adminFirestore(admin,databaseId).terminate();await deleteAdmin(admin);
  console.log('Disposable verification account and setlist removed.');
}
