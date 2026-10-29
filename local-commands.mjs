/* V27: deterministic navigation actions only, never device automation.
 * Executed only after the medical emergency gate in app.mjs.
 */
const TARGETS=Object.freeze([
 {tab:"tasks",name:"vos tâches",words:/\b(mes taches|ma liste de taches|liste des taches|ouvre les taches|affiche les taches)\b/},
 {tab:"appointments",name:"vos rendez-vous",words:/\b(mes rendez vous|mes rendez-vous|ouvre les rendez vous|affiche les rendez vous)\b/},
 {tab:"medications",name:"vos traitements déclarés",words:/\b(ouvre mes traitements|affiche mes traitements|page traitements|mes medicaments)\b/},
 {tab:"health",name:"votre suivi de santé",words:/\b(ouvre mon suivi|mes observations|affiche ma sante|page sante)\b/},
 {tab:"crisis",name:"le mode crise",words:/\b(ouvre le mode crise|lance le mode crise|affiche le mode crise)\b/},
 {tab:"library",name:"la bibliothèque",words:/\b(ouvre la bibliotheque|affiche la bibliotheque|page bibliotheque)\b/}
]);
const fold=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
export function parseLocalNavigation(input){
 const q=fold(input).replace(/[-']/g," ").replace(/\s+/g," ");
 if(!/^(?:fibrobot[, :;.!]*)?(?:stp[, :;.!]*|s il te plait[, :;.!]*)?(?:ouvre|affiche|montre|va sur|accede a|mes |ma |mon |le )/.test(q))return null;
 const found=TARGETS.find(t=>t.words.test(q));
 return found?{tab:found.tab,label:found.name}:null;
}
