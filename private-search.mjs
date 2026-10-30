/* Local-only search over an already decrypted patient vault view. No fetch, no telemetry. */
const strips=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export const PRIVATE_SEARCH_STORES=Object.freeze(["symptoms","tasks","conditions","medications","appointments","conversations"]);
export function searchPrivateRecords(data,query,{limit=20,agentId=null}={}){
 const q=strips(query).trim();
 if(q.length<2||q.length>100)return [];
 const max=Math.max(1,Math.min(30,Math.trunc(Number(limit)||20)));
 const results=[];
 const desc={
  symptoms:["health","name","notes","date"],
  tasks:["tasks","title","", "due"],
  conditions:["conditions","name","notes","created"],
  medications:["medications","name","notes","created"],
  appointments:["appointments","title","questions","date"],
  conversations:["chat","body","","time"]
 };
 for(const store of PRIVATE_SEARCH_STORES){
  const [tab,labelKey,detailKey,dateKey]=desc[store];
  const records=Array.isArray(data?.[store])?data[store]:[];
  for(const item of records){
   if(store==="conversations"&&agentId!==null&&(item.agentId||"general")!==agentId)continue;
   const label=String(item?.[labelKey]||"").slice(0,170),detail=String(detailKey?item?.[detailKey]||"":"").slice(0,300);
   if(!strips(label+" "+detail).includes(q))continue;
   results.push({store,tab,id:item?.id,label:label||"Sans titre",snippet:detail,date:String(item?.[dateKey]||"").slice(0,16)});
   if(results.length>=max)return results;
  }
 }
 return results;
}
