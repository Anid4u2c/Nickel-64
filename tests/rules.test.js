import test,{before,after,beforeEach} from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment,assertSucceeds,assertFails } from '@firebase/rules-unit-testing';
import { doc,setDoc,getDoc,getDocs,collection,query,where,updateDoc,deleteDoc,serverTimestamp,Timestamp,deleteField } from 'firebase/firestore';
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
 const db=ctx('alice');await seed();const attacks=[{event:''},{event:'x'.repeat(121)},{notes:'x'.repeat(4001)},{eventDate:'2027-06-12'},{startMinutes:-1},{endMinutes:1440},{startMinutes:60,endMinutes:60,durationMinutes:0},{durationMinutes:999999},{songIds:['0']},{songIds:[0,0]},{songIds:[103]},{songIds:[{}]},{songIds:[]},{songIds:Array(104).fill(0)}];
 for(let i=0;i<attacks.length;i++){await assertFails(setDoc(ref(db,'attack'+i),record(attacks[i])));await assertFails(updateDoc(ref(db),{...attacks[i],updatedAt:serverTimestamp()}));}
 await assertSucceeds(updateDoc(ref(db),{notes:'Updated',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(ref(ctx('alice','client@example.com',false),'unverified'),record()));
});
