'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUploadField } from '@/app/components/ImageUploadField';
import type { Game } from '@/lib/types';
export function GameEditForm({game}:{game:Game}) {
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const router=useRouter();
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const data=Object.fromEntries(new FormData(e.currentTarget).entries());try{const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'game-save',id:game.id,...data})});const d=await r.json();if(!r.ok)throw Error(d.error||'保存失败');setOpen(false);router.refresh();}catch(e){setError(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}}
 return <div><button type="button" className="outline-btn" onClick={()=>setOpen(v=>!v)}>{open?'收起':'编辑档案'}</button>{open&&<form className="stack-form" onSubmit={submit}>
 <label>游戏名称<input name="name" defaultValue={game.name} required/></label><label>Slug<input name="slug" defaultValue={game.slug} pattern="[a-z0-9-]+" required/></label>
 <ImageUploadField name="cover" label="游戏封面" folder="games" initial={game.cover||''}/>
 <label>游戏类型<input name="genre" defaultValue={game.genre||''}/></label><label>平台（逗号分隔）<input name="platforms" defaultValue={(game.platforms||[]).join(', ')}/></label>
 <label>当前版本<input name="latestVersion" defaultValue={game.latestVersion||''}/></label><label>状态<select name="status" defaultValue={game.status||'运营中'}><option>运营中</option><option>测试中</option><option>已停更</option></select></label>
 <label>标签（逗号分隔）<input name="tags" defaultValue={(game.tags||[]).join(', ')}/></label><label>最低配置<textarea name="minimum" defaultValue={game.config?.minimum||''}/></label><label>推荐配置<textarea name="recommended" defaultValue={game.config?.recommended||''}/></label>
 <label>游戏介绍<textarea name="description" rows={8} defaultValue={game.description||''}/></label>
 {error&&<p className="error-box">{error}</p>}<button className="primary-btn" disabled={busy}>{busy?'保存中…':'保存修改'}</button></form>}</div>;
}