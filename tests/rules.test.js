import test,{before,after,beforeEach} from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment,assertSucceeds,assertFails } from '@firebase/rules-unit-testing';
import { doc,setDoc,getDoc,getDocs,collection,query,where,updateDoc,deleteDoc,serverTimestamp,Timestamp,deleteField,runTransaction } from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-nickel-64',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});});
after(async()=>{await env?.cleanup();});beforeEach(async()=>{await env.clearFirestore();});
const ctx=(uid,email='client@example.com',verified=true)=>env.authenticatedContext(uid,{email,email_verified:verified}).firestore();
const record=(extra={})=>({ownerUid:'alice',event:'Wedding',notes:'First dance',eventDate:Timestamp.fromDate(new Date('2027-06-12T00:00:00Z')),startMinutes:1350,endMinutes:60,durationMinutes:150,songIds:[0,1,2],createdAt:serverTimestamp(),updatedAt:serverTimestamp(),...extra});
const ref=(db,id='one')=>doc(db,'setlists',id);
async function seed(){await assertSucceeds(setDoc(ref(ctx('alice')),record()));}
test('owner saves and reads; private data denied to guests and other clients',async()=>{
 await seed();await assertSucceeds(getDoc(ref(ctx('alice'))));await assertFails(getDoc(ref(ctx('bob'))));await assertFails(getDocs(collection(ctx('bob'),'setlists')));await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'setlists')));
 await assertSucceeds(getDocs(query(collection(ctx('alice'),'setlists'),where('ownerUid','==','alice'))));
 await assertFails(getDocs(collection(ctx('alice'),'setlists')));
});
test('verified Dave and Rob can view every setlist but cannot edit client records',async()=>{
 await seed();for(const email of ['davecarlsonguitar@gmail.com','thenickel64@gmail.com','nick@itness.ca']){
 const db=ctx(email,email);await assertSucceeds(getDoc(ref(db)));await assertSucceeds(getDocs(collection(db,'setlists')));await assertFails(updateDoc(ref(db),{notes:'Changed',updatedAt:serverTimestamp()}));}
 await assertFails(getDocs(collection(ctx('imposter','thenickel64@gmail.com',false),'setlists')));
});
test('ownership, timestamps, schema, required fields and roles cannot be forged',async()=>{
 const db=ctx('alice');await assertFails(setDoc(ref(db),record({ownerUid:'bob'})));await assertFails(setDoc(ref(db),record({createdAt:Timestamp.fromMillis(0)})));await assertFails(setDoc(ref(db),record({isAdmin:true})));
 await seed();for(const patch of [{ownerUid:'bob'},{createdAt:Timestamp.fromMillis(0)},{notes:deleteField()},{event:120},{extraData:'bad'},{isAdmin:true},{updatedAt:Timestamp.fromMillis(0)}])await assertFails(updateDoc(ref(db),{...patch, ...('updatedAt' in patch?{}:{updatedAt:serverTimestamp()})}));
 await assertFails(deleteDoc(ref(db)));await assertFails(setDoc(doc(db,'users','alice'),{isAdmin:true}));await assertFails(setDoc(doc(db,'setlists','one','private','notes'),{text:'bad'}));
});
test('validation rejects bad schedules, duration tampering, song pollution and large fields on create and update',async()=>{
 const db=ctx('alice');await seed();const attacks=[{event:''},{event:'x'.repeat(121)},{notes:'x'.repeat(4001)},{eventDate:'2027-06-12'},{startMinutes:-1},{endMinutes:1440},{startMinutes:60,endMinutes:60,durationMinutes:0},{durationMinutes:999999},{songIds:['0']},{songIds:[0,0]},{songIds:[103]},{songIds:[{}]},{songIds:Array(104).fill(0)}];
 for(let i=0;i<attacks.length;i++){await assertFails(setDoc(ref(db,'attack'+i),record(attacks[i])));await assertFails(updateDoc(ref(db),{...attacks[i],updatedAt:serverTimestamp()}));}
 await assertSucceeds(updateDoc(ref(db),{notes:'Updated',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(ref(ctx('alice','client@example.com',false),'unverified'),record()));
});

test('a client can transactionally create a new record and reject an existing cross-owner record',async()=>{
 const db=ctx('alice');await assertSucceeds(runTransaction(db,async t=>{const fresh=ref(db,'transaction');const snapshot=await t.get(fresh);if(snapshot.exists())throw new Error('Unexpected document');t.set(fresh,record());}));
 const bob=ctx('bob');await assertFails(runTransaction(bob,async t=>{await t.get(ref(bob,'transaction'));}));
 await assertFails(getDoc(ref(env.unauthenticatedContext().firestore(),'missing')));
});

test('sharing roles enforce read, edit and ownership permissions and revocation',async()=>{
 await seed();const alice=ctx('alice'),edit=ctx('edit','edit@example.com'),view=ctx('view','view@example.com'),co=ctx('co','co@example.com');
 const access={'edit@example.com':'editor','view@example.com':'viewer','co@example.com':'owner'};
 await assertSucceeds(updateDoc(ref(alice),{ownerEmail:'client@example.com',access,sharedWith:Object.keys(access),updatedAt:serverTimestamp()}));
 for(const db of [edit,view,co])await assertSucceeds(getDoc(ref(db)));
 await assertSucceeds(getDocs(query(collection(edit,'setlists'),where('sharedWith','array-contains','edit@example.com'))));
 await assertFails(getDocs(collection(edit,'setlists')));
 await assertSucceeds(updateDoc(ref(edit),{notes:'Edited',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(view),{notes:'Forbidden',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(edit),{access:{},sharedWith:[],updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(co),{ownerUid:'co',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(co),{ownerEmail:'co@example.com',updatedAt:serverTimestamp()}));
 const next={'co@example.com':'owner'};
 await assertSucceeds(updateDoc(ref(co),{access:next,sharedWith:Object.keys(next),updatedAt:serverTimestamp()}));
 await assertFails(getDoc(ref(edit)));await assertFails(getDoc(ref(view)));
 await assertFails(updateDoc(ref(alice),{access:{'bad@example.com':'admin'},sharedWith:['bad@example.com'],updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(alice),{access:next,sharedWith:['outsider@example.com'],updatedAt:serverTimestamp()}));
 await assertFails(getDoc(ref(ctx('unverified','co@example.com',false))));
});

const songId='song_'+'a'.repeat(64);
const songRef=db=>doc(db,'songCatalog',songId);
const songRecord=()=>({id:songId,title:'Requested song',artist:'Artist',bpm:null,year:null,seconds:null,status:'pending',requestedBy:'alice',likes:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
async function castHeart(db,uid){await runTransaction(db,async t=>{const song=songRef(db),vote=doc(db,'songCatalog',songId,'likes',uid);const current=await t.get(song);await t.get(vote);t.update(song,{likes:current.data().likes+1});t.set(vote,{uid,createdAt:serverTimestamp()});});}
test('requests require verified users; decisions and optional details belong to moderators',async()=>{
 const alice=ctx('alice');await assertSucceeds(setDoc(songRef(alice),songRecord()));
 await assertFails(setDoc(doc(alice,'songCatalog','song_'+'b'.repeat(64)),{...songRecord(),id:'song_'+'b'.repeat(64),status:'approved'}));
 await assertFails(getDoc(songRef(env.unauthenticatedContext().firestore())));
 await assertSucceeds(getDoc(songRef(ctx('bob'))));
 await assertFails(updateDoc(songRef(alice),{status:'approved',updatedAt:serverTimestamp()}));
 const rob=ctx('rob','thenickel64@gmail.com');await assertSucceeds(updateDoc(songRef(rob),{status:'denied',updatedAt:serverTimestamp()}));
 await assertSucceeds(getDoc(songRef(ctx('bob'))));
 await assertFails(updateDoc(songRef(rob),{seconds:-1,updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(songRef(rob),{status:'approved',bpm:100,year:2020,seconds:240,updatedAt:serverTimestamp()}));
 await assertSucceeds(getDocs(query(collection(env.unauthenticatedContext().firestore(),'songCatalog'),where('status','==','approved'))));
 await assertFails(setDoc(songRef(ctx('unverified','u@example.com',false)),songRecord()));
 await seed();await assertSucceeds(updateDoc(ref(alice),{songIds:[0,songId],updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(alice),{songIds:['fake-song'],updatedAt:serverTimestamp()}));
});
test('hearts require an atomic per-user vote and cannot be inflated or forged',async()=>{
 const alice=ctx('alice');await setDoc(songRef(alice),songRecord());
 await assertFails(updateDoc(songRef(alice),{likes:1}));
 await assertSucceeds(castHeart(alice,'alice'));await assertFails(castHeart(alice,'alice'));
 await assertFails(castHeart(ctx('bob'),'alice'));await assertSucceeds(castHeart(ctx('bob'),'bob'));
 const count=(await getDoc(songRef(alice))).data().likes;if(count!==2)throw new Error('Heart count must be two distinct users');
 await assertFails(updateDoc(songRef(ctx('rob','thenickel64@gmail.com')),{likes:100,updatedAt:serverTimestamp()}));
 await assertFails(deleteDoc(doc(alice,'songCatalog',songId,'likes','alice')));
});


test('editors can sync only songs, including removal of the last song, without changing event details',async()=>{
 const alice=ctx('alice');await seed();await updateDoc(ref(alice),{ownerEmail:'client@example.com',access:{'editor@example.com':'editor','viewer@example.com':'viewer'},sharedWith:['editor@example.com','viewer@example.com'],updatedAt:serverTimestamp()});
 const editor=ctx('editor','editor@example.com');await assertSucceeds(updateDoc(ref(editor),{songIds:[0,2],updatedAt:serverTimestamp()}));
 const saved=(await getDoc(ref(alice))).data();if(saved.notes!=='First dance'||saved.event!=='Wedding'||saved.durationMinutes!==150)throw new Error('Song-only update changed event details');
 await assertSucceeds(updateDoc(ref(editor),{songIds:[],updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(ctx('viewer','viewer@example.com')),{songIds:[1],updatedAt:serverTimestamp()}));
 await assertFails(setDoc(ref(alice,'empty-new'),record({songIds:[]})));
});
