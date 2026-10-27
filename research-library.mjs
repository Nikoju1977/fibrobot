/* Recherche bibliographique volontaire — Europe PMC, catalogue scientifique public.
 * Aucun détail de santé ou texte libre du patient n'est transmis à cette API.
 * Seules des requêtes prédéfinies sont émises après un clic explicite.
 */
import {RESEARCH_TOPICS,researchEndpoint,parseResearchResults} from "./assistant-engine.mjs";
export {RESEARCH_TOPICS};
export async function findScientificArticles(topic,{signal}={}){
 const url=researchEndpoint(topic);
 const timeout=new AbortController();
 const cancel=()=>timeout.abort();
 signal?.addEventListener("abort",cancel,{once:true});
 const timer=setTimeout(cancel,18000);
 try{
  const response=await fetch(url,{method:"GET",mode:"cors",credentials:"omit",cache:"no-store",signal:timeout.signal});
  if(!response.ok)throw Error("Service scientifique indisponible (HTTP "+response.status+").");
  const data=await response.json();
  return parseResearchResults(data);
 }catch(error){
  if(error?.name==="AbortError")throw Error("La consultation a dépassé le délai ou a été interrompue. Vérifiez votre connexion.");
  throw error;
 }finally{clearTimeout(timer);signal?.removeEventListener("abort",cancel);}
}
export function externalResearchLink(topic){
 const selected=RESEARCH_TOPICS.find(x=>x.id===topic);
 if(!selected)throw Error("Sujet inconnu.");
 return "https://europepmc.org/search?query="+encodeURIComponent(selected.query);
}
