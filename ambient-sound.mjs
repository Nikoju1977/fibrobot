/* Optional in-browser ambient sounds. Not a music player or medical intervention.
 * Instantiate audio only after direct button action; stop on session teardown.
 */
export const AMBIENT_TYPES=Object.freeze([
 Object.freeze({id:"rain",name:"Pluie douce"}),
 Object.freeze({id:"ocean",name:"Vagues"}),
 Object.freeze({id:"brown",name:"Bruit brun"}),
 Object.freeze({id:"pink",name:"Bruit rose"}),
 Object.freeze({id:"white",name:"Bruit blanc"})
]);
export function boundedAmbientVolume(value){
 const v=Number(value);if(!Number.isFinite(v))throw Error("Volume invalide.");
 return Math.max(0,Math.min(70,Math.round(v)));
}
export function createAmbientPlayer({AudioContextType}={}){
 let context=null,source=null,gain=null,current=null;
 const ctor=()=>AudioContextType||globalThis.AudioContext||globalThis.webkitAudioContext;
 function stop(){
  try{source?.stop();}catch{}
  try{source?.disconnect();}catch{}
  source=null;
  try{gain?.disconnect();}catch{}
  gain=null;current=null;
 }
 async function play(type,vol=25){
  if(!AMBIENT_TYPES.some(t=>t.id===type))throw Error("Ambiance inconnue.");
  const volume=boundedAmbientVolume(vol);
  if(!context){const C=ctor();if(!C)throw Error("Web Audio non pris en charge sur cet appareil.");context=new C();}
  if(context.state==="suspended")await context.resume();
  stop();
  const seconds=2,size=Math.max(1,Math.round(context.sampleRate*seconds));
  const buffer=context.createBuffer(1,size,context.sampleRate),data=buffer.getChannelData(0);
  let brown=0,pink=0,wind=0;
  for(let i=0;i<size;i++){
   const w=Math.random()*2-1;
   brown=(brown+0.025*w)/1.025;
   pink=0.94*pink+0.06*w;
   wind=(wind+0.014*w)/1.014;
   const wave=type==="white"?w:type==="pink"?pink*3:type==="brown"?brown*6:
    type==="rain"?(w*0.18+pink*1.2):(wind*5)*(0.45+0.45*Math.sin(2*Math.PI*.15*i/context.sampleRate));
   data[i]=Math.max(-1,Math.min(1,wave*0.45));
  }
  const node=context.createBufferSource();node.buffer=buffer;node.loop=true;
  const level=context.createGain();level.gain.value=volume/100*.28;
  const filter=context.createBiquadFilter();
  filter.type="lowpass";filter.frequency.value=type==="rain"?4500:type==="white"?18000:1800;
  node.connect(filter);filter.connect(level);level.connect(context.destination);
  source=node;gain=level;current=type;
  node.start();return type;
 }
 function setVolume(value){const v=boundedAmbientVolume(value);if(gain)gain.gain.value=v/100*.28;return v;}
 async function dispose(){stop();if(context&&context.state!=="closed"){await context.close();}context=null;}
 return Object.freeze({play,stop,setVolume,dispose,currentType:()=>current});
}
