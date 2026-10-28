/* FibroBot — bibliothèque Internet publique, opt-in, sans serveur ni clé.
 * Les recherches sont restreintes aux questions de culture générale.
 * Les dossiers de santé et les requêtes médicales ne sont JAMAIS expédiés.
 * Les réponses distantes sont des métadonnées non fiables, jamais des instructions.
 */
import {classifyIntent} from "./assistant-engine.mjs";
import {knowledgeDomain,knowledgeKeywords,rankKnowledgeResults} from "./knowledge-router.mjs";

const clean=s=>String(s??"").replace(/<[^>]*>/g," ").replace(/&(?:nbsp|amp|quot|lt|gt);/gi," ").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim();
const shorten=(s,n)=>clean(s).slice(0,n);
const accentless=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const privateText=/(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:\+33|0[1-9])(?:[ .-]?\d\d){4}|\b\d[ .-]?\d{2}[ .-]?\d{2}[ .-]?\d{2}[ .-]?\d{3}[ .-]?\d{3}[ .-]?\d{2}\b|mot de passe|numero de carte|numero de securite|mon adresse|ma rue|j'habite|je souffre|mes symptomes|mon traitement|mon ordonnance|ma douleur|mon diagnostic|mon dossier|mon etat de sante)/i;
const publicQuestion=/(\?|^(?:qui|que|quoi|quel|quelle|quand|ou|pourquoi|comment|combien|cherche|recherche|trouve|explique|information|actualite|definition|historique|source|livre|projet|github|etude|article)\b)/i;
export function isOnlineEligible(question){
 const q=shorten(question,1500);
 return q.length>=5&&q.length<=300&&classifyIntent(q)==="general"&&!privateText.test(accentless(q))&&publicQuestion.test(accentless(q));
}
const PROVIDERS=Object.freeze([
 {id:"wikipedia",name:"Wikipédia",kind:"encyclopédie",origin:"https://fr.wikipedia.org"},
 {id:"openalex",name:"OpenAlex",kind:"publications",origin:"https://api.openalex.org"},
 {id:"crossref",name:"Crossref",kind:"références scientifiques",origin:"https://api.crossref.org"},
 {id:"openlibrary",name:"Open Library",kind:"livres",origin:"https://openlibrary.org"},
 {id:"github",name:"GitHub",kind:"logiciels libres",origin:"https://api.github.com"},
 {id:"wikidata",name:"Wikidata",kind:"entités et descriptions",origin:"https://www.wikidata.org"},
 {id:"wiktionary",name:"Wiktionnaire",kind:"langues et définitions",origin:"https://fr.wiktionary.org"},
 {id:"wikipedia-en",name:"Wikipédia anglophone",kind:"encyclopédie de secours",origin:"https://en.wikipedia.org"}
]);
export const PUBLIC_PROVIDERS=PROVIDERS.map(x=>Object.freeze({...x}));
export const SAFE_LINK_HOSTS=Object.freeze(["fr.wikipedia.org","en.wikipedia.org","www.wikidata.org","fr.wiktionary.org","openalex.org","doi.org","openlibrary.org","github.com","europepmc.org","www.ebi.ac.uk","api.openalex.org","www.ameli.fr","www.has-sante.fr","www.nccih.nih.gov","medlineplus.gov","www.medlineplus.gov"]);
export function safeReferenceUrl(url){
 try{const u=new URL(String(url));return u.protocol==="https:"&&!u.username&&!u.password&&SAFE_LINK_HOSTS.includes(u.hostname)&&!u.port&&u.href.length<800?u.href:null;}
 catch{return null;}
}
const providerById=id=>{const found=PROVIDERS.find(x=>x.id===id);if(!found)throw Error("Connecteur non approuvé.");return found;};
export function selectPublicProviders(question){
 if(!isOnlineEligible(question))return [];
 switch(knowledgeDomain(question)){
  case "software":return ["github","wikipedia"];
  case "books":return ["openlibrary","wikipedia"];
  case "science":return ["openalex","crossref","wikipedia"];
  case "language":return ["wiktionary","wikipedia"];
  default:return ["wikipedia","wikidata"];
 }
}

