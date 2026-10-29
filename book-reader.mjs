/* Text reader — deliberately local and transient.
 * Only UTF-8 plain text or Markdown. No DRM removal, uploads or HTML parsing.
 */
export const MAX_BOOK_BYTES=1024*1024;
export const PAGE_CHARS=2400;
export function normalizeBookText(raw){
 const value=String(raw??"").replace(/\r\n?/g,"\n").replace(/\u0000/g,"").trim();
 if(!value)throw Error("Le livre ou le texte est vide.");
 if(value.length>MAX_BOOK_BYTES)throw Error("Texte trop volumineux pour la lecture locale.");
 return value;
}
export function validateBookFile(file){
 if(!file||!/\.(?:txt|md)$/i.test(String(file.name||"")))throw Error("Choisissez un fichier .txt ou .md. Les PDF et EPUB ne sont pas lus dans ce module.");
 if(!Number.isFinite(file.size)||file.size>MAX_BOOK_BYTES)throw Error("Fichier trop volumineux (maximum 1 Mo).");
 return true;
}
export function pageCount(content,size=PAGE_CHARS){
 const n=Math.max(1,Math.min(10000,Math.floor(Number(size)||PAGE_CHARS)));
 return Math.max(1,Math.ceil(String(content||"").length/n));
}
export function readerPage(content,page=0,size=PAGE_CHARS){
 const text=normalizeBookText(content);
 const count=pageCount(text,size),index=Math.max(0,Math.min(count-1,Math.floor(Number(page)||0)));
 return {text:text.slice(index*size,(index+1)*size),page:index,count};
}
export function splitSpeech(text,max=190){
 const source=String(text??"").replace(/\s+/g," ").trim(),limit=Math.max(60,Math.min(240,max));
 if(!source)return [];
 const words=source.split(" "),parts=[];let current="";
 for(const word of words){
  if(word.length>limit){if(current){parts.push(current);current="";}for(let i=0;i<word.length;i+=limit)parts.push(word.slice(i,i+limit));continue;}
  if(current&&(current.length+word.length+1>limit)){parts.push(current);current=word;}else current+=(current?" ":"")+word;
 }
 if(current)parts.push(current);
 return parts;
}
