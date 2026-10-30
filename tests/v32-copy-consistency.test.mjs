import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("Public welcome copy matches Agnes-first V32 and public live data sources",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.match(html,/La météo et la qualité de l'air proviennent de services publics actualisés/);
 assert.match(html,/La clé est conservée en mémoire pendant la session/);
 assert.match(html,/sauvegarder chiffrée dans votre coffre/);
 assert.match(html,/Aucun modèle conversationnel à télécharger n'est nécessaire/);
 assert.match(html,/Agnes AI, la météo Open-Meteo, la qualité de l'air/);
 for(const outdated of [
  "Mes 7 agents de soutien spécialisés",
  "Aucun appel à une API météo ou médicale n'est réalisé",
  "La clé est conservée uniquement en mémoire pendant la session",
  "Les poids du modèle peuvent être téléchargés"
 ])assert.ok(!html.includes(outdated),"Obsolete claim must not be shown: "+outdated);
});
