'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
type Product = { id: string; name: string; description: string; price: number; category: string; effectValue?: string };
export function ShopClient({ exp, expConverted, coins, products }: { exp: number; expConverted: number; coins: number; products: Product[] }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const router = useRouter();
  const available = Math.max(0, exp - expConverted);
  const redeemable = Math.floor(available / 10);
  async function post(body: Record<string, string>) {
    setBusy(true); setMessage('');
    try {
      const r = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || '操作失败');
      setMessage(d.message || '操作成功'); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败'); }
    finally { setBusy(false); }
  }
  return <div className="shop-client">
    <section className="wallet-shop-card">
      <div><small>樱花币余额</small><strong>✿ {coins}</strong></div>
      <div><small>当前总经验</small><strong>{exp} EXP</strong></div>
      <div><small>已兑换经验</small><strong>{expConverted} EXP</strong></div>
      <div><small>本次可兑换</small><strong>{redeemable} 币</strong></div>
      <p>兑换比例：10 EXP = 1 樱花币。兑换不会扣除经验，也不会影响等级；系统只计算尚未兑换过的新增经验。</p>
      <button className="primary-btn" disabled={busy || redeemable < 1} onClick={() => post({ action: 'wallet-convert' })}>{busy ? '处理中…' : `兑换 ${redeemable} 樱花币`}</button>
    </section>
    <div className="shop-product-grid">
      {products.map((p) => <article className="shop-product-card" key={p.id}>
        <div className={`shop-product-art ${p.effectValue ? `avatar-frame-${p.effectValue}` : ''}`}>✿</div>
        <h3>{p.name}</h3><p>{p.description}</p><b>✿ {p.price}</b>
        <button className="outline-btn" disabled={busy || coins < p.price} onClick={() => post({ action: 'shop-buy', productId: p.id })}>购买</button>
      </article>)}
      {!products.length && <p className="muted">暂无上架商品，管理员可在后台添加商品。</p>}
    </div>
    {message && <p className="user-management-message" role="status">{message}</p>}
  </div>;
}
