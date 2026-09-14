import {createApp,ref,computed,nextTick,watch} from 'vue/dist/vue.esm-bundler.js';
import * as service from './appService';
import {getDb,setDb,initDb,flushDb,emptyDb,storageMode} from './localDb';
import {today,addDays,dayNumber,money,metrics,normalizedItem,validateItem,statusLabel,modeLabel,unit,historicalBars,getAlerts,addRecord,removeRecord,validateImport,validDate} from './model';
import {createId} from './id';
import {paths} from './icons';
import template from './template.html';
import css from './style.css';
const style=document.createElement('style');style.textContent=css;document.head.append(style);
const clone=(x:any)=>JSON.parse(JSON.stringify(x));
async function start(){
 await initDb();
 const app=createApp({template,setup(){
  const db=ref(getDb()),page=ref('home'),selected=ref(''),keyword=ref(''),filter=ref('all'),category=ref(''),kind=ref('all'),sort=ref('updatedAt'),sortOrder=ref('desc'),view=ref(db.value.settings.view||'list'),currency=ref(db.value.settings.currency||'CNY');
  const modal=ref(''),draft=ref<any>({}),record=ref<any>({}),recordKind=ref('maintenance'),error=ref(''),busy=ref(false),toast=ref(''),confirm=ref<any>(null),categoryDraft=ref(''),renameId=ref(''),migrationTo=ref(''),manageMode=ref('category'),channelDraft=ref(''),lightbox=ref(''),editOrigin=ref('home'),granularity=ref('month'),chartSelected=ref(-1),reminderTab=ref('pending'),importText=ref(''),importPreview=ref<any>(null),importMode=ref('merge'),selectedIds=ref<string[]>([]),selectionMode=ref(false),settingsDraft=ref<any>({});
  const installPrompt=ref<any>(null);
  const standalone=ref(!!window.matchMedia?.('(display-mode: standalone)').matches || !!(navigator as any).standalone);
  window.addEventListener('beforeinstallprompt',(event:any)=>{event.preventDefault();installPrompt.value=event;});
  window.addEventListener('appinstalled',()=>{standalone.value=true;installPrompt.value=null;});
  async function installApp(){if(installPrompt.value){const prompt=installPrompt.value;await prompt.prompt();await prompt.userChoice;installPrompt.value=null;}else modal.value='install';}
  const stamp=ref(today());setInterval(()=>{if(today()!==stamp.value){stamp.value=today();refresh();}},30000);
  const item=computed(()=>{stamp.value;return db.value.items.map(normalizedItem).find((i:any)=>i.id===selected.value)});
  const detail=computed(()=>item.value?metrics(item.value):null);
  const categories=computed(()=>db.value.categories);
  const allItems=computed(()=>db.value.items.map(normalizedItem));
  const alerts=computed(()=>{stamp.value;return getAlerts(db.value)});
  const pendingCount=computed(()=>alerts.value.filter((r:any)=>r.date<=today()||r.date<=addDays(today(),30)).length);
  const categoryName=(id:string)=>db.value.categories.find((c:any)=>c.id===id)?.name||'未分类';
  const kindLabel=(s:string)=>({asset:'资产',investment:'投资',virtual:'虚拟'}[s]||'资产');
  const visible=computed(()=>{
   db.value;stamp.value;
   let arr=service.listItems({keyword:keyword.value,categoryId:category.value,sortBy:sort.value as any,sortOrder:sortOrder.value as any}).map(normalizedItem);
   if(filter.value!=='all')arr=arr.filter((i:any)=>filter.value==='goal'?i.goalMode!=='none'&&metrics(i).progress<100:filter.value==='pinned'?i.pinned:i.status===filter.value);
   if(kind.value!=='all')arr=arr.filter((i:any)=>i.kind===kind.value);
   if(sort.value==='dailyCost')arr.sort((a:any,b:any)=>((metrics(a).current||0)-(metrics(b).current||0))*(sortOrder.value==='asc'?1:-1));
   return arr.sort((a:any,b:any)=>Number(b.pinned)-Number(a.pinned));
  });
  const scoped=computed(()=>allItems.value.filter((i:any)=>!i.excludeStats&&i.currency===currency.value));
  const summary=computed(()=>{const a=scoped.value,active=a.filter((i:any)=>['active','idle'].includes(i.status));return {count:a.length,active:active.length,total:a.reduce((s:number,i:any)=>s+metrics(i).net,0),daily:active.filter((i:any)=>i.costMode==='day').reduce((s:number,i:any)=>s+(metrics(i).current||0),0),spend:a.reduce((s:number,i:any)=>s+metrics(i).total,0),recovered:a.reduce((s:number,i:any)=>s+metrics(i).recovered,0),goals:active.filter((i:any)=>i.goalMode!=='none'&&metrics(i).progress>=100).length,maintenance:a.reduce((s:number,i:any)=>s+metrics(i).maintenance+metrics(i).accessories,0)};});
  const categoryStats=computed(()=>categories.value.map((c:any)=>({...c,count:scoped.value.filter((i:any)=>i.categoryId===c.id).length,amount:scoped.value.filter((i:any)=>i.categoryId===c.id).reduce((s:number,i:any)=>s+metrics(i).total,0)})).filter((c:any)=>c.count).sort((a:any,b:any)=>b.amount-a.amount));
  const rank=computed(()=>[...scoped.value].filter((i:any)=>i.costMode==='day'&&['active','idle'].includes(i.status)).sort((a:any,b:any)=>(metrics(b).current||0)-(metrics(a).current||0)).slice(0,5));
  const expenseBars=computed(()=>{
   const now=new Date();const keys=Array.from({length:6},(_,idx)=>{const back=5-idx;if(granularity.value==='day')return addDays(today(),-back);if(granularity.value==='year')return String(now.getFullYear()-back);const d=new Date(now.getFullYear(),now.getMonth()-back,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;});
   return keys.map(key=>{const amount=scoped.value.reduce((s:number,i:any)=>s+(i.purchaseDate.startsWith(key)?i.price:0)+['maintenance','accessories'].reduce((sum,k)=>sum+(i[k]||[]).filter((r:any)=>r.include!==false&&r.date.startsWith(key)).reduce((x:number,r:any)=>x+r.amount,0),0),0);return {date:key,label:granularity.value==='day'?key.slice(5).replace('-','/'):granularity.value==='year'?key:key.slice(5)+'月',value:amount};});
  });
  const bars=computed(()=>item.value?historicalBars(item.value):[]);
  const barsMax=(a:any[])=>Math.max(1,...a.map(x=>Math.abs(x.value)));
  const recentRecords=computed(()=>item.value?[...(item.value[recordKind.value]||[])].sort((a:any,b:any)=>b.date.localeCompare(a.date)):[]);
  const isDetail=computed(()=>['detail','edit','records'].includes(page.value));
  const pageTitle=computed(()=>({home:'持物',items:'全部物品',stats:'统计',settings:'我的',detail:'资产详情',edit:draft.value.id?'编辑资产':'添加资产',records:recordKind.value==='maintenance'?'维护记录':recordKind.value==='accessories'?'配件记录':'使用记录',reminders:'提醒中心',categories:'分类管理',backup:'数据备份',help:'使用说明'}[page.value]||'持物'));
  watch(()=>db.value.settings.theme,(theme)=>{document.documentElement.dataset.theme=theme||'dark';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f4f5f6':'#1c1c1e')},{immediate:true});
  watch(currency,async v=>{await run(()=>service.updateSettings({currency:v}),'');});
  watch(view,async v=>{await run(()=>service.updateSettings({view:v}),'');});
  watch(modal,()=>{error.value='';nextTick(()=>{const el=document.querySelector('.modal [autofocus]') as HTMLElement;el?.focus();});});
  watch(page,()=>{error.value='';chartSelected.value=-1;window.scrollTo({top:0});});
  window.addEventListener('popstate',()=>{if(modal.value){modal.value='';return;}const state=history.state;if(state?.page){page.value=state.page;selected.value=state.id||selected.value;}else page.value='home';});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(lightbox.value)lightbox.value='';else if(confirm.value)confirm.value=null;else if(modal.value)modal.value='';}});
  function refresh(){db.value=getDb();}
  function notify(message:string){toast.value=message;setTimeout(()=>{if(toast.value===message)toast.value='';},3200);}
  async function run(fn:()=>any,message='已保存'){
   if(busy.value)return false;busy.value=true;error.value='';
   try{await fn();await flushDb();refresh();if(message)notify(message);return true;}catch(e:any){error.value=e.message||'操作失败，请重试';notify(error.value);refresh();return false;}finally{busy.value=false;}
  }
  function navigate(p:string){if(page.value==='edit'&&p!=='edit'){ask('放弃此次编辑？','未保存的修改将丢失。',()=>go(p),'放弃修改');return;}go(p);}
  function go(p:string){page.value=p;selectionMode.value=false;selectedIds.value=[];history.pushState({page:p,id:selected.value},'','#'+p);}
  function back(){if(page.value==='edit'){ask('放弃此次编辑？','未保存的修改将丢失。',()=>go(editOrigin.value),'放弃修改');}else go(['records'].includes(page.value)?'detail':['detail'].includes(page.value)?'items':['categories','backup','help'].includes(page.value)?'settings':'home');}
  function openItem(i:any){selected.value=i.id;go('detail');}
  function newItem(){editOrigin.value=page.value;draft.value=normalizedItem({name:'',icon:'📦',categoryId:categories.value[0]?.id,price:'',purchaseDate:today(),status:'active',note:'',useCount:0,quantityUsed:0});go('edit');}
  function editItem(){editOrigin.value='detail';draft.value=clone(item.value);go('edit');}
  async function saveItem(){
   const payload=clone(draft.value);['price','targetCost','salePrice','useCount','quantityUsed'].forEach(k=>payload[k]=Number(payload[k]||0));payload.currentValue=payload.currentValue===''?null:payload.currentValue;payload.name=String(payload.name).trim();payload.note=String(payload.note||'');payload.customStatus=payload.status==='idle'?'闲置中':payload.customStatus;
   let saved:any;const ok=await run(()=>{validateItem(payload);saved=payload.id?service.updateItem(payload.id,payload):service.createItem(payload);});if(ok){selected.value=saved.id;go('detail');}
  }
  function changeStatus(s:string){draft.value.status=draft.value.status===s?'active':s;if(['sold','archived'].includes(draft.value.status)&&!draft.value.stopDate)draft.value.stopDate=today();}
  function setCustomStatus(){if(['active','idle'].includes(draft.value.status))draft.value.status=draft.value.customStatus==='闲置中'?'idle':'active';}
  function ask(title:string,message:string,action:()=>any,label='确认',danger=true){confirm.value={title,message,action,label,danger};}
  async function confirmAction(){const c=confirm.value;confirm.value=null;await c?.action();}
  function deleteCurrent(){ask('删除这件资产？','这件资产的维护、配件和使用记录会一并删除，建议先导出备份。',async()=>{if(await run(()=>service.deleteItem(selected.value),'资产已删除'))go('items');},'删除资产');}
  async function togglePin(){await run(()=>service.updateItem(item.value.id,{pinned:!item.value.pinned}),item.value.pinned?'已取消置顶':'已置顶');}
  function openRecords(k:string){recordKind.value=k;go('records');}
  function newRecord(k=recordKind.value){recordKind.value=k;record.value={name:'',date:today(),amount:'',note:'',include:true,count:1,quantity:0};modal.value='record';}
  async function saveRecord(){const r=clone(record.value);['amount','count','quantity'].forEach(k=>r[k]=Number(r[k]||0));if(await run(()=>addRecord(selected.value,recordKind.value,r),'记录已保存'))modal.value='';}
  function deleteRecord(r:any){ask('删除这条记录？','关联的成本与使用数据将重新计算。',()=>run(()=>removeRecord(selected.value,recordKind.value,r.id),'记录已删除'),'删除记录');}
  async function useOnce(){if(item.value.costMode==='quantity'){newRecord('usage');return;}await run(()=>addRecord(item.value.id,'usage',{date:today(),count:1,quantity:0,note:''}),'已记录一次使用');}
  async function uploadImage(event:Event,target:string){
   const input=event.target as HTMLInputElement,files=Array.from(input.files||[]);input.value='';if(!files.length)return;error.value='';
   try{for(const file of files.slice(0,target==='photo'?1:6-(draft.value.photos||[]).length)){
    if(!['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif'].includes(file.type)&&!file.name.match(/\.(jpe?g|png|webp|gif|avif|heic|heif)$/i))throw new Error('请选择图片文件');
    if(file.size>25*1024*1024)throw new Error('单张图片请小于25MB');
    const url=URL.createObjectURL(file);let image:HTMLImageElement;
    try{image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('无法读取图片，请换用 JPG 或 PNG 格式'));img.src=url;});const canvas=document.createElement('canvas');const scale=Math.min(1,720/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.82);if(target==='photo')draft.value.photo=data;else draft.value.photos.push(data);}finally{URL.revokeObjectURL(url);}
   }}catch(e:any){error.value=e.message;notify(e.message);}
  }
  function download(name:string,data:string,type='application/json'){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function exportBackup(){try{download(`持物备份-${today()}.json`,service.exportData());notify('备份已生成，请在下载文件中查看');}catch(e:any){notify(e.message);}}
  function exportCsv(){const rows=[['物品名称','类型','分类','状态','币种','购买价格','购买日期','累计投入','维护费用','配件费用','回收金额','净投入','成本模式','当前单位成本','使用天数','次数','累计用量','备注'],...allItems.value.map((i:any)=>{const m=metrics(i);return [i.name,kindLabel(i.kind),categoryName(i.categoryId),statusLabel(i),i.currency,i.price,i.purchaseDate,m.total,m.maintenance,m.accessories,m.recovered,m.net,modeLabel(i)+'成本',m.current===null?'':m.current.toFixed(2),m.days,m.uses,m.quantity,i.note]})];download(`持物资产清单-${today()}.csv`,'\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8');notify('清单已导出');}
  async function chooseBackup(e:Event){const input=e.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;if(file.size>40*1024*1024){notify('备份文件过大，请选择40MB以内的文件');return;}importText.value=await file.text();previewImport();}
  function previewImport(){try{const parsed=JSON.parse(importText.value);validateImport(parsed);importPreview.value=parsed;modal.value='import';error.value='';}catch(e:any){error.value=e.message||'备份格式无效';notify(error.value);}}
  async function commitImport(){
   const incoming=clone(importPreview.value);if(!incoming)return;
   const perform=async()=>{const ok=await run(()=>{
    validateImport(incoming);let result=incoming;
    if(importMode.value==='merge'){
     result=clone(getDb());const catMap:Record<string,string>={};
     for(const c of incoming.categories){const match=result.categories.find((x:any)=>x.name.trim()===c.name.trim());if(match)catMap[c.id]=match.id;else{const next={...c,id:result.categories.some((x:any)=>x.id===c.id)?createId('cat'):c.id};result.categories.push(next);catMap[c.id]=next.id;}}
     for(const i of incoming.items)if(!result.items.some((x:any)=>x.id===i.id))result.items.push(normalizedItem({...i,categoryId:catMap[i.categoryId]}));
     for(const r of incoming.reminders)if(!result.reminders.some((x:any)=>x.id===r.id))result.reminders.push(r);
    }
    result.settings={...emptyDb().settings,...result.settings};result.items=result.items.map(normalizedItem);result.schemaVersion=1;
    service.importDataFromJson(JSON.stringify(result));
   },'备份已导入');if(ok){modal.value='';importPreview.value=null;importText.value='';currency.value=db.value.settings.currency;}}
   if(importMode.value==='replace')ask('替换全部现有数据？','现有数据将由此备份替换。请先导出当前备份。',perform,'替换数据');else await perform();
  }
  function openCategoryEditor(c:any=null){renameId.value=c?.id||'';categoryDraft.value=c?.name||'';modal.value='category';}
  async function saveCategory(){if(await run(()=>renameId.value?service.renameCategory(renameId.value,categoryDraft.value):service.addCategory(categoryDraft.value))){modal.value='';}}
  function deleteCategory(c:any){const count=db.value.items.filter((i:any)=>i.categoryId===c.id).length;if(count){renameId.value=c.id;categoryDraft.value=c.name;migrationTo.value=categories.value.find((x:any)=>x.id!==c.id)?.id||'';modal.value='migrate';}else ask('删除分类？',`将删除“${c.name}”。`,()=>run(()=>service.deleteCategory(c.id),'分类已删除'),'删除');}
  async function migrateCategory(){if(!migrationTo.value){error.value='请先建立一个接收分类';return;}if(await run(()=>{service.migrateCategory(renameId.value,migrationTo.value);service.deleteCategory(renameId.value);},'分类已迁移并删除'))modal.value='';}
  function newReminder(){record.value={title:'',note:'',dueDate:today()};modal.value='reminder';}
  async function saveReminder(){if(await run(()=>{if(!record.value.title.trim())throw new Error('请填写提醒标题');if(!validDate(record.value.dueDate))throw new Error('请选择有效日期');service.createCustomReminder(record.value);},'提醒已添加'))modal.value='';}
  async function dismissAlert(r:any){await run(()=>{if(r.type==='custom')service.completeReminder(r.id);else{const d=getDb();d.settings.dismissed=[...(d.settings.dismissed||[]),r.id];setDb(d);}},'已标记完成');}
  async function restoreReminder(r:any){await run(()=>service.updateReminder(r.id,{status:'pending'}),'提醒已恢复');}
  function openSettings(){settingsDraft.value=clone(db.value.settings);modal.value='settings';}
  async function saveSettings(){if(await run(()=>{if(!(Number(settingsDraft.value.dailyCostThreshold)>0)||!(Number(settingsDraft.value.idleThresholdDays)>=1))throw new Error('请填写有效的提醒阈值');service.updateSettings(settingsDraft.value);}))modal.value='';}
  async function themeToggle(){await run(()=>service.updateSettings({theme:db.value.settings.theme==='dark'?'light':'dark'}),'');}
  function openManage(type:string){manageMode.value=type;channelDraft.value='';modal.value='manage';}
  async function addManaged(){const key=manageMode.value==='channel'?'channels':'customStatuses';if(await run(()=>{const value=channelDraft.value.trim();if(!value)throw new Error('请输入名称');if(db.value.settings[key].includes(value))throw new Error('该名称已存在');service.updateSettings({[key]:[...db.value.settings[key],value]});})){channelDraft.value='';}}
  async function removeManaged(name:string){const key=manageMode.value==='channel'?'channels':'customStatuses';await run(()=>service.updateSettings({[key]:db.value.settings[key].filter((x:string)=>x!==name)}),'已删除选项，现有物品记录保留');}
  function toggleSelected(id:string){selectedIds.value=selectedIds.value.includes(id)?selectedIds.value.filter(x=>x!==id):[...selectedIds.value,id];}
  function batchDelete(){ask(`删除 ${selectedIds.value.length} 件资产？`,'关联记录也会删除，请确认已备份。',async()=>{if(await run(()=>selectedIds.value.forEach(id=>service.deleteItem(id)),'已批量删除')){selectedIds.value=[];selectionMode.value=false;}},'删除');}
  async function batchCategory(){if(!migrationTo.value){error.value='请选择分类';return;}if(await run(()=>selectedIds.value.forEach(id=>service.updateItem(id,{categoryId:migrationTo.value})),'分类已更新')){modal.value='';selectedIds.value=[];selectionMode.value=false;}}
  function clearAll(){ask('清空全部物品与记录？','此操作会清空资产、维护、配件、使用记录和提醒。请先导出备份。',async()=>{if(await run(()=>{const d=getDb();d.items=[];d.reminders=[];d.settings.dismissed=[];setDb(d);},'已清空'))go('home');},'确认清空');}
  async function loadDemo(){
   if(db.value.items.length){notify('请在空物品库中载入示例，避免混入你的真实数据');return;}
   await run(()=>{
    const now=new Date().toISOString(),d=getDb(),base={createdAt:now,updatedAt:now,note:'示例数据，可编辑或删除',currency:'CNY',status:'active'};
    const cat=(n:string)=>d.categories.find((c:any)=>c.name===n)?.id||d.categories[0].id;
    d.items=[
     normalizedItem({...base,id:createId('demo'),name:'iPhone 13 Pro',icon:'📱',categoryId:cat('数码'),price:8999,purchaseDate:'2021-12-15',channel:'官网',goalMode:'price',targetCost:5,pinned:true,warrantyEnabled:true,warrantyEnd:'2022-12-15',warrantyReminder:true,maintenance:[{id:createId('rec'),name:'更换电池',date:'2025-06-18',amount:399,include:true,note:'让老朋友再陪我久一点'}],lastUsedAt:today()}),
     normalizedItem({...base,id:createId('demo'),name:'降噪耳机',icon:'🎧',categoryId:cat('数码'),price:1599,purchaseDate:addDays(today(),-420),goalMode:'price',targetCost:3,channel:'京东',lastUsedAt:today()}),
     normalizedItem({...base,id:createId('demo'),name:'Kindle 阅读器',icon:'📖',categoryId:cat('数码'),price:899,purchaseDate:addDays(today(),-620),goalMode:'price',targetCost:2,lastUsedAt:addDays(today(),-10)}),
     normalizedItem({...base,id:createId('demo'),name:'瑜伽垫',icon:'🧘',categoryId:cat('运动'),price:239,purchaseDate:addDays(today(),-90),costMode:'use',useCount:28,goalMode:'price',targetCost:5,lastUsedAt:addDays(today(),-2)}),
     normalizedItem({...base,id:createId('demo'),name:'空气炸锅',icon:'🍲',categoryId:cat('家居'),price:499,purchaseDate:addDays(today(),-200),goalMode:'price',targetCost:2,warrantyEnabled:true,warrantyEnd:addDays(today(),20),warrantyReminder:true,lastUsedAt:today()}),
     normalizedItem({...base,id:createId('demo'),name:'年度音乐会员',icon:'🎵',kind:'virtual',categoryId:cat('会员'),price:158,purchaseDate:addDays(today(),-180),warrantyEnabled:true,warrantyEnd:addDays(today(),185),warrantyReminder:true,lastUsedAt:today()}),
    ];setDb(d);
   },'示例已载入，可一键清空');
  }
  function selectCategory(c:any){category.value=c.id;filter.value='all';kind.value='all';keyword.value='';go('items');}
  function clearFilters(){keyword.value='';category.value='';filter.value='all';kind.value='all';}
  return {installApp,standalone,db,page,selected,keyword,filter,category,kind,sort,sortOrder,view,currency,modal,draft,record,recordKind,error,busy,toast,confirm,categoryDraft,renameId,migrationTo,manageMode,channelDraft,lightbox,granularity,chartSelected,reminderTab,importText,importPreview,importMode,selectedIds,selectionMode,settingsDraft,item,detail,categories,allItems,alerts,pendingCount,visible,scoped,summary,categoryStats,rank,expenseBars,bars,barsMax,recentRecords,isDetail,pageTitle,categoryName,kindLabel,today,money,metrics,statusLabel,modeLabel,unit,dayNumber,storageMode,navigate,go,back,openItem,newItem,editItem,saveItem,changeStatus,setCustomStatus,deleteCurrent,togglePin,openRecords,newRecord,saveRecord,deleteRecord,useOnce,uploadImage,exportBackup,exportCsv,chooseBackup,previewImport,commitImport,openCategoryEditor,saveCategory,deleteCategory,migrateCategory,newReminder,saveReminder,dismissAlert,restoreReminder,openSettings,saveSettings,themeToggle,openManage,addManaged,removeManaged,toggleSelected,batchDelete,batchCategory,clearAll,loadDemo,selectCategory,clearFilters,confirmAction,notify};
 }});
 app.component('icon',{props:['name','size'],template:'<svg :width="size||22" :height="size||22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name]||paths.box"/></svg>',setup:()=>({paths})});
 app.component('asset-image',{props:['item','large'],template:'<div class="asset-image" :class="{large}"><img v-if="item.photo" :src="item.photo" :alt="item.name"/><span v-else>{{item.icon||"📦"}}</span></div>'});
 app.component('toggle',{props:['modelValue','label'],emits:['update:modelValue'],template:'<button class="toggle" :class="{on:modelValue}" type="button" role="switch" :aria-label="label" :aria-checked="!!modelValue" @click="$emit(\'update:modelValue\',!modelValue)"><span></span></button>'});
 app.mount('#app');
}
start().catch(e=>{const boot=document.getElementById('boot');if(boot){boot.textContent='浏览器无法打开本地存储。请退出无痕模式，并使用 Chrome、Edge 或 Safari 打开此 HTML 文件。错误：'+e.message;}});
