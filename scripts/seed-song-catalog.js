// Idempotent import: never overwrite moderator edits, request decisions or hearts.
import fs from 'node:fs';
import { initializeApp,cert } from 'firebase-admin/app';
import { getFirestore,FieldValue } from 'firebase-admin/firestore';
import { songKey } from '../dist/song-model.js';
const app=initializeApp({credential:cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),projectId:'nickel-64'}),db=getFirestore(app,'setlists');
let created=0;
for(const song of JSON.parse(fs.readFileSync('dist/songs.json','utf8'))){const ref=db.doc('songCatalog/'+await songKey(song.title,song.artist));try{await ref.create({...song,status:'approved',requestedBy:'catalog',likes:0,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});created++;}catch(e){if(e.code!==6)throw e;}}
console.log(`Song catalog ready: ${created} initial songs added; existing records preserved.`);await db.terminate();
