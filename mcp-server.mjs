#!/usr/bin/env node
/* FibroBot MCP stdio — protocole JSON-RPC 2.0, sans port HTTP.
 * Serveur OPTIONNEL Node.js pour les clients MCP externes.
 * Par sécurité il n'ouvre JAMAIS le coffre local, ne charge aucune donnée
 * patient et n'autorise que les outils publics sans paramètre de dossier.
 */
import {createInterface} from "node:readline";
import {FIBRO_MCP_TOOLS,callFibroTool} from "./mcp-fibro-tools.mjs";
const PUBLIC=new Set(["fibro.list_agents","fibro.guidance","fibro.research_topics","fibro.safety"]);
const tools=FIBRO_MCP_TOOLS.filter(x=>PUBLIC.has(x.name)).map(x=>({
 name:x.name,title:x.title,description:x.description,
 inputSchema:{type:"object",additionalProperties:false,
  properties:Object.fromEntries(x.input.map(k=>[k,{type:"string",maxLength:200}])),
  required:x.name==="fibro.safety"?["question"]:x.name==="fibro.guidance"?["topic"]:[]
 }
}));
const output=x=>process.stdout.write(JSON.stringify(x)+"\n");
const ok=(id,result)=>output({jsonrpc:"2.0",id,result});
const error=(id,code,message)=>output({jsonrpc:"2.0",id,error:{code,message}});
const latest=["2025-06-18","2025-03-26"];
export async function dispatchMCP(msg){
 if(!msg||msg.jsonrpc!=="2.0"||typeof msg.method!=="string")return {error:{code:-32600,message:"Invalid Request"}};
 const method=msg.method,params=msg.params||{};
 if(method==="notifications/initialized"||method.startsWith("notifications/"))return {notification:true};
 if(method==="initialize"){
  const version=latest.includes(params.protocolVersion)?params.protocolVersion:latest[0];
  return {result:{protocolVersion:version,capabilities:{tools:{listChanged:false}},serverInfo:{name:"fibrobot-public-mcp",version:"1.0.0"}}};
 }
 if(method==="ping")return {result:{}};
 if(method==="tools/list")return {result:{tools}};
 if(method==="tools/call"){
  const name=params.name,args=params.arguments||{};
  if(!PUBLIC.has(name))return {result:{content:[{type:"text",text:"Outil non exposé : aucune donnée patient accessible via ce serveur."}],isError:true}};
  try{
   const data=callFibroTool(name,args,{});
   return {result:{content:[{type:"text",text:JSON.stringify(data)}],isError:false}};
  }catch(e){return {result:{content:[{type:"text",text:String(e?.message||e).slice(0,300)}],isError:true}};}
 }
 return {error:{code:-32601,message:"Method not found"}};
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 const rl=createInterface({input:process.stdin,crlfDelay:Infinity});
 rl.on("line",async line=>{
  try{
   if(line.length>20000)return;
   const msg=JSON.parse(line);
   const ret=await dispatchMCP(msg);
   if(ret.notification||!Object.hasOwn(msg,"id"))return;
   if(ret.error)error(msg.id,ret.error.code,ret.error.message);
   else ok(msg.id,ret.result);
  }catch(e){error(null,-32700,"Parse error");}
 });
}
