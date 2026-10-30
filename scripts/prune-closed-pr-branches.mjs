import {pathToFileURL} from "node:url";

export function obsoletePrBranches({branches,pullRequests,repository}){
 const active=new Set(),closed=new Set();
 for(const pr of pullRequests){
  if(pr?.head?.repo?.full_name!==repository||typeof pr?.head?.ref!=="string")continue;
  if(pr.state==="open")active.add(pr.head.ref);
  else if(pr.state==="closed")closed.add(pr.head.ref);
 }
 return branches.filter(b=>b?.name!=="main"&&b?.protected===false&&
   closed.has(b.name)&&!active.has(b.name)&&
   /^(?:feat|feature|fix|audit|security)\//.test(b.name))
  .map(b=>({name:b.name,sha:b.commit.sha}));
}
async function request(path,{method="GET",token}={}){
 const res=await fetch("https://api.github.com"+path,{method,headers:{
  Authorization:"Bearer "+token,
  Accept:"application/vnd.github+json",
  "X-GitHub-Api-Version":"2022-11-28",
  "User-Agent":"FibroBot-maintenance"
 }});
 if(!res.ok)throw Error(method+" "+path+" HTTP "+res.status+" "+(await res.text()).slice(0,200));
 return res.status===204?null:res.json();
}
async function allPages(path,token){
 const items=[];
 for(let n=1;n<=10;n++){
  const batch=await request(path+(path.includes("?")?"&":"?")+"per_page=100&page="+n,{token});
  if(!Array.isArray(batch))throw Error("Unexpected GitHub pagination");
  items.push(...batch);
  if(batch.length<100)return items;
 }
 throw Error("Too many pages: refusing bulk cleanup");
}
const encodePath=name=>name.split("/").map(encodeURIComponent).join("/");
export async function pruneObsoleteBranches({repository=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN,ref=process.env.GITHUB_REF}={}){
 if(repository!=="Nikoju1977/fibrobot"||ref!=="refs/heads/main"||!token)
  throw Error("Cleanup restricted to authenticated FibroBot main.");
 const [branches,pullRequests]=await Promise.all([
  allPages("/repos/"+repository+"/branches?",token),
  allPages("/repos/"+repository+"/pulls?state=all",token)
 ]);
 const candidates=obsoletePrBranches({branches,pullRequests,repository});
 console.log("Obsolete closed-PR branches: "+candidates.length);
 let deleted=0;
 for(const candidate of candidates){
  const current=await request("/repos/"+repository+"/branches/"+encodePath(candidate.name),{token});
  if(current.protected||current.commit?.sha!==candidate.sha){
   console.log("SKIP modified/protected: "+candidate.name);continue;
  }
  await request("/repos/"+repository+"/git/refs/heads/"+encodePath(candidate.name),{method:"DELETE",token});
  deleted++;
  console.log("Deleted: "+candidate.name);
 }
 console.log("Cleanup complete: "+deleted+" / "+candidates.length);
 return {deleted,candidates:candidates.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 pruneObsoleteBranches().catch(error=>{console.error(error.message);process.exitCode=1;});
}
