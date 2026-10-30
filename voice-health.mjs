/* FibroBot V28 - speech capability and bounded local voice selection. No network and no recording. */
export function frenchLocalVoices(synthesis){
 let voices=[];
 try{voices=typeof synthesis?.getVoices==="function"?synthesis.getVoices():[];}catch{return [];}
 return (Array.isArray(voices)?voices:[]).filter(v=>v?.localService===true&&/^fr(?:[-_]|$)/i.test(String(v.lang||"")));
}
export function preferredLocalVoice(synthesis){
 const voices=frenchLocalVoices(synthesis);
 return voices.find(v=>/^fr[-_]FR$/i.test(String(v.lang||"")))||voices[0]||null;
}
export function speechErrorMessage(error){
 const code=String(error?.error||error||"unknown").slice(0,55);
 if(code==="canceled"||code==="interrupted")return "Lecture arrêtée.";
 if(code==="not-allowed")return "La synthèse vocale est bloquée par le navigateur.";
 return "Lecture vocale indisponible ("+code+").";
}
