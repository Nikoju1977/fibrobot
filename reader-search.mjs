/* Private full-text page lookup. Runs only on a document already opened by the user. */
import {normalizeBookText,PAGE_CHARS} from "./book-reader.mjs";
const fold=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr-FR");
export function findBookPages(content,search,{pageSize=PAGE_CHARS,maxResults=20}={}){
 const text=normalizeBookText(content);
 const q=fold(search).trim().slice(0,100);
 if(q.length<2||q.length>100)return [];
 const corpus=fold(text),results=[],size=Math.max(100,Math.floor(pageSize)||PAGE_CHARS);
 let from=0,at=0;
 while((at=corpus.indexOf(q,from))!==-1&&results.length<Math.min(50,Math.max(1,maxResults))){
  const page=Math.floor(at/size);
  if(!results.some(r=>r.page===page))results.push({page,preview:text.slice(Math.max(0,at-35),Math.min(text.length,at+q.length+55)).replace(/\s+/g," ").trim().slice(0,150)});
  from=at+q.length;
 }
 return results;
}
