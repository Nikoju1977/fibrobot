/* FibroBot — commandes simples et histoires originales, local-first.
 * Aucune navigation automatique ni exécution de commande système.
 * Seules les URL explicites de cette liste peuvent être proposées à l'ouverture.
 */
const SITES=Object.freeze([
 {id:"youtube",label:"YouTube",url:"https://www.youtube.com/",words:/\byoutube\b/},
 {id:"facebook",label:"Facebook",url:"https://www.facebook.com/",words:/\bfacebook\b/},
 {id:"whatsapp",label:"WhatsApp",url:"https://web.whatsapp.com/",words:/\bwhatsapp\b/},
 {id:"google-maps",label:"Google Maps",url:"https://www.google.com/maps",words:/\b(?:google maps|maps|cartes google)\b/},
 {id:"wikipedia",label:"Wikipédia",url:"https://fr.wikipedia.org/",words:/\b(?:wikipedia|wikip[eé]dia)\b/},
 {id:"gmail",label:"Gmail",url:"https://mail.google.com/",words:/\bgmail\b/},
 {id:"google-calendar",label:"Google Agenda",url:"https://calendar.google.com/",words:/\b(?:google agenda|google calendar|agenda google)\b/},
 {id:"gutenberg",label:"Projet Gutenberg",url:"https://www.gutenberg.org/",words:/\b(?:gutenberg|livres libres)\b/},
 {id:"spotify",label:"Spotify",url:"https://open.spotify.com/",words:/\bspotify\b/},
 {id:"google",label:"Google",url:"https://www.google.com/",words:/\bgoogle\b/}
]);
const clean=value=>String(value??"").trim().slice(0,1000);
const nrm=q=>q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’]/g,"'");
export function knownSite(id){return SITES.find(s=>s.id===id)||null;}
export function parseSiteCommand(question){
 const q=nrm(clean(question));
 if(!/^(?:fibrobot[ ,:;.!]*)?(?:s'il te plait[ ,:;.!]*)?(?:ouvre(?:-moi)?|lance|va sur|affiche|accede a|emmene.moi sur)\b/.test(q))return null;
 const found=SITES.filter(s=>s.words.test(q));
 // Google is a generic substring of Google Maps and Google Agenda.
 const matches=found.length>1?found.filter(s=>s.id!=="google"):found;
 // Never resolve arbitrary URLs, extensions, system settings or conflicting sites.
 if(matches.length!==1)return null;
 return {kind:"site",siteId:matches[0].id,label:matches[0].label};
}
const stories=Object.freeze([
 {id:"forest",title:"La lumière au bout du sentier",text:"Au bord d'une forêt dormait une petite lanterne que personne n'avait allumée depuis longtemps. Un soir, une promeneuse s'arrêta près d'elle et lui confia : « Je ne sais plus très bien où aller. » La lanterne ne prétendit pas connaître le chemin. Elle éclaira simplement le premier pas. La promeneuse découvrit une pierre plate, puis un pont de bois, puis un jardin qui sentait le thym. Elle comprit que le sentier n'avait pas besoin d'être parcouru d'un seul élan. Au matin, elle revint près de la lanterne et posa une fleur à son pied. La forêt n'avait pas changé. Mais le premier pas lui semblait désormais possible."},
 {id:"space",title:"Le jardinier des étoiles",text:"Dans une petite station qui tournait autour de Saturne, un jardinier cultivait des graines venues de la Terre. Le silence de l'espace était immense, et pourtant il parlait chaque matin à ses plantes. Une nuit, il vit une étoile clignoter trois fois. Il répondit en allumant trois lampes de sa serre. Les soirs suivants, le même signal revint, à travers les anneaux glacés. Le jardinier ne sut jamais qui se trouvait là-bas. Mais l'idée qu'un autre être admirait la lumière lui donna envie de planter des fleurs bleues. Quelques semaines plus tard, sa serre était devenue un petit ciel à elle seule."},
 {id:"ocean",title:"La bibliothèque des marées",text:"Une libraire vivait dans une maison près de la mer. Chaque fois qu'une vague atteignait son seuil, elle découvrait sur la plage une page blanche. Au lieu de vouloir tout comprendre, elle écrivait dessus une chose qu'elle avait aimée dans la journée : une odeur de café, le rire d'une amie, un nuage rose. Peu à peu, les pages formèrent un livre sans ordre et sans fin. Un enfant lui demanda un jour comment se terminait l'histoire. La libraire sourit : « Je ne sais pas encore. Et c'est une belle raison d'ouvrir le livre demain. »"}
]);
export function originalStory(question){
 const q=nrm(clean(question));
 const theme=/espace|etoile|planete|astronaut|galax|fus[eé]e|saturne|lune/.test(q)?"space":/mer|ocean|bateau|plage|vague/.test(q)?"ocean":"forest";
 const story=stories.find(x=>x.id===theme);
 return {kind:"story",title:story.title,text:story.title+"\n\n"+story.text+"\n\nSi vous voulez, je peux vous en raconter une autre ou lire celle-ci à voix haute avec une voix locale disponible."};
}
export function parseStoryCommand(question){
 const q=nrm(clean(question));
 return /(?:raconte(?:-moi)?|invente(?:-moi)?|lis(?:-moi)?|lecture)\b/.test(q)&&/(?:histoire|conte|recit|aventure)/.test(q);
}
export function parseReadingCommand(question){
 const q=nrm(clean(question));
 return /(?:lis(?:-moi)?|lire|lecture|raconte(?:-moi)?)/.test(q)&&/(?:livre|roman|texte|fichier|document|chapitre)/.test(q);
}
