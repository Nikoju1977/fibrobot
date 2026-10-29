import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../ux-pro.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
const voice=readFileSync(new URL("../voice-input.mjs",import.meta.url),"utf8");

test("assistant : la discussion apparaît avant les options de modèles",()=>{
 const section=html.slice(html.indexOf('id="chat"'),html.indexOf('id="tasks"'));
 assert.ok(section.indexOf('id="messages"')<section.indexOf('id="gemma-options"'));
 assert.ok(section.indexOf('id="chat-form"')<section.indexOf('id="gemma-options"'));
 assert.match(section,/id="assistant-diagnostics-panel"/);
 assert.match(section,/id="specialist-list"/);
});
test("assistant : composer multiligne utilisable au clavier et à la voix locale",()=>{
 assert.match(html,/<textarea id="prompt"[^>]*maxlength="2000"/);
 assert.match(html,/id="chat-send" type="submit"/);
 assert.match(html,/id="prompt-count"/);
 assert.match(html,/id="chat-voice-toggle"[^>]*aria-pressed="false"/);
 assert.match(app,/event\.key==="Enter"&&!event\.shiftKey&&!event\.isComposing/);
 assert.match(app,/syncVoiceControls/);
 assert.match(app,/refreshComposer/);
 assert.match(voice,/processLocally:true/);
 assert.match(voice,/processLocally=!allowBrowserService/);
 assert.match(html,/id="dictation-browser-service" type="checkbox"/);
 assert.match(app,/startDictation\(/);
});
test("assistant : boutons de réponse sans HTML brut, sans appels réseau",()=>{
 assert.match(app,/dataset\.chatCopy="1"/);
 assert.match(app,/dataset\.chatRead="1"/);
 assert.match(app,/navigator\.clipboard\.writeText\(answer\)/);
 assert.match(app,/dom\("div",body,"bubble-body"\)/);
 assert.doesNotMatch(app,/\.innerHTML\s*=/);
});
test("assistant : mobile, focus et mouvement réduit",()=>{
 for(const text of [".chat-composer-field:focus-within",".chat-input textarea",".bubble-body",".assistant-hero","@media(max-width:650px)","prefers-reduced-motion"]){
  assert.ok(css.includes(text),text);
 }
});
