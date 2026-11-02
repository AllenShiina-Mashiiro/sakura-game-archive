'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type ReviewStatus = 'pending' | 'approved' | 'processing' | 'accepted' | 'rejected' | 'fixed' | 'failed';
export function AdminReview({ id, action, isBug = false, status = 'pending' }: { id: string; action: string; isBug?: boolean; status?: ReviewStatus }) {
 const [reply,setReply]=useState(''); const [severity,setSeverity]=useState<'warning'|'error'|'critical'>('warning'); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState(''); const router=useRouter();
 async function decide(nextStatus:string){if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id,status:nextStatus,reply,...(isBug?{severity}:{})})});const d=await r.json();if(!r.ok)throw Error(d.error||'操作失败');setSuccess(({processing:'已进入处理中',fixed:'已标记修复成功，问题流程结束',failed:'已标记修复失败，问题流程结束',approved:'已通过审核并公示',accepted:'已通过审核',rejected:'已拒绝'} as Record<string,string>)[nextStatus]||'操作成功');router.refresh();}catch(e){setError(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}}
 const terminal=['accepted','rejected','fixed','failed'].includes(status)&&!(isBug&&status==='accepted');
 return <div className="review-workflow">{!terminal&&<div className="review-actions">
 {isBug&&status==='pending'&&<select aria-label="问题严重程度" value={severity} onChange={e=>setSeverity(e.target.value as typeof severity)}><option value="warning">警告</option><option value="error">严重</option><option value="critical">高危</option></select>}
 <input value={reply} onChange={e=>setReply(e.target.value)} placeholder="审核意见 / 进度说明（可选）"/>
 {status==='pending'&&<><button className="primary-btn" disabled={busy} onClick={()=>decide('accepted')}>通过并公示</button><button className="outline-btn" disabled={busy} onClick={()=>decide('rejected')}>拒绝{isBug?'并删除':''}</button></>}
 {isBug&&(status==='approved'||status==='accepted')&&<button className="primary-btn" disabled={busy} onClick={()=>decide('processing')}>开始处理</button>}
 {isBug&&status==='processing'&&<><button className="primary-btn" disabled={busy} onClick={()=>decide('fixed')}>修复成功</button><button className="outline-btn" disabled={busy} onClick={()=>decide('failed')}>修复失败</button></>}
 {error&&<small className="error-text">{error}</small>}</div>}
 {terminal&&<p className="muted">该条目已结束（{status==='fixed'?'修复成功':status==='failed'?'修复失败':status==='accepted'?'已通过':'已拒绝'}），操作已锁定。</p>}
 {success&&<div className="success-inline" role="status">{success}<button className="text-btn" onClick={()=>setSuccess('')}>关闭</button></div>}</div>;
}
