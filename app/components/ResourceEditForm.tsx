'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUploadField } from '@/app/components/ImageUploadField';
export function ResourceEditForm({resource,games}:{resource:any;games:{id:string;name:string}[]}) {
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const data=Object.fromEntries(new FormData(e.currentTarget).entries());try{const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resource-save',id:resource.id,...data})});const d=await r.json();if(!r.ok)throw Error(d.error||'保存失败');setOpen(false);router.refresh()}catch(e){setError(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}}
 return <div><button type="button" className="outline-btn" onClick={()=>setOpen(v=>!v)}>{open?'收起':'修改资源'}</button>{open&&<form className="stack-form" onSubmit={submit}>
 <label>资源名称<input name="title" defaultValue={resource.title} required/></label><label>所属游戏<select name="gameId" defaultValue={resource.gameId||''}><option value="">通用资源</option>{games.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
 <ImageUploadField name="cover" label="资源封面" folder="resources" initial={resource.cover||''}/><label>版本<input name="version" defaultValue={resource.version||''}/></label><label>适用范围<input name="scope" defaultValue={resource.scope||''}/></label><label>安装方式<textarea name="install" defaultValue={resource.install||''}/></label><label>资源说明<textarea name="description" rows={5} defaultValue={resource.description||''}/></label><label>下载地址<input name="url" type="url" defaultValue={resource.url||''}/></label><label>关联教程<input name="tutorial" defaultValue={resource.tutorial||''}/></label><label>标签（逗号分隔）<input name="tags" defaultValue={(resource.tags||[]).join(', ')}/></label>
 {error&&<p className="error-box">{error}</p>}<button className="primary-btn" disabled={busy}>{busy?'保存中…':'保存修改'}</button></form>}</div>;
}