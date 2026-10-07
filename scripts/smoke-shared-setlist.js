// Create one disposable test identity and setlist, verify browser-equivalent access,
// then delete both. Does not impersonate Dave, Rob or any existing app user.
import { randomUUID,createHash } from 'node:crypto';
import { initializeApp as initializeAdmin,cert,deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { initializeApp,deleteApp } from 'firebase/app';
import { getAuth,signInWithCustomToken,signOut } from 'firebase/auth';
import { getFirestore,doc,runTransaction,getDocFromServer,collection,query,where,getDocs,serverTimestamp,Timestamp,terminate } from 'firebase/firestore';
import { firebaseConfig,databaseId } from '../dist/firebase-config.js';
const uid='deployment-check-'+randomUUID(),recordId='deployment-check-'+randomUUID(),songId='song_'+createHash('sha256').update(randomUUID()).digest('hex');
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
  const song=doc(db,'songCatalog',songId),vote=doc(db,'songCatalog',songId,'likes',uid);
  await runTransaction(db,async transaction=>{await transaction.get(song);transaction.set(song,{id:songId,title:'Deployment song request (temporary)',artist:'Verification',bpm:null,year:1680,seconds:null,status:'pending',requestedBy:uid,likes:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});});
  await runTransaction(db,async transaction=>{const current=await transaction.get(song);await transaction.get(vote);transaction.set(vote,{uid,createdAt:serverTimestamp()});transaction.update(song,{likes:current.data().likes+1});});
  if((await getDocFromServer(song)).data().likes!==1)throw new Error('Song heart count mismatch');
  await runTransaction(db,async transaction=>{const current=await transaction.get(song);await transaction.get(vote);transaction.delete(vote);transaction.update(song,{likes:current.data().likes-1});});
  if((await getDocFromServer(song)).data().likes!==0)throw new Error('Heart withdrawal mismatch');
  await runTransaction(db,async transaction=>{await transaction.get(ref);transaction.update(ref,{songIds:[0,songId],updatedAt:serverTimestamp()});});
  if(!(await getDocFromServer(ref)).data().songIds.includes(songId))throw new Error('Requested song missing from setlist');
  await runTransaction(db,async transaction=>{await transaction.get(ref);transaction.update(ref,{songIds:[],updatedAt:serverTimestamp()});});
  const empty=(await getDocFromServer(ref)).data();if(empty.songIds.length!==0||empty.notes!=='Updated verification'||empty.durationMinutes!==150)throw new Error('Song removal changed event details');
  await signOut(auth);
  let denied=false;try{await getDocFromServer(ref);}catch(error){if(error.code==='permission-denied')denied=true;else throw error;}
  if(!denied)throw new Error('Unauthenticated data was readable');
  let requestDenied=false;try{await getDocFromServer(song);}catch(error){if(error.code==='permission-denied')requestDenied=true;else throw error;}if(!requestDenied)throw new Error('Pending request was publicly readable');
  console.log('PASS: song request, heart, requested-song save and final-song removal; live Firebase sign-in, transactional save/update, inbox query, duration readback, and signed-out access denial.');
} catch(error) { console.error('Live verification failed:',error.code||'unknown',error.message);process.exitCode=1; }
finally {
  await adminFirestore(admin,databaseId).doc('songCatalog/'+songId+'/likes/'+uid).delete();
  await adminFirestore(admin,databaseId).doc('songCatalog/'+songId).delete();
  await adminFirestore(admin,databaseId).doc('setlists/'+recordId).delete();
  if(createdUser)await adminAuth(admin).deleteUser(uid);
  await terminate(db);await deleteApp(browser);await adminFirestore(admin,databaseId).terminate();await deleteAdmin(admin);
  console.log('Disposable verification account and setlist removed.');
}
