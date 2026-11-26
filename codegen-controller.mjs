import {selectedRecords} from './codegen.mjs';
import {createEditableMapPackage} from './codegen-editable.mjs?r=mixed-italics';
import {mapR} from './codegen-r.mjs?r=mixed-italics';
import {mapR as snapshotMapR} from './codegen-snapshot-r.mjs';
import {streetBasemap} from './basemap-settings.mjs';
import {pageSize,outputSize} from './page.mjs';
import {download,zipBlob} from './export.mjs';
import {t,tx} from './i18n.mjs';

export function createCodegenController({state,toast,renderer,isReady}){
 const $=id=>document.getElementById(id);let busy=false;
 const width=()=>Number($('exportWidth').value);
 function refresh(){
  if($('codeView').hidden)return;
  const records=selectedRecords(state),taxa=new Set(records.map(p=>p.group));
  $('codeDataSummary').textContent=tx('codeSummary',{records:records.length.toLocaleString(),taxa:taxa.size.toLocaleString()});
  $('codeDemoNote').hidden=!state.demo;
  const streets=streetBasemap(state.settings);
  $('streetCodeHint').hidden=!streets;
  try{
   const page=pageSize(state.settings),output=outputSize(state.settings,width());
   $('codePreview').value=(streets?snapshotMapR:mapR)(state,{width:width()});
   $('codeSize').textContent=tx('mapRSize',{w:output.width.toLocaleString(),h:output.height.toLocaleString(),cmw:page.widthCm,cmh:page.heightCm});
   $('codeBundle').disabled=busy;
   if(!busy){$('codeStatus').textContent=tx('codeReady',{lines:$('codePreview').value.split('\n').length});$('codeStatus').classList.remove('code-error');}
  }catch(e){$('codeBundle').disabled=true;$('codeStatus').textContent=t(e.message);$('codeStatus').classList.add('code-error');}
 }
 $('exportWidth').addEventListener('change',refresh);
 $('codeBundle').addEventListener('click',async()=>{
  if(busy)return;
  if(!isReady()||!renderer.status(state).ready){toast('圖層尚未載入完成，請返回地圖查看狀態或重新載入。');return;}
  busy=true;$('codeBundle').disabled=true;$('codeStatus').textContent=t('正在整理 R 製圖包…');
  try{const streets=streetBasemap(state.settings),folder=streets?'SPTopo_street_R':'SPTopo_editable_R',bundle=await createEditableMapPackage(state,renderer,{width:width()});download(await zipBlob(bundle.files.map(f=>({...f,name:folder+'/'+f.name}))),streets?'SPTopo_street_R.zip':'SPTopo_editable_R_v4.zip');toast('製圖包已準備好。');}
  catch(e){toast(e.message);}
  finally{busy=false;refresh();}
 });
 return {refresh,datasetChanged:refresh,restored:refresh};
}
