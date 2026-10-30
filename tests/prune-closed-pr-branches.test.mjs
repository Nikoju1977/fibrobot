import test from "node:test";
import assert from "node:assert/strict";
import {obsoletePrBranches} from "../scripts/prune-closed-pr-branches.mjs";
const repository="Nikoju1977/fibrobot";
const b=(name,protectedBranch=false)=>({name,protected:protectedBranch,commit:{sha:name}});
const p=(ref,state,repo=repository)=>({state,head:{ref,repo:{full_name:repo}}});
test("Delete only closed PR branches; preserve active main/protected/unrelated branches",()=>{
 const branches=[b("main"),b("feature/v28"),b("feature/v31"),b("feature/active"),b("feature/orphan"),b("fix/old"),b("feature/protected",true)];
 const pullRequests=[p("feature/v28","closed"),p("feature/v31","closed"),p("feature/active","open"),p("fix/old","closed"),p("feature/protected","closed"),p("feature/orphan","closed","SomeoneElse/fibrobot")];
 assert.deepEqual(obsoletePrBranches({branches,pullRequests,repository}).map(x=>x.name),["feature/v28","feature/v31","fix/old"]);
});
test("An open PR wins over older closed PRs for the same branch",()=>{
 assert.equal(obsoletePrBranches({repository,branches:[b("feature/reused")],pullRequests:[p("feature/reused","closed"),p("feature/reused","open")]}).length,0);
});
