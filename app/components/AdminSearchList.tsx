'use client';
import { useMemo, useState, type ReactNode } from 'react';
export function AdminSearchList({ items, placeholder = '搜索名称、标签或内容…' }: { items: { id: string; search: string; content: ReactNode }[]; placeholder?: string }) {
 const [query,setQuery]=useState('');
 const filtered=useMemo(()=>items.filter(x=>x.search.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[items,query]);
 return <div className="admin-search-list">
  <label className="admin-search-field">搜索<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={placeholder}/></label>
  <div className="admin-search-results">{filtered.map(x=><div key={x.id}>{x.content}</div>)}</div>
  {!filtered.length && <p className="muted">没有找到匹配内容。</p>}
 </div>;
}