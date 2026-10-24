import { resetVectorIds } from "../exploration-packages/space-life-support/vector-author";
import { CastleDrawing } from "./CastleDrawing";
import { createFortress } from './castleStructure';
import { createLandscape, updateLandscape, createEvidence } from './castleLandscape';
import { castleMaterials } from './castleMaterials';
import { defaultCastleState, castleObservation, type CastleState } from './castleState';
import { resources, resetResources } from './scene-builder';

/** All castle-specific visual construction, teaching and interaction live in this package. */
let topic: 'routes' | 'views' = 'routes';
let prediction: string | null = null;
let tested = false;
const modelNote = '13th-century English-inspired composite, not a reconstruction. Dimensions are schematic; ditch width is compressed in the view. Ditches could be wet or dry. Sight lines illustrate positions, not weapon ranges. Routes and visibility do not predict a siege result.';
type Input = {type: string; values: Record<string,number>; control?:string};
function run(input: Input) {
  if (input.type === 'reset') {topic = 'routes'; prediction = null; tested = false;}
  const values = input.type === 'reset' ? {} : input.values;
  const state: CastleState = {...defaultCastleState,
    moat: values.moat ?? 22, towers: (values.towers ?? 1) === 1,
    gate: (values.gate ?? 1) === 1, inner: (values.inner ?? 0) === 1,
    approach: values.approach === 1 ? 'north' : 'bridge', sight: (values.sight ?? 0) === 1,
  };
  if (input.control === 'compareRoutes' || input.control === 'compareViews') {
    topic = input.control === 'compareRoutes' ? 'routes' : 'views'; prediction = null; tested = false;
  } else if (input.control === 'predictYes' || input.control === 'predictNo') {
    prediction = input.control === 'predictYes' ? 'Yes' : 'No'; tested = false;
  } else if (input.control === 'testPrediction') {
    if (topic === 'routes') {state.moat = 22; state.gate = false; state.approach = tested && state.approach === 'bridge' ? 'north' : 'bridge';}
    else {state.towers = tested ? !state.towers : false; state.sight = true;}
    tested = true;
  }
  resetResources();
  resetVectorIds();
  const material = castleMaterials(), fortress = createFortress(material), landscape = createLandscape(material);
  fortress.towers.visible = state.towers;
  fortress.inner.visible = state.inner;
  fortress.gate.position.y = state.gate ? 0 : 4.9;
  updateLandscape(landscape.ditch, landscape.bridge, state, material);
  const evidence = createEvidence(state, material);
  const observation = castleObservation(state);
  const question = topic === 'routes' ? 'Does opening the gate open both approaches?' : 'Can a flat wall give the same view along its base as a projecting tower?';
  const action = topic === 'routes' ? 'Open the gate. Compare the bridge with the north route, keeping the ditch at 22 m.' : 'Keep the route and ditch fixed. Remove the corner towers, then add them back. Follow the dashed sight-line overlay at the front corner.';
  const explain = tested
    ? topic === 'routes' ? 'The bridge reaches the open entrance. On the north side, the ditch still interrupts the route. Even without a ditch, that route meets a solid wall, not a doorway. Why does an entrance need extra protection?' : 'A tower projects beyond the wall, giving an observer a position to look along its outside face. The lines show possible views, not weapon range or a guaranteed defense. Why does standing farther out change what is visible?'
    : topic === 'routes' ? 'What still stops the north approach when the gate is open? Use the route endpoint as evidence.' : 'Which part of the wall can an observer on a projecting tower see? Compare the lines with and without towers.';
  const toggle = (id: string, label: string, checked: boolean) => ({id,label,kind:'toggle',min:0,max:1,step:1,value:checked?1:0});
  return {
    animate:false, shapes:[],
    fallbackVector:{viewBox:[0,0,720,420],description:`Castle plan: ${observation}`,nodes:[CastleDrawing(state)]},
    description:`${state.moat} m ditch; ${state.gate ? 'closed' : 'raised'} portcullis; ${state.towers ? 'four projecting corner towers' : 'no projecting corner towers'}; ${state.inner ? 'an additional inner wall' : 'one outer wall'}. The ${state.approach} route ${observation}. ${state.towers ? 'Projecting towers give views along adjoining walls.' : 'Without projecting towers, wall-side visibility is reduced.'} ${state.inner ? 'The inner wall adds another barrier; it does not make the castle invincible.' : ''}`,
    sections:[{heading:'1. Predict',text:`${question}${prediction ? ` Your prediction: ${prediction}.` : ''}`,buttonIds:['predictYes','predictNo']},{heading:'2. Compare',text:action,buttonIds:['testPrediction']},{heading:'3. Explain',text:explain}],
    footnote:modelNote,
    controls:[
      {id:'approach',label:'Approach route',kind:'select',min:0,max:1,step:1,value:state.approach==='bridge'?0:1,options:[{value:0,label:'Bridge and gate'},{value:1,label:'Across the north ditch'}]},
      {id:'moat',label:'Ditch width (m)',min:0,max:36,step:1,value:state.moat},
      toggle('gate','Close gate',state.gate),toggle('towers','Projecting towers',state.towers),toggle('inner','Inner wall',state.inner),toggle('sight','Sight-line overlay (not structures)',state.sight),
    ],
    buttons:[{id:'compareRoutes',label:'Compare routes'},{id:'compareViews',label:'Compare sight lines'},{id:'predictYes',label:'Predict yes'},{id:'predictNo',label:'Predict no'},
      {id:'testPrediction',label:topic==='routes' ? tested && state.approach==='bridge' ? 'Compare north route' : 'Test open gate' : tested && !state.towers ? 'Restore towers' : 'Remove corner towers'}],
    scene3d:{
      ...resources(),nodes:[landscape.group.record(),fortress.group.record(),evidence.record()],
      camera:{target:[0,3.2,0],radius:80,yaw:0.62,elevation:0.7,zoom:1,halfHeight:21.5,narrowHalfWidth:28,narrowAspect:1.25,
        presets:[{id:'courtyard',label:'Courtyard',yaw:0.62,elevation:0.7,zoom:1},{id:'entrance',label:'Entrance',yaw:0.1,elevation:0.3,zoom:1.15},{id:'north',label:'North wall',yaw:Math.PI+0.3,elevation:0.7,zoom:1},{id:'overhead',label:'Above',yaw:0.62,elevation:1.42,zoom:1}]},
      lighting:{hemisphere:{sky:0xe7f0e3,ground:0x64614b,intensity:2.2},directional:[{color:0xffe4b8,intensity:3.1,position:[-32,60,35],shadow:{size:2048,extent:48,near:1,far:130,bias:-0.0003,normalBias:0.06,radius:3}},{color:0xb8d2db,intensity:0.5,position:[25,16,-25]}]},
      labels:[{text:'Keep',position:[-3.4,16,-3.3]},{text:'Gatehouse',position:[4.5,12.8,13]},{text:state.towers?'Projecting tower':'Curtain wall',position:[-15,state.towers?12:8,12]}],
      presentation:{title:'What blocks the approach?',subtitle:'Compare the entrance with a route toward a solid wall.',route:`${state.approach==='bridge'?'Bridge route':'North route'} · ${observation}`,background:['#e7e8db','#d5d9c9','#b7c0ad']},
    },
  };
}
self.onmessage = ({data}: MessageEvent<Input>) => self.postMessage(run(data));
