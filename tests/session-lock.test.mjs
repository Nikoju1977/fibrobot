import test from "node:test";
import assert from "node:assert/strict";
import {AUTO_LOCK_SETTING,sanitizeAutoLockMinutes,storedAutoLockMinutes,shouldLockForInactivity} from "../session-lock.mjs";
test("Session vault: default 15-minute inactivity lock and safe configuration",()=>{
 assert.equal(storedAutoLockMinutes(),15);
 assert.equal(storedAutoLockMinutes([{id:AUTO_LOCK_SETTING,value:5}]),5);
 assert.equal(storedAutoLockMinutes([{id:AUTO_LOCK_SETTING,value:0}]),0);
 assert.equal(storedAutoLockMinutes([{id:AUTO_LOCK_SETTING,value:999}]),15);
 for(const n of [0,5,15,30])assert.equal(sanitizeAutoLockMinutes(n),n);
 for(const n of [-1,1,8,45,NaN,Infinity,"",null,undefined])assert.throws(()=>sanitizeAutoLockMinutes(n),/non valide/);
});
test("Session vault: locks at threshold, never for invalid or reversed clocks",()=>{
 const last=Date.UTC(2026,9,30,12,0,0);
 assert.equal(shouldLockForInactivity(last,last+14*60*1000,15),false);
 assert.equal(shouldLockForInactivity(last,last+15*60*1000,15),true);
 assert.equal(shouldLockForInactivity(last,last+60*60*1000,0),false);
 assert.equal(shouldLockForInactivity(last,last-10,15),false);
 assert.equal(shouldLockForInactivity(NaN,last+10000000,15),false);
});
