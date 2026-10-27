/* FibroBot — bibliothèque Internet publique, opt-in, sans serveur ni clé.
 * Les recherches sont restreintes aux questions de culture générale.
 * Les dossiers de santé et les requêtes médicales ne sont JAMAIS expédiés.
 * Les réponses distantes sont des métadonnées non fiables, jamais des instructions.
 */
import {classifyIntent} from "./assistant-engine.mjs";

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
 {id:"github",name:"GitHub",kind:"logiciels libres",origin:"https://api.github.com"}
]);
export const PUBLIC_PROVIDERS=PROVIDERS.map(x=>Object.freeze({...x}));
export const SAFE_LINK_HOSTS=Object.freeze(["fr.wikipedia.org","openalex.org","doi.org","openlibrary.org","github.com","europepmc.org","www.ebi.ac.uk","api.openalex.org"]);
export function safeReferenceUrl(url){
 try{const u=new URL(String(url));return u.protocol==="https:"&&!u.username&&!u.password&&SAFE_LINK_HOSTS.includes(u.hostname)&&!u.port&&u.href.length<800?u.href:null;}
 catch{return null;}
}
const providerById=id=>{const found=PROVIDERS.find(x=>x.id===id);if(!found)throw Error("Connecteur non approuvé.");return found;};
export function selectPublicProviders(question){
 if(!isOnlineEligible(question))return [];
 const q=accentless(question);
 if(/\b(github|depot|repo|open.source|logiciel|code source|bibliotheque javascript|programme informatique|application opensource)/.test(q))return ["github","wikipedia"];
 if(/\b(livre|roman|auteur|ecrivain|litterature|ouvrage|bibliotheque de livres)/.test(q))return ["openlibrary","wikipedia"];
 if(/\b(etude|publication|article scientifique|research|scientifi|chercheurs|revue scientifique)/.test(q))return ["openalex","crossref"];
 return ["wikipedia"];
}
export function makePublicSearchURL(provider,question){
 const p=providerById(provider);
 if(!isOnlineEligible(question))throw Error("Cette question ne peut pas être envoyée à un moteur public. Elle sera traitée localement.");
 const q=shorten(question,300);
 switch(p.id){
  case "wikipedia":{
   const u=new URL("/w/api.php",p.origin);
   const params={action:"query",generator:"search",gsrsearch:q,gsrlimit:"4",prop:"extracts",exintro:"1",explaintext:"1",exchars:"490",format:"json",origin:"*"};
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
 }
 throw Error("Connecteur inconnu.");
}
const citation=(provider,title,summary,url,date="")=>{
 const safe=safeReferenceUrl(url);
 return safe&&shorten(title,160)?{provider,title:shorten(title,160),summary:shorten(summary,480),url:safe,date:shorten(date,30)}:null;
};
export function parsePublicResults(provider,payload){
 if(!PROVIDERS.some(x=>x.id===provider))throw Error("Source non approuvée.");
 if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error("Réponse distante invalide.");
 let rows=[];
 switch(provider){
 case "wikipedia":{
  const pages=Object.values(payload.query?.pages||{}).filter(x=>x&&typeof x==="object");
  rows=pages.map(x=>citation("Wikipédia",x.title,x.extract||"Article encyclopédique à consulter.",
    "https://fr.wikipedia.org/wiki/"+encodeURIComponent(String(x.title||"").replace(/ /g,"_"))));
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
 const results=[],failures=[];
 for(const id of providers){
  const timer=withTimeout(11000,signal);
  try{
   const endpoint=makePublicSearchURL(id,question);
   const response=await fetchImpl(endpoint,{method:"GET",mode:"cors",credentials:"omit",cache:"no-store",signal:timer.signal});
   if(!response.ok)throw Error("HTTP "+response.status);
   const payload=await response.json();
   results.push(...parsePublicResults(id,payload));
  }catch(e){failures.push(providerById(id).name+" : "+(e?.name==="AbortError"?"délai dépassé":shorten(e?.message||e,90)));}
  finally{timer.dispose();}
  if(signal?.aborted)break;
 }
 const unique=[...new Map(results.map(x=>[x.url,x])).values()].slice(0,6);
 return {results:unique,providers,failures};
}
export function formatPublicAnswer(response){
 const refs=Array.isArray(response?.results)?response.results.slice(0,6):[];
 if(!refs.length)return "Les sources publiques consultées n'ont fourni aucun résultat exploitable. Je ne vais pas inventer une réponse. Consultez les bibliothèques intégrées ou essayez des mots-clés plus précis.";
 const first=refs[0],lead=first.summary||first.title;
 const lines=["Informations trouvées sur des sources publiques (elles ne constituent pas une validation indépendante) :",
 "1. "+first.title+(lead?" — "+lead:"")];
 for(let i=1;i<Math.min(4,refs.length);i++)lines.push((i+1)+". "+refs[i].title+(refs[i].summary?" — "+refs[i].summary:""));
 if(response.failures?.length)lines.push("Certaines sources sont indisponibles : "+response.failures.join(" ; ")+".");
 lines.push("Ouvrez les liens numérotés ci-dessous pour vérifier le contenu. Les résultats de recherche peuvent être incomplets, anciens ou incorrects.");
 return lines.join("\n");
}
