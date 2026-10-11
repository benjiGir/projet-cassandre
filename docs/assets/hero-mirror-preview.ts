import * as THREE from "three";
import { loadHero } from "../../src/render/hero/loadHero";
import { HeroReflection } from "../../src/render/hero/heroReflection";
import { loadWeaponModelsOrPlaceholder } from "../../src/render/viewmodel/weaponModels";
import type { WeaponKind, ViewmodelClocks } from "../../src/game/player/weapons/weaponTypes";

const canvas = document.querySelector<HTMLCanvasElement>("#hero")!;
const status = document.querySelector<HTMLParagraphElement>("#model-status")!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x182227);
scene.add(new THREE.AmbientLight(0xffffff, 1.05));
const key = new THREE.DirectionalLight(0xffe0c3, 1.6);
key.position.set(-2, 4, 3);
scene.add(key);
const fill = new THREE.DirectionalLight(0x8bb4bd, .8);
fill.position.set(3, 2, -3);
scene.add(fill);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshLambertMaterial({color:0x2c3b3e}));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const grid = new THREE.GridHelper(4, 16, 0x506265, 0x35474b);
grid.position.y = .005;
scene.add(grid);
const camera = new THREE.PerspectiveCamera(38, 16/9, .01, 20);
const renderer = new THREE.WebGLRenderer({canvas,antialias:false});
renderer.setSize(640,360,false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
let motion = "idle", angle = .35, close = false, lastAttack = -1000;
let weapon: WeaponKind = "none";
const clocks: ViewmodelClocks = {active:"none",previous:"none",sinceSwitch:1000,sinceKickFire:1000,
  sinceMeleeFire:1000,sincePistolFire:1000,sinceShotgunFire:1000,sinceFlareFire:1000};
const start = performance.now()/1000;
const eyes = new THREE.Vector3(0,1.6,0);
document.querySelectorAll<HTMLButtonElement>("[data-motion]").forEach(button => button.addEventListener("click",()=>{
  motion=button.dataset.motion!;
  document.querySelectorAll<HTMLButtonElement>("[data-motion]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
}));
document.querySelectorAll<HTMLButtonElement>("[data-weapon]").forEach(button => button.addEventListener("click",()=>{
  weapon=button.dataset.weapon as WeaponKind;
  lastAttack=-1000;
  document.querySelectorAll<HTMLButtonElement>("[data-weapon]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
}));
document.querySelector("#turn")!.addEventListener("click",()=>{angle+=Math.PI/4});
document.querySelector("#face")!.addEventListener("click",()=>{close=!close});
document.querySelector("#action")!.addEventListener("click",()=>{lastAttack=performance.now()/1000-start});
try {
  const [asset, models] = await Promise.all([loadHero(),loadWeaponModelsOrPlaceholder()]);
  const hero = new HeroReflection(scene,asset,models);
  hero.root.visible=true;
  status.textContent="Personnage original · repos, déplacement, saut et attaques";
  function frame(){
    const elapsed=performance.now()/1000-start;
    const since=elapsed-lastAttack;
    clocks.active=clocks.previous=weapon;
    clocks.sinceKickFire=weapon==="none"?since:1000;
    clocks.sinceMeleeFire=weapon==="melee"?since:1000;
    clocks.sincePistolFire=weapon==="pistol"?since:1000;
    clocks.sinceShotgunFire=weapon==="shotgun"?since:1000;
    clocks.sinceFlareFire=weapon==="flare"?since:1000;
    eyes.y=1.6+(motion==="jump"?.18:0);
    hero.pose({eyePosition:eyes,eyeHeight:1.6,yaw:Math.PI,pitch:0,elapsed,
      distance:elapsed*(motion==="run"?7:4),movement:motion==="idle"?0:1,
      running:motion==="run"?1:0,grounded:motion!=="jump"},clocks);
    const distance=close?1:3.8;
    camera.position.set(Math.sin(angle)*distance,close?1.65:1.25,Math.cos(angle)*distance);
    camera.lookAt(0,close?1.6:.95,0);
    renderer.render(scene,camera);
    requestAnimationFrame(frame);
  }
  frame();
} catch(error){status.textContent=String(error)}

const game=document.querySelector<HTMLIFrameElement>("#game")!;
const gameStatus=document.querySelector<HTMLParagraphElement>("#game-status")!;
type ReviewWindow=Window & {cassandre?: {tp:(...pose:number[])=>unknown;notarget:(on:boolean)=>unknown;
  campagne:{etat:()=>{playing:boolean;level:string}};weapons:{startUnarmed:()=>void;pickUpPistol:()=>void;pickUpShotgun:()=>void};
  resolution:(w:number,h:number)=>void;filtrage:(mode:string)=>void;renderBench:(frames:number)=>unknown}};
let api: ReviewWindow["cassandre"], initialized: ReviewWindow["cassandre"];
let view="near";
const poses={near:[57.70,7.85,.01,180],far:[57.70,9.0,.01,180]};
function position(){api?.tp(...poses[view as keyof typeof poses]);gameStatus.textContent="Sanitaires · face au miroir"}
function keyInput(code:string,type:string){const win=game.contentWindow!;win.dispatchEvent(new KeyboardEvent(type,{code,key:code.slice(-1),bubbles:true}))}
document.querySelectorAll<HTMLButtonElement>("[data-pose]").forEach(button=>button.addEventListener("click",()=>{view=button.dataset.pose!;position()}));
document.querySelectorAll<HTMLButtonElement>("[data-key]").forEach(button=>button.addEventListener("click",()=>{
  if(button.dataset.key==="Digit1")api?.weapons.startUnarmed();
  if(button.dataset.key==="Digit2")api?.weapons.pickUpPistol();
  if(button.dataset.key==="Digit3")api?.weapons.pickUpShotgun();
  keyInput(button.dataset.key!,"keydown");keyInput(button.dataset.key!,"keyup");
}));
document.querySelector("#game-walk")!.addEventListener("click",()=>{
  keyInput("KeyW","keydown");setTimeout(()=>keyInput("KeyW","keyup"),300);
});
document.querySelector("#capture")!.addEventListener("click",()=>{
  const source=game.contentDocument?.querySelector<HTMLCanvasElement>("#game");
  const image=document.querySelector<HTMLImageElement>("#game-capture")!;
  if(source && api){api.renderBench(1);image.src=source.toDataURL("image/png");image.hidden=false}
});
setInterval(()=>{
  const current=(game.contentWindow as ReviewWindow)?.cassandre;
  if(!current)return;
  current.notarget(true);
  const state=current.campagne.etat();
  if(!state.playing)return;
  api=current;
  if(initialized!==current){initialized=current;current.resolution(640,360);current.filtrage("aniso");position();current.weapons.startUnarmed()}
},100);
