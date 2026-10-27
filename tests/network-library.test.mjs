import test from "node:test";
import assert from "node:assert/strict";
import {PUBLIC_PROVIDERS,SAFE_LINK_HOSTS,isOnlineEligible,selectPublicProviders,makePublicSearchURL,
 parsePublicResults,safeReferenceUrl,searchPublicQuestion,formatPublicAnswer} from "../network-library.mjs";

test("catalogue réseau explicite et sécurisé, sans serveur proxy",()=>{
 assert.deepEqual(PUBLIC_PROVIDERS.map(x=>x.id),["wikipedia","openalex","crossref","openlibrary","github"]);
 assert.equal(PUBLIC_PROVIDERS.length,5);
 assert.ok(SAFE_LINK_HOSTS.every(x=>!x.includes("*")));
 assert.throws(()=>makePublicSearchURL("fake","Qui était Marie Curie ?"),/approuvé/);
});

test("pas de données personnelles, santé, prescription, maladie ni question non publique",()=>{
 for(const q of [
  "Quelle dose de tramadol dois-je prendre ?",
  "Quels sont les symptômes de ma fibromyalgie ?",
  "J'ai une douleur dans la poitrine, est-ce grave ?",
  "Comment organiser mes traitements ?",
  "Voici mon email nom@example.com, cherche une association",
  "Qui habite au 12 rue de la Paix ? Voici mon adresse",
  "Je souffre d'une maladie rare, peux-tu me conseiller ?",
  "Mon numéro 0612345678 doit-il être publié ?",
  "Bonjour",
  "Je veux mourir"
 ])assert.equal(isOnlineEligible(q),false,q);
 assert.throws(()=>makePublicSearchURL("wikipedia","Quelle dose de médicament ?"),/ne peut pas être envoyée/);
 assert.deepEqual(selectPublicProviders("Peux-tu diagnostiquer ma maladie ?"),[]);
});

test("connecteurs publics et requêtes séparées selon l'intention",()=>{
 assert.deepEqual(selectPublicProviders("Qui était Marie Curie ?"),["wikipedia"]);
 assert.deepEqual(selectPublicProviders("Cherche un livre sur l'astronomie"),["openlibrary","wikipedia"]);
 assert.deepEqual(selectPublicProviders("Cherche un projet GitHub de musique"),["github","wikipedia"]);
 assert.deepEqual(selectPublicProviders("Recherche un article scientifique sur les étoiles"),["openalex","crossref"]);
 const wiki=new URL(makePublicSearchURL("wikipedia","Qui était Marie Curie ?"));
 assert.equal(wiki.origin,"https://fr.wikipedia.org");
 assert.equal(wiki.searchParams.get("origin"),"*");
 assert.equal(wiki.searchParams.get("gsrsearch"),"Qui était Marie Curie ?");
 assert.equal(new URL(makePublicSearchURL("github","Cherche un projet GitHub de musique")).host,"api.github.com");
});

test("URLs référencées : prévention de phishing et de protocoles malveillants",()=>{
 for(const url of ["javascript:alert(1)","http://github.com/moi","https://github.com.evil.example/project",
    "https://github.com@evil.example/","https://evil.example/","https://github.com:8443/p"])assert.equal(safeReferenceUrl(url),null,url);
 assert.match(safeReferenceUrl("https://fr.wikipedia.org/wiki/Physique"),/^https:\/\//);
});

test("parsing minimal : citations externes et texte source jamais HTML exécutable",()=>{
 const wikipedia=parsePublicResults("wikipedia",{query:{pages:{1:{title:"Marie Curie",extract:"Chercheuse en physique."}}}});
 assert.equal(wikipedia.length,1);
 assert.equal(wikipedia[0].provider,"Wikipédia");
 assert.match(wikipedia[0].url,/fr\.wikipedia\.org/);
 const books=parsePublicResults("openlibrary",{docs:[{key:"/works/OL123W",title:"Cosmos",author_name:["Carl Sagan"],first_publish_year:1980},{key:"/secret/notvalid",title:"Secret"}]});
 assert.equal(books.length,1);
 const works=parsePublicResults("openalex",{results:[{display_name:"Science des étoiles",doi:"https://doi.org/10.1000/xyz",publication_year:2023}]});
 assert.equal(works.length,1);
 assert.equal(works[0].date,"2023");
 const crossref=parsePublicResults("crossref",{message:{items:[{DOI:"10.1000/abc",title:["Un article"],"container-title":["Journal"],published:{"date-parts":[[2022]]}}]}});
 assert.equal(crossref[0].provider,"Crossref");
 const gh=parsePublicResults("github",{items:[{full_name:"exemple/outil",description:"Outil public",html_url:"https://github.com/exemple/outil"}]});
 assert.equal(gh[0].title,"exemple/outil");
 assert.equal(parsePublicResults("github",{items:[{full_name:"piège",html_url:"https://evil.example"}]}).length,0);
});

test("recherche explicite : aucune requête si la question n'est pas éligible",async()=>{
 let calls=0;
 const mock=async()=>{calls++;return {ok:true,json:async()=>({})};};
 await assert.rejects(searchPublicQuestion("Mes médicaments : tramadol ?",{fetchImpl:mock}),/local/);
 assert.equal(calls,0);
});

test("fournisseur partiel indisponible : conserver les autres sources et signaler l'échec",async()=>{
 const urls=[];
 const mock=async(url,options)=>{
  urls.push(url);
  assert.equal(options.credentials,"omit");
  assert.equal(options.method,"GET");
  assert.equal(options.mode,"cors");
  if(url.includes("openlibrary"))return {ok:true,json:async()=>({docs:[{key:"/works/OL123W",title:"La science du ciel",author_name:["Exemple"]}]})};
  return {ok:false,status:429};
 };
 const result=await searchPublicQuestion("Cherche un livre sur l'astronomie",{fetchImpl:mock});
 assert.equal(urls.length,2);
 assert.equal(result.results.length,1);
 assert.equal(result.failures.length,1);
 assert.match(formatPublicAnswer(result),/La science du ciel/);
 assert.match(formatPublicAnswer(result),/indisponibles/);
});

test("résultat vide : aucun fait généré artificiellement",()=>{
 assert.match(formatPublicAnswer({results:[]}),/aucun résultat exploitable/);
 const body=formatPublicAnswer({results:[{title:"Article public",provider:"Wikipédia",summary:"Informations sourcées"}]});
 assert.match(body,/Informations sourcées/);
 assert.match(body,/vérifier le contenu/);
});
