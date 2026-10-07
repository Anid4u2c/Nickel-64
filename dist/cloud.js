import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, collection, query, where, onSnapshot, doc, runTransaction, serverTimestamp, Timestamp, getDocFromServer } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { firebaseConfig, databaseId } from './firebase-config.js';
import { isBand, clockMinutes, durationMinutes, validDate } from './plan-model.js';
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
  // Realtime visibility is required so the duo immediately sees clients' saved plans.
  const ref=collection(db,'setlists');
  const q=isBand(user)?ref:query(ref,where('ownerUid','==',user.uid));
  return onSnapshot(q,{includeMetadataChanges:true},snapshot=>{
    // Only server-confirmed records are marked as saved; stale cached records remain labelled.
    onData(snapshot.docs.map(d=>({id:d.id,...d.data()})),snapshot.metadata.fromCache);
  },onError);
}
export async function savePlan(plan,expectedUpdatedAt) {
  const user=auth.currentUser;
  if(!user?.emailVerified) throw new Error('Verify your email before saving a shared setlist.');
  const startMinutes=clockMinutes(plan.startTime),endMinutes=clockMinutes(plan.endTime);
  const duration=durationMinutes(startMinutes,endMinutes);
  if(!plan.event.trim()||!validDate(plan.date)||duration==null||!plan.ids.length)throw new Error('Add an event name, date, distinct start and end times, and at least one song.');
  if(plan.ownerUid&&plan.ownerUid!==user.uid)throw new Error('Only the creator can edit this setlist.');
  const ref=plan.cloudId?doc(db,'setlists',plan.cloudId):doc(collection(db,'setlists'));
  await runTransaction(db,async transaction=>{
    const existing=await transaction.get(ref);
    if(existing.exists()){
      const data=existing.data();
      if(data.ownerUid!==user.uid)throw new Error('Only the creator can edit this setlist.');
      if(!expectedUpdatedAt||!data.updatedAt?.isEqual(expectedUpdatedAt))throw new Error('This setlist changed on another device. Open the latest saved version before saving.');
    }else if(plan.cloudId)throw new Error('This saved setlist is no longer available.');
    const record={ownerUid:user.uid,event:plan.event.trim(),notes:plan.notes,eventDate:Timestamp.fromDate(new Date(plan.date+'T00:00:00Z')),startMinutes,endMinutes,durationMinutes:duration,songIds:plan.ids,createdAt:existing.exists()?existing.data().createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
    transaction.set(ref,record);
  });
  const saved=await getDocFromServer(ref);return {id:ref.id,updatedAt:saved.data().updatedAt};
}
