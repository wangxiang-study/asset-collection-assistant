import {getDb,setDb} from './localDb';
import {createId} from './id';
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const dayNumber=(date:string)=>{const parts=String(date).slice(0,10).split('-').map(Number);return Date.UTC(parts[0],parts[1]-1,parts[2])/86400000;};
export const addDays=(date:string,n:number)=>new Date((dayNumber(date)+n)*86400000).toISOString().slice(0,10);
export const validDate=(s:any)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(dayNumber(s))&&new Date(dayNumber(s)*86400000).toISOString().slice(0,10)===s;
export const money=(n:number,currency='CNY')=>new Intl.NumberFormat('zh-CN',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
export const unit=(i:any)=>i.costMode==='use'?'次':i.costMode==='quantity'?(i.quantityUnit||'单位'):'天';
export const modeLabel=(i:any)=>i.costMode==='use'?'次均':i.costMode==='quantity'?'单位':'日均';
export const statusLabel=(i:any)=>({active:i.customStatus||'使用中',idle:'闲置中',archived:'已退役',sold:'已售出'}[i.status]||'使用中');
export function normalizedItem(i:any):any{return {kind:'asset',currency:'CNY',costMode:'day',goalMode:'none',targetCost:5,targetDate:'',quantityUnit:'ml',quantityUsed:0,useCount:0,channel:'',customStatus:'使用中',photo:'',photos:[],maintenance:[],accessories:[],usage:[],warrantyEnabled:false,warrantyEnd:'',warrantyReminder:false,pinned:false,excludeStats:false,stopDate:'',salePrice:0,currentValue:null,...i};}
export function expense(i:any,kind:string,at=today()){
 return (i[kind]||[]).filter((r:any)=>r.include!==false&&r.date<=at).reduce((s:number,r:any)=>s+Math.round(Number(r.amount)*100),0)/100;
}
export function metrics(raw:any,at=today()){
 const i=normalizedItem(raw);let end=at;
 if(['sold','archived'].includes(i.status)&&i.stopDate&&i.stopDate<end)end=i.stopDate;
 const days=Math.max(1,dayNumber(end)-dayNumber(i.purchaseDate)+1);
 const maintenance=expense(i,'maintenance',at),accessories=expense(i,'accessories',at);
 const total=(Math.round(i.price*100)+Math.round(maintenance*100)+Math.round(accessories*100))/100;
 const recovered=i.status==='sold'&&i.stopDate<=at?Number(i.salePrice)||0:0;
 const net=(Math.round(total*100)-Math.round(recovered*100))/100;
 const uses=(i.usage||[]).filter((r:any)=>r.date<=at).reduce((s:number,r:any)=>s+Number(r.count||1),0)+Number(i.useCount||0);
 const quantity=(i.usage||[]).filter((r:any)=>r.date<=at).reduce((s:number,r:any)=>s+Number(r.quantity||0),0)+Number(i.quantityUsed||0);
 const denominator=i.costMode==='use'?uses:i.costMode==='quantity'?quantity:days;
 const current=denominator>0?net/denominator:null;
 const goalTarget=i.goalMode==='date'&&i.targetDate?Math.max(1,dayNumber(i.targetDate)-dayNumber(i.purchaseDate)+1):Number(i.targetCost)>0?Math.max(1,Math.ceil(Math.max(0,net)/Number(i.targetCost))):0;
 const targetCost=i.goalMode==='date'&&goalTarget?net/goalTarget:Number(i.targetCost)||0;
 const goalDenominator=i.goalMode==='date'?days:denominator;
 const progress=i.goalMode==='none'?0:net<=0?100:Math.min(100,goalTarget?goalDenominator/goalTarget*100:0);
 const remaining=Math.max(0,goalTarget-goalDenominator);
 const goalDate=(i.costMode==='day'||i.goalMode==='date')&&goalTarget?addDays(i.purchaseDate,goalTarget-1):'';
 return {days,maintenance,accessories,total,net,recovered,uses,quantity,current,denominator,goalTarget,targetCost,progress,remaining,goalDate};
}
export function historicalBars(i:any){
 const end=['sold','archived'].includes(i.status)&&i.stopDate?i.stopDate:today();const days=metrics(i).days;
 return Array.from({length:8},(_,n)=>{const elapsed=Math.max(1,Math.round(days*(n+1)/8));const date=addDays(i.purchaseDate,elapsed-1);const m=metrics(i,date);return {date,label:date.slice(5).replace('-','/'),value:m.current||0};});
}
export function validateItem(i:any){
 if(!String(i.name||'').trim())throw new Error('请填写物品名称');
 if(String(i.name).length>100)throw new Error('物品名称请控制在100字内');
 if(!Number.isFinite(Number(i.price))||Number(i.price)<0||Number(i.price)>1e10)throw new Error('请输入有效的购买价格');
 if(!validDate(i.purchaseDate)||i.purchaseDate>today())throw new Error('购买日期应为今天或之前的有效日期');
 if(!getDb().categories.some((c:any)=>c.id===i.categoryId))throw new Error('请选择有效分类');
 if(!['CNY','USD','EUR','HKD','JPY'].includes(i.currency))throw new Error('不支持的币种');
 if(!['asset','investment','virtual'].includes(i.kind)||!['day','use','quantity'].includes(i.costMode)||!['none','price','date'].includes(i.goalMode))throw new Error('资产类型或成本模式无效');
 if(i.goalMode==='price'&&(!Number.isFinite(Number(i.targetCost))||Number(i.targetCost)<=0))throw new Error('目标成本必须大于0');
 if(i.goalMode==='date'&&(!validDate(i.targetDate)||i.targetDate<i.purchaseDate))throw new Error('目标日期不能早于购买日期');
 if(i.warrantyEnabled&&(!validDate(i.warrantyEnd)||i.warrantyEnd<i.purchaseDate))throw new Error('保障结束日期不能早于购买日期');
 if(['sold','archived'].includes(i.status)&&(!validDate(i.stopDate)||i.stopDate<i.purchaseDate||i.stopDate>today()))throw new Error('结束日期应在购买日期与今天之间');
 for(const key of ['salePrice','useCount','quantityUsed'])if(!Number.isFinite(Number(i[key]))||Number(i[key])<0)throw new Error('价格、使用次数及用量不能为负数');
 if(!Number.isInteger(Number(i.useCount)))throw new Error('使用次数必须为整数');
 if(i.currentValue!==null&&i.currentValue!==''&&(!Number.isFinite(Number(i.currentValue))||Number(i.currentValue)<0))throw new Error('当前估值不能为负数');
}
export function getAlerts(db:any){
 const now=today(),dismissed=new Set(db.settings.dismissed||[]);const out:any[]=[];
 db.items.map(normalizedItem).forEach((i:any)=>{
  if(!['active','idle'].includes(i.status))return;
  if(i.warrantyEnabled&&i.warrantyReminder&&validDate(i.warrantyEnd)){
   const days=dayNumber(i.warrantyEnd)-dayNumber(now);
   if(days<=30)out.push({id:`w_${i.id}_${i.warrantyEnd}`,itemId:i.id,title:days<0?'保障已到期':days===0?'保障今天到期':`保障将在 ${days} 天后到期`,note:i.name,date:i.warrantyEnd,icon:'shield',tone:days<0?'danger':'amber'});
  }
  const m=metrics(i);if(i.goalMode!=='none'&&m.progress>=100)out.push({id:`g_${i.id}_${i.goalMode}_${i.targetCost}_${i.targetDate}`,itemId:i.id,title:'已达成成本目标',note:i.name,date:now,icon:'target',tone:'green'});
  const last=i.lastUsedAt||i.purchaseDate;const idle=dayNumber(now)-dayNumber(last);
  if(idle>=db.settings.idleThresholdDays)out.push({id:`i_${i.id}_${last}`,itemId:i.id,title:`已有 ${idle} 天未记录使用`,note:i.name,date:now,icon:'clock',tone:'amber'});
  if(!i.excludeStats&&m.current!==null&&m.current>=db.settings.dailyCostThreshold)out.push({id:`h_${i.id}_${now}`,itemId:i.id,title:`${modeLabel(i)}成本较高`,note:`${i.name} · ${money(m.current,i.currency)}/${unit(i)}`,date:now,icon:'chart',tone:'muted'});
 });
 db.reminders.filter((r:any)=>r.type==='custom'&&r.status==='pending').forEach((r:any)=>out.push({...r,date:r.dueDate,icon:'bell',tone:r.dueDate<now?'danger':'green'}));
 return out.filter(r=>!dismissed.has(r.id)).sort((a,b)=>a.date.localeCompare(b.date));
}
export function addRecord(id:string,kind:string,record:any){
 const db=getDb(),i=db.items.find((x:any)=>x.id===id);if(!i)throw new Error('物品不存在');
 if(!validDate(record.date)||record.date<i.purchaseDate||record.date>today())throw new Error('记录日期应在购买日期与今天之间');
 if(['sold','archived'].includes(i.status))throw new Error('已结束使用的资产，请先恢复使用再添加记录');
 if(kind==='usage'){
  if(!Number.isFinite(Number(record.count))||record.count<0||!Number.isInteger(Number(record.count)))throw new Error('次数必须为非负整数');
  if(!Number.isFinite(Number(record.quantity))||record.quantity<0)throw new Error('请输入有效用量');
  if(Number(record.count)===0&&Number(record.quantity)===0)throw new Error('请填写次数或用量');
  i.lastUsedAt=record.date;i.status='active';
 }else{if(!String(record.name||'').trim())throw new Error('请填写记录名称');if(!Number.isFinite(Number(record.amount))||Number(record.amount)<0)throw new Error('请输入有效金额');}
 i[kind]=[...(i[kind]||[]),{...record,id:createId('rec')}];i.updatedAt=new Date().toISOString();setDb(db);
}
export function removeRecord(id:string,kind:string,recordId:string){const db=getDb(),i=db.items.find((x:any)=>x.id===id);i[kind]=(i[kind]||[]).filter((r:any)=>r.id!==recordId);if(kind==='usage')i.lastUsedAt=(i.usage||[]).map((r:any)=>r.date).sort().at(-1)||i.purchaseDate;setDb(db);}
export function validateImport(db:any){
 if(!db||!Array.isArray(db.items)||!Array.isArray(db.categories)||!Array.isArray(db.reminders)||!db.settings)throw new Error('不是有效的持物／物记备份文件');
 if(db.schemaVersion&&db.schemaVersion>1)throw new Error('备份版本较新，请使用对应版本的应用导入');
 for(const list of [db.items,db.categories,db.reminders]){const ids=list.map((r:any)=>r.id);if(ids.some((id:any)=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw new Error('备份存在缺失或重复的编号');}
 if(db.categories.some((c:any)=>typeof c.name!=='string'||!c.name.trim()))throw new Error('分类名称无效');
 for(const i of db.items){
  if(typeof i.name!=='string'||!i.name.trim()||!Number.isFinite(i.price)||i.price<0||!validDate(i.purchaseDate)||!db.categories.some((c:any)=>c.id===i.categoryId))throw new Error('物品价格、日期或分类无效');
  if(!['active','idle','archived','sold'].includes(i.status))throw new Error('物品状态无效');
  for(const k of ['maintenance','accessories','usage'])if(i[k]!==undefined&&(!Array.isArray(i[k])||i[k].some((r:any)=>!r||typeof r.id!=='string'||!validDate(r.date)||r.date<i.purchaseDate||(k!=='usage'?(!Number.isFinite(r.amount)||r.amount<0):(!Number.isFinite(r.count)||r.count<0||!Number.isFinite(r.quantity)||r.quantity<0)))))throw new Error('维护、配件或使用记录无效');
  for(const p of [i.photo,...(Array.isArray(i.photos)?i.photos:[])])if(p&&!(typeof p==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p)))throw new Error('备份中包含无效图片');
  if(i.currency&&!['CNY','USD','EUR','HKD','JPY'].includes(i.currency))throw new Error('币种无效');
  for(const k of ['salePrice','useCount','quantityUsed','targetCost','currentValue'])if(i[k]!==undefined&&i[k]!==null&&i[k]!==''&&(!Number.isFinite(Number(i[k]))||Number(i[k])<0))throw new Error('成本数据无效');
 }
}