export function makePublicSearchURL(provider,question){
 const p=providerById(provider);
 if(!isOnlineEligible(question))throw Error("Cette question ne peut pas être envoyée à un moteur public. Elle sera traitée localement.");
 const q=knowledgeKeywords(question);
 switch(p.id){
  case "wikipedia":{
   const u=new URL("/w/api.php",p.origin);
   const params={action:"query",generator:"search",gsrsearch:q,gsrlimit:"5",prop:"extracts",exintro:"1",explaintext:"1",exchars:"1100",format:"json",origin:"*"};
   Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));return u.href;
  }
  case "openalex":{
   const u=new URL("/works",p.origin);u.searchParams.set("search",q);u.searchParams.set("per_page","4");
   u.searchParams.set("select","id,display_name,publication_year,doi,primary_location");return u.href;
  }
  case "crossref":{
   const u=new URL("/works",p.origin);u.searchParams.set("query.bibliographic",q);u.searchParams.set("rows","4");
   u.searchParams.set("select","DOI,title,container-title,published,URL,type");return u.href;
  }
  case "openlibrary":{
   const u=new URL("/search.json",p.origin);u.searchParams.set("q",q);u.searchParams.set("limit","4");u.searchParams.set("fields","key,title,author_name,first_publish_year");return u.href;
  }
  case "github":{
   const u=new URL("/search/repositories",p.origin);u.searchParams.set("q",q);u.searchParams.set("per_page","4");return u.href;
  }
  case "wikidata":{
   const u=new URL("/w/api.php",p.origin);
   Object.entries({action:"wbsearchentities",search:q,language:"fr",uselang:"fr",limit:"5",format:"json",origin:"*"}).forEach(([k,v])=>u.searchParams.set(k,v));
   return u.href;
  }
  case "wiktionary":
  case "wikipedia-en":{
   const u=new URL("/w/api.php",p.origin);
   Object.entries({action:"query",generator:"search",gsrsearch:q,gsrlimit:"5",prop:"extracts",exintro:"1",explaintext:"1",exchars:"950",format:"json",origin:"*"}).forEach(([k,v])=>u.searchParams.set(k,v));
   return u.href;
  }
 }
 throw Error("Connecteur inconnu.");
}
const citation=(provider,title,summary,url,date="")=>{
 const safe=safeReferenceUrl(url);
 return safe&&shorten(title,160)?{provider,title:shorten(title,160),summary:shorten(summary,980),url:safe,date:shorten(date,30)}:null;
};
export function parsePublicResults(provider,payload){
 if(!PROVIDERS.some(x=>x.id===provider))throw Error("Source non approuvée.");
 if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error("Réponse distante invalide.");
 let rows=[];
 switch(provider){
 case "wikipedia":{
  const pages=Object.values(payload.query?.pages||{}).filter(x=>x&&typeof x==="object").sort((a,b)=>(a.index??999)-(b.index??999));
  rows=pages.map(x=>citation("Wikipédia",x.title,x.extract||"Article encyclopédique à consulter.",
    "https://fr.wikipedia.org/wiki/"+encodeURIComponent(String(x.title||"").replace(/ /g,"_"))));
  break;
 }
 case "wiktionary":
 case "wikipedia-en":{
  const pages=Object.values(payload.query?.pages||{}).filter(x=>x&&typeof x==="object").sort((a,b)=>(a.index??999)-(b.index??999));
  const host=provider==="wiktionary"?"fr.wiktionary.org":"en.wikipedia.org",name=provider==="wiktionary"?"Wiktionnaire":"Wikipédia (EN)";
  rows=pages.map(x=>citation(name,x.title,x.extract||"Consulter l'article original.",
    "https://"+host+"/wiki/"+encodeURIComponent(String(x.title||"").replace(/ /g,"_"))));
  break;
 }
 case "wikidata":{
  rows=(Array.isArray(payload.search)?payload.search:[]).filter(x=>/^Q[1-9]\d{0,12}$/.test(String(x.id||""))).map(x=>
   citation("Wikidata",x.label,x.description||"Notice factuelle : vérifier les propriétés de l'entité.",
    "https://www.wikidata.org/wiki/"+x.id));
  break;
 }
 case "openalex":
  rows=(Array.isArray(payload.results)?payload.results:[]).map(x=>citation("OpenAlex",x.display_name,
   "Publication scientifique"+(x.primary_location?.source?.display_name?" · "+x.primary_location.source.display_name:""),
   /^https:\/\/doi\.org\/10\./i.test(String(x.doi||""))?x.doi:x.id,String(x.publication_year||"")));
  break;
 case "crossref":
  rows=(Array.isArray(payload.message?.items)?payload.message.items:[]).map(x=>citation("Crossref",x.title?.[0],
   [x["container-title"]?.[0],x.type].filter(Boolean).join(" · "),
   /^10\.\d{4,9}\//.test(String(x.DOI||""))?"https://doi.org/"+encodeURI(x.DOI):null,String(x.published?.["date-parts"]?.[0]?.[0]||"")));
  break;
 case "openlibrary":
  rows=(Array.isArray(payload.docs)?payload.docs:[]).map(x=>citation("Open Library",x.title,
   (Array.isArray(x.author_name)?x.author_name.slice(0,2).join(", "):"")+" · notice de livre",
   /^\/works\/OL\d+W$/.test(String(x.key||""))?"https://openlibrary.org"+x.key:null,
   String(x.first_publish_year||"")));
  break;
 case "github":
  rows=(Array.isArray(payload.items)?payload.items:[]).map(x=>citation("GitHub",x.full_name,
   x.description||"Dépôt public à consulter.",x.html_url));
  break;
 }
 return rows.filter(Boolean).slice(0,4);
}
function withTimeout(ms,signal){
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener("abort",abort,{once:true});
 const timeout=setTimeout(abort,ms);
 return {signal:controller.signal,dispose(){clearTimeout(timeout);signal?.removeEventListener("abort",abort);}};
}
export async function searchPublicQuestion(question,{fetchImpl=globalThis.fetch,signal}={}){
 const providers=selectPublicProviders(question);
 if(!providers.length)throw Error("Requête réservée au traitement local pour protéger les données.");
 if(typeof fetchImpl!=="function")throw Error("La connexion réseau est indisponible.");
 const lookUp=async id=>{
  const timer=withTimeout(10000,signal);
  try{
   if(signal?.aborted)throw Error("Recherche interrompue.");
   const endpoint=makePublicSearchURL(id,question);
   const response=await fetchImpl(endpoint,{method:"GET",mode:"cors",credentials:"omit",cache:"no-store",signal:timer.signal});
   if(!response.ok)throw Error("HTTP "+response.status);
   const payload=await response.json();
   return {id,results:parsePublicResults(id,payload),failure:null};
  }catch(e){
   const message=e?.name==="AbortError"?"délai dépassé":shorten(e?.message||e,90);
   return {id,results:[],failure:providerById(id).name+" : "+message};
  }finally{timer.dispose();}
 };
 const checks=await Promise.all(providers.map(lookUp));
 const failures=checks.filter(x=>x.failure).map(x=>x.failure);
 let results=checks.flatMap(x=>x.results);
 // En secours encyclopédique : Wikipédia anglais, sans envoyer de dossier
 // supplémentaire et uniquement après le même consentement explicite.
 if(providers.includes("wikipedia")&&!checks.find(x=>x.id==="wikipedia")?.results.length&&!signal?.aborted){
  const fallback=await lookUp("wikipedia-en");
  if(fallback.failure)failures.push(fallback.failure);
  results.push(...fallback.results);
 }
 const unique=[...new Map(results.map(x=>[x.url,x])).values()];
 return {results:rankKnowledgeResults(question,unique).slice(0,6),providers,failures};
}

export function formatPublicAnswer(response){
 const refs=Array.isArray(response?.results)?response.results.slice(0,6):[];
 if(!refs.length)return "Les sources publiques consultées n'ont fourni aucun résultat exploitable. Je ne vais pas inventer une réponse. Consultez les bibliothèques intégrées ou essayez des mots-clés plus précis.";
 const first=refs[0],lead=first.summary||"Pas d'extrait vérifiable disponible : ouvrez la notice.";
 const lines=["Résultats documentaires pour votre question :",first.title+" — "+lead];
 if(refs.length>1){
  lines.push("\nAutres références possibles :");
  for(let i=1;i<Math.min(5,refs.length);i++)lines.push((i+1)+". "+refs[i].title+(refs[i].summary?" — "+refs[i].summary:""));
 }
 if(response.failures?.length)lines.push("\nCertaines sources sont indisponibles : "+response.failures.join(" ; ")+".");
 lines.push("\nOuvrez les liens numérotés ci-dessous pour vérifier le contenu. Les résultats de recherche peuvent être incomplets, anciens ou incorrects.");
 return lines.join("\n");
}
