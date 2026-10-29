/* Per-session self-imposed remote request guard; NOT a guarantee of zero fees.
 * Accounts retain their own provider usage, tariffs, and rate limits.
 */
const REQUEST_CAPS=Object.freeze([5,10,20]);
let cap=10,counts={agnes:0,mistral:0};
export function apiBudgetStatus(){
 return Object.freeze({cap,used:counts.agnes+counts.mistral,remaining:Math.max(0,cap-counts.agnes-counts.mistral),byProvider:{...counts}});
}
export function configureApiBudget(value){
 const next=Number(value);
 if(!REQUEST_CAPS.includes(next))throw Error("Limite de session non autorisée.");
 if(next<counts.agnes+counts.mistral)throw Error("La limite ne peut pas être inférieure aux appels déjà effectués.");
 cap=next;return apiBudgetStatus();
}
export function reserveApiRequest(provider){
 if(!["agnes","mistral"].includes(provider))throw Error("Fournisseur inconnu.");
 if(counts.agnes+counts.mistral>=cap)throw Error("Limite volontaire d'appels IA de cette session atteinte. Reconnectez-vous dans une nouvelle session ou utilisez la bibliothèque.");
 counts[provider]++;return apiBudgetStatus();
}
export function resetApiBudget(){
 cap=10;counts={agnes:0,mistral:0};return apiBudgetStatus();
}
