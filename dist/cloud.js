import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, collection, query, where, onSnapshot, doc, runTransaction, serverTimestamp, Timestamp, getDocFromServer } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { firebaseConfig, databaseId } from './firebase-config.js';
import { isBand, clockMinutes, durationMinutes, validDate, canEditSetlist, canManageSetlist } from './plan-model.js';
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app, databaseId);
export const watchUser = callback => onAuthStateChanged(auth, callback);
export const googleSignIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const emailSignIn = (email,password) => signInWithEmailAndPassword(auth,email,password);
export async function register(email,password) { const result=await createUserWithEmailAndPassword(auth,email,password); await sendEmailVerification(result.user); return result; }
export const verifyEmail = () => sendEmailVerification(auth.currentUser);
export const refreshUser = async () => { await auth.currentUser?.reload(); await auth.currentUser?.getIdToken(true); return auth.currentUser; };
export const resetPassword = email => sendPasswordResetEmail(auth,email);
export const logOut = () => signOut(auth);
export function watchPlans(user,onData,onError) {
  const ref=collection(db,'setlists');
  if(isBand(user))return onSnapshot(ref,{includeMetadataChanges:true},s=>onData(s.docs.map(d=>({id:d.id,...d.data()})),s.metadata.fromCache),onError);
  // Merge owned and explicitly shared records without exposing other clients' plans.
  const sources=[null,null];const qs=[query(ref,where('ownerUid','==',user.uid)),query(ref,where('sharedWith','array-contains',user.email.toLowerCase()))];
  const stops=qs.map((q,i)=>onSnapshot(q,{includeMetadataChanges:true},s=>{sources[i]=s;if(sources.every(Boolean)){const merged=new Map();for(const source of sources)for(const d of source.docs)merged.set(d.id,{id:d.id,...d.data()});onData([...merged.values()],sources.some(x=>x.metadata.fromCache));}},onError));
  return ()=>stops.forEach(stop=>stop());
}
export async function savePlan(plan,expectedUpdatedAt) {
  const user=auth.currentUser;
  if(!user?.emailVerified) throw new Error('Verify your email before saving a shared setlist.');
  const startMinutes=clockMinutes(plan.startTime),endMinutes=clockMinutes(plan.endTime);
  const duration=durationMinutes(startMinutes,endMinutes);
  if(!plan.event.trim()||!validDate(plan.date)||duration==null||!plan.ids.length)throw new Error('Add an event name, date, distinct start and end times, and at least one song.');

  const ref=plan.cloudId?doc(db,'setlists',plan.cloudId):doc(collection(db,'setlists'));
  await runTransaction(db,async transaction=>{
    const existing=await transaction.get(ref);
    if(existing.exists()){
      const data=existing.data();
      if(!canEditSetlist(data,user))throw new Error('You do not have edit access to this setlist.');
      if(!expectedUpdatedAt||!data.updatedAt?.isEqual(expectedUpdatedAt))throw new Error('This setlist changed on another device. Open the latest saved version before saving.');
    }else if(plan.cloudId)throw new Error('This saved setlist is no longer available.');
    const previous=existing.exists()?existing.data():null;
    const record={ownerUid:previous?.ownerUid||user.uid,ownerEmail:previous?.ownerEmail||user.email.toLowerCase(),access:previous?.access||{},sharedWith:previous?.sharedWith||[],event:plan.event.trim(),notes:plan.notes,eventDate:Timestamp.fromDate(new Date(plan.date+'T00:00:00Z')),startMinutes,endMinutes,durationMinutes:duration,songIds:plan.ids,createdAt:existing.exists()?existing.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
    transaction.set(ref,record);
  });
  const saved=await getDocFromServer(ref);return {id:ref.id,updatedAt:saved.data().updatedAt,record:saved.data()};
}

export async function changeSharing(id,email,role,expectedUpdatedAt) {
  email=email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('Enter a valid email address.');
  if(role!==null&&!['viewer','editor','owner'].includes(role))throw new Error('Unknown sharing permission.');
  const user=auth.currentUser,ref=doc(db,'setlists',id);
  await runTransaction(db,async t=>{
    const snapshot=await t.get(ref);if(!snapshot.exists())throw new Error('This setlist no longer exists.');
    const record=snapshot.data();if(!canManageSetlist(record,user))throw new Error('Only owners can manage sharing.');
    if(!expectedUpdatedAt||!record.updatedAt.isEqual(expectedUpdatedAt))throw new Error('Sharing changed on another device. Reopen the latest saved setlist.');
    const ownerEmail=record.ownerEmail||user.email.toLowerCase();if(email===ownerEmail)throw new Error('The original creator retains ownership.');
    const access={...(record.access||{})};if(role===null)delete access[email];else access[email]=role;
    if(Object.keys(access).length>25)throw new Error('A setlist can be shared with up to 25 users.');
    t.update(ref,{ownerEmail,access,sharedWith:Object.keys(access),updatedAt:serverTimestamp()});
  });
  try{const saved=await getDocFromServer(ref);return {id:saved.id,...saved.data()};}catch(e){if(e.code==='permission-denied'&&email===user.email.toLowerCase()&&role===null)return {id,accessLost:true};throw e;}
}
