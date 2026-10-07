import test from 'node:test';
import assert from 'node:assert/strict';
import { durationMinutes, clockMinutes, durationLabel, validDate, isBand } from '../dist/plan-model.js';
test('event duration handles same-day and overnight schedules',()=>{
  assert.equal(durationMinutes(clockMinutes('18:30'),clockMinutes('21:00')),150);
  assert.equal(durationMinutes(clockMinutes('22:30'),clockMinutes('01:00')),150);
  assert.equal(durationLabel(150),'2 hr 30 min');
  assert.equal(durationMinutes(60,60),null);
  for(const value of [null,NaN,1440,-1,1.5]) assert.equal(durationMinutes(value,30),null);
  assert.equal(clockMinutes('24:00'),null);assert.equal(clockMinutes('09:61'),null);
});
test('calendar dates are valid including leap years',()=>{
  assert.equal(validDate('2028-02-29'),true);assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2026-04-31'),false);
});
test('band privileges require a verified exact account',()=>{
 for(const email of ['davecarlsonguitar@gmail.com','thenickel64@gmail.com','nick@itness.ca'])assert.equal(isBand({email,emailVerified:true}),true);
 assert.equal(isBand({email:'thenickel64@gmail.com',emailVerified:false}),false);
 assert.equal(isBand({email:'client@example.com',emailVerified:true}),false);
});

import { songKey,matchingSongs,exactSong,songDetails } from '../dist/song-model.js';
test('song identity ignores case and spaces while allowing another artist',async()=>{
 assert.equal(await songKey('  All   of Me ','John Legend'),await songKey('all of me','JOHN LEGEND'));
 assert.notEqual(await songKey('All of Me','John Legend'),await songKey('All of Me','Other artist'));
 const songs=[{title:'All of Me',artist:'John Legend'},{title:'All of Me',artist:'Other artist'}];
 assert.equal(matchingSongs(songs,'OF M').length,2);assert.equal(exactSong(songs,'all of me','JOHN LEGEND'),songs[0]);
 assert.deepEqual(songDetails({}),{bpm:null,year:null,seconds:null});assert.throws(()=>songDetails({seconds:-1}));
});


import {sameIds,mergeDetails} from '../dist/plan-model.js';
test('live song syncing keeps unfinished details and detects competing detail edits',()=>{
 const baseline={event:'Wedding',notes:'',date:'2027-06-12',startTime:'18:00',endTime:'22:00'};
 const local={...baseline,notes:'Unfinished notes'};
 const remote={...baseline,startTime:'19:00'};
 const result=mergeDetails(local,baseline,remote);assert.equal(result.values.notes,'Unfinished notes');assert.equal(result.values.startTime,'19:00');assert.deepEqual(result.conflicts,[]);
 assert.deepEqual(mergeDetails(local,baseline,{...remote,notes:'Someone else edited'}).conflicts,['notes']);
 assert.equal(sameIds([0,1],[1,0]),false);assert.equal(sameIds([],[]),true);
});

test('composition years include older classical and ancient works',()=>{for(const year of [1680,-1950,-2000])assert.equal(songDetails({year}).year,year);assert.throws(()=>songDetails({year:-2001}));});
