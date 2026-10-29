/* Private, bounded EPUB/DOCX text extraction and PDF preview.
 * Entirely browser-side; no CDN, no remote uploads, no script execution.
 * ZIP64, archives with encryption, external resources and huge files are refused.
 */
import {normalizeBookText} from "./book-reader.mjs";
export const MAX_DOCUMENT_BYTES=12*1024*1024;
const MAX_ENTRY_BYTES=3*1024*1024;
const MAX_TOTAL_BYTES=10*1024*1024;
const decoder=new TextDecoder("utf-8",{fatal:false});
const safePath=value=>{
 const v=String(value||"").replace(/\\/g,"/");
 if(!v||v.startsWith("/")||/^[a-z]+:/i.test(v)||v.includes("?")||v.includes("\u0000"))throw Error("Chemin documentaire externe ou invalide.");
 const pieces=[];
 for(const part of v.split("/")){
  if(!part||part===".")continue;
  if(part===".."){if(!pieces.length)throw Error("Chemin documentaire hors archive.");pieces.pop();continue;}
  pieces.push(part);
 }
 return pieces.join("/");
};
function joinedPath(directory,file){
 if(/^https?:|^data:|^file:/i.test(file)||String(file).startsWith("/"))throw Error("Ressource externe refusée.");
 let decoded=file;
 try{decoded=decodeURIComponent(file);}catch{throw Error("Chemin du livre mal encodé.");}
 return safePath((directory?directory+"/":"")+decoded.split("#")[0]);
}
function xmlDoc(text){
 if(typeof DOMParser!=="function")throw Error("Lecture XML non prise en charge par ce navigateur.");
 const doc=new DOMParser().parseFromString(text,"application/xml");
 if(doc.getElementsByTagName("parsererror").length)throw Error("Document XML invalide.");
 return doc;
}
const xmlAttr=(node,key)=>node?.getAttribute?.(key)||"";
const xmlNodes=(node,name)=>Array.from(node?.getElementsByTagName("*")||[]).filter(x=>x.localName===name);
async function decompress(bytes,method,expected){
 if(method===0){
  if(bytes.byteLength!==expected)throw Error("Taille ZIP incohérente.");
  return bytes;
 }
 if(method!==8||typeof DecompressionStream!=="function")throw Error("Compression du document non prise en charge sur cet appareil.");
 let stream;
 try{stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));}
 catch{throw Error("Décompression ZIP non disponible. Essayez un navigateur plus récent.");}
 const reader=stream.getReader(),chunks=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>MAX_ENTRY_BYTES)throw Error("Document décompressé trop volumineux.");
   chunks.push(value);
  }
 }catch(e){await reader.cancel().catch(()=>{});throw e;}
 if(size!==expected)throw Error("Archive compressée corrompue ou incohérente.");
 const out=new Uint8Array(size);let n=0;for(const part of chunks){out.set(part,n);n+=part.length;}
 return out;
}
/** ZIP central directory parser: only local filenames are returned, never loaded as URLs. */
export async function openBookArchive(file){
 if(!file||!Number.isFinite(file.size)||file.size>MAX_DOCUMENT_BYTES)throw Error("Fichier trop volumineux (limite 12 Mo).");
 const buf=await file.arrayBuffer(),arr=new Uint8Array(buf),view=new DataView(buf);
 if(arr.length<22)throw Error("Archive incomplète.");
 let eocd=-1;
 for(let i=arr.length-22;i>=Math.max(0,arr.length-65557);i--){
  if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 }
 if(eocd<0)throw Error("Archive ZIP invalide.");
 const count=view.getUint16(eocd+10,true),dirSize=view.getUint32(eocd+12,true),dirOffset=view.getUint32(eocd+16,true);
 if(count>256||dirSize===0xffffffff||dirOffset===0xffffffff||dirOffset+dirSize>eocd)throw Error("Archive trop grande ou format ZIP64 non accepté.");
 const entries=new Map();let pos=dirOffset,total=0;
 for(let n=0;n<count;n++){
  if(pos+46>arr.length||view.getUint32(pos,true)!==0x02014b50)throw Error("Index ZIP corrompu.");
  const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true);
  const compressed=view.getUint32(pos+20,true),uncompressed=view.getUint32(pos+24,true);
  const nameLen=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true);
  const offset=view.getUint32(pos+42,true),end=pos+46+nameLen+extra+comment;
  if(end>arr.length)throw Error("Archive ZIP tronquée.");
  const name=safePath(decoder.decode(arr.subarray(pos+46,pos+46+nameLen)));
  pos=end;
  if(name.endsWith("/")||!name)continue;
  if(flags&1)throw Error("Archive protégée par mot de passe non prise en charge.");
  if(method!==0&&method!==8)throw Error("Compression ZIP inconnue.");
  if(uncompressed>MAX_ENTRY_BYTES||compressed>MAX_DOCUMENT_BYTES)throw Error("Entrée ZIP trop volumineuse.");
  total+=uncompressed;if(total>MAX_TOTAL_BYTES)throw Error("Archive décompressée trop volumineuse.");
  if(offset+30>arr.length||view.getUint32(offset,true)!==0x04034b50)throw Error("Entrée ZIP invalide.");
  const dataStart=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);
  if(dataStart+compressed>arr.length)throw Error("Données ZIP tronquées.");
  if(entries.has(name))throw Error("Entrée documentaire dupliquée.");
  entries.set(name,{method,compressed,uncompressed,start:dataStart});
 }
 return {
  paths:[...entries.keys()],
  async get(path){
   const key=safePath(path),meta=entries.get(key);
   if(!meta)throw Error("Page documentaire introuvable.");
   const bytes=await decompress(arr.slice(meta.start,meta.start+meta.compressed),meta.method,meta.uncompressed);
   return decoder.decode(bytes);
  }
 };
}
function docxText(xml){
 const doc=xmlDoc(xml),paragraphs=xmlNodes(doc,"p"),out=[];
 for(const p of paragraphs){
  const content=xmlNodes(p,"t").map(x=>x.textContent||"").join("").trim();
  if(content)out.push(content);
 }
 return out.join("\n");
}
async function epubText(zip){
 const container=xmlDoc(await zip.get("META-INF/container.xml"));
 const root=xmlNodes(container,"rootfile")[0],opfPath=safePath(xmlAttr(root,"full-path"));
 if(!opfPath)throw Error("Structure EPUB manquante.");
 const opf=xmlDoc(await zip.get(opfPath)),base=opfPath.includes("/")?opfPath.slice(0,opfPath.lastIndexOf("/")):"";
 const manifest=new Map();
 for(const item of xmlNodes(opf,"item")){
  const id=xmlAttr(item,"id"),href=xmlAttr(item,"href"),type=xmlAttr(item,"media-type");
  if(id&&href&&(type==="application/xhtml+xml"||type==="text/html"))manifest.set(id,href);
 }
 const pages=[];
 for(const ref of xmlNodes(opf,"itemref").slice(0,100)){
  const href=manifest.get(xmlAttr(ref,"idref"));if(!href)continue;
  const raw=await zip.get(joinedPath(base,href)),doc=xmlDoc(raw);
  const body=xmlNodes(doc,"body")[0];if(!body)continue;
  const para=xmlNodes(body,"p").concat(xmlNodes(body,"h1"),xmlNodes(body,"h2"),xmlNodes(body,"li"));
  const txt=para.length?para.map(x=>x.textContent.trim()).filter(Boolean).join("\n"):body.textContent.trim();
  if(txt)pages.push(txt);
  if(pages.join("\n\n").length>1024*1024)throw Error("Texte du livre trop volumineux (limite 1 Mo).");
 }
 if(!pages.length)throw Error("Aucun chapitre EPUB lisible.");
 return pages.join("\n\n");
}
export async function openPrivateDocument(file){
 const name=String(file?.name||"");
 if(!Number.isFinite(file?.size)||file.size>MAX_DOCUMENT_BYTES)throw Error("Fichier trop volumineux (limite 12 Mo).");
 if(/\.pdf$/i.test(name)){
  const bytes=new Uint8Array(await file.slice(0,5).arrayBuffer());
  if(!decoder.decode(bytes).startsWith("%PDF-"))throw Error("PDF invalide.");
  return {kind:"pdf",file};
 }
 if(/\.(?:txt|md)$/i.test(name)){
  if(file.size>1024*1024)throw Error("Fichier texte trop volumineux (1 Mo maximum).");
  return {kind:"text",text:normalizeBookText(await file.text()),format:"texte"};
 }
 if(!/\.(?:epub|docx)$/i.test(name))throw Error("Formats autorisés : TXT, MD, EPUB, DOCX ou PDF.");
 const zip=await openBookArchive(file);
 const raw=/\.epub$/i.test(name)?await epubText(zip):docxText(await zip.get("word/document.xml"));
 return {kind:"text",text:normalizeBookText(raw),format:/\.epub$/i.test(name)?"EPUB":"DOCX"};
}
