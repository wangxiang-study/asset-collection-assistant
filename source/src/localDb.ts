// Browser storage adapter for ItemMemo. Original CRUD services remain synchronous.
import { createId } from './id';
let memory:any;
let handle:IDBDatabase|null=null;
let pending:Promise<void>=Promise.resolve();
let persistError:Error|null=null;
let durable:any;
export let storageMode='';
const KEY='chiwu_itemmemo_v1';
const copy=(x:any)=>JSON.parse(JSON.stringify(x));
export function emptyDb(){
 const now=new Date().toISOString();
 return {schemaVersion:1,categories:['数码','家居','衣物','美妆','运动','出行','会员','投资','其他'].map((name,index)=>({id:'cat_'+index,name,createdAt:now})),items:[],reminders:[],settings:{dailyCostThreshold:5,idleThresholdDays:60,defaultReminderTime:'09:00',theme:'dark',currency:'CNY',view:'list',name:'我的持物',dismissed:[],channels:['官网','京东','淘宝','线下','其他'],customStatuses:['使用中','闲置中','收藏中','借出中']}};
}
export async function initDb(){
 try{
  handle=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(KEY,1);req.onupgradeneeded=()=>req.result.createObjectStore('data');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('请先关闭其他页面后重试'));});
  const saved=await new Promise<any>((resolve,reject)=>{const req=handle!.transaction('data').objectStore('data').get('db');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  memory=saved||emptyDb();storageMode='IndexedDB';
 }catch(e){
  const test=KEY+'_check';localStorage.setItem(test,'1');localStorage.removeItem(test);
  const saved=localStorage.getItem(KEY);memory=saved?JSON.parse(saved):emptyDb();storageMode='localStorage';
 }
 const defaults=emptyDb();memory.settings={...defaults.settings,...memory.settings};
 durable=copy(memory);
}
export function getDb():any{return copy(memory);}
export function setDb(db:any){
 const snapshot=copy(db);
 if(storageMode==='localStorage'){localStorage.setItem(KEY,JSON.stringify(snapshot));memory=snapshot;durable=copy(snapshot);return;}
 memory=snapshot;
 pending=pending.then(()=>new Promise<void>((resolve,reject)=>{
  const tx=handle!.transaction('data','readwrite');tx.objectStore('data').put(snapshot,'db');
  tx.oncomplete=()=>{durable=copy(snapshot);resolve();};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存已中断'));
 })).catch(e=>{persistError=e;memory=copy(durable);});
}
export async function flushDb(){await pending;if(persistError){const e=persistError;persistError=null;throw new Error('保存失败，请立即导出备份后重试。'+(e?.message||''));}}
export function resetDb(){const db=emptyDb();setDb(db);return db;}
export const storageAdapter={getStorageSync:(key:string)=>{try{return localStorage.getItem(key)||''}catch{return ''}},setStorageSync:(key:string,value:any)=>{try{localStorage.setItem(key,String(value))}catch{}}};
