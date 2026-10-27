import test from "node:test";
import assert from "node:assert/strict";
import {GUIDE_SETTING,shouldShowGuide} from "../ux-pro.mjs";

test("accueil patient : parcours de découverte au premier déverrouillage",()=>{
 assert.equal(GUIDE_SETTING,"onboardingComplete");
 assert.equal(shouldShowGuide([]),true);
 assert.equal(shouldShowGuide([{id:"energy",value:7}]),true);
 assert.equal(shouldShowGuide([{id:GUIDE_SETTING,value:false}]),true);
});
test("accueil patient : choix mémorisé dans le coffre chiffré",()=>{
 assert.equal(shouldShowGuide([{id:GUIDE_SETTING,value:true}]),false);
 assert.equal(shouldShowGuide([{id:"energy",value:5},{id:GUIDE_SETTING,value:true}]),false);
});
