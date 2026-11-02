import Link from 'next/link';
import { readDb } from '@/lib/db';
import { mediaUrl } from '@/lib/media';
export const dynamic = 'force-dynamic';
const severityLabel = (value?: string) => value === 'critical' ? '高危' : value === 'error' ? '严重' : '警告';
const statusLabel = (value: string) => value === 'pending' ? '已提交' : value === 'approved' || value === 'accepted' ? '已通过 · 待开始' : value === 'processing' ? '处理中' : value === 'fixed' ? '修复成功' : '修复失败';
export default async function PublicBugsPage() {
 const db=await readDb();
 const bugs=db.feedback.filter(item=>/bug/i.test(item.type)&&['approved','accepted','processing','fixed','failed'].includes(item.status)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 return <div className="page-wrap"><header className="topbar"><div><div className="eyebrow">COMMUNITY / PUBLIC BUG TRACKER</div><h1>公示问题</h1><p className="subtitle">仅展示已通过审核的问题，按提交时间倒序排列。问题状态与严重程度对所有登录用户公开。</p></div><div className="tag-row"><Link className="outline-btn" href="/feedback/mine">我的反馈</Link><Link className="outline-btn" href="/feedback">反馈中心</Link></div></header>
 <div className="public-bug-toolbar"><span className="tag">全部 {bugs.length}</span><span className="tag">警告 {bugs.filter(x=>!x.bugSeverity||x.bugSeverity==='warning').length}</span><span className="tag">严重 {bugs.filter(x=>x.bugSeverity==='error').length}</span><span className="tag">高危 {bugs.filter(x=>x.bugSeverity==='critical').length}</span></div>
 <section className="public-bug-list">{bugs.map(bug=><article className="content-card public-bug-card" id={bug.id} key={bug.id}><div className="public-bug-heading"><div><span className={'bug-severity severity-'+(bug.bugSeverity||'warning')}>{severityLabel(bug.bugSeverity)}</span><span className="tag">{statusLabel(bug.status)}</span></div><small>{new Date(bug.createdAt).toLocaleString('zh-CN')}</small></div><h2>{bug.title}</h2><small>{bug.type} · {bug.username}</small><p className="multiline">{bug.description}</p>{(bug.images?.length ? bug.images : bug.image ? [bug.image] : []).length > 0 && <div className="review-image-grid">{(bug.images?.length ? bug.images : bug.image ? [bug.image] : []).map((src,index)=><a key={src+index} href={mediaUrl(src)} target="_blank" rel="noreferrer"><img className="review-image" src={mediaUrl(src)} alt={"问题截图 "+(index+1)} loading="lazy" /></a>)}</div>}<div className="feedback-progress-timeline">{(bug.statusHistory||[]).map((step,index)=><div className="feedback-progress-step" key={step.at+'-'+index}><b>{statusLabel(step.status)}</b><small>{new Date(step.at).toLocaleString('zh-CN')} · {step.by}</small>{step.reply&&<p>{step.reply}</p>}</div>)}</div></article>)}
 {!bugs.length&&<div className="empty-state">目前还没有通过审核并公示的 Bug。</div>}</section></div>;
}
