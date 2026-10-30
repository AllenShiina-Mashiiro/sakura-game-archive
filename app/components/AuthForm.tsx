'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nickname }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || '操作失败');
      router.replace('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack-form" onSubmit={submit}>
      <label>
        用户名
        <input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={24} required autoComplete="username" placeholder="3-24 位字母、数字或下划线" />
      </label>
      {mode === 'register' && (
        <label>
          昵称
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} required placeholder="你希望大家如何称呼你" />
        </label>
      )}
      <label>
        密码
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="至少 8 位" />
      </label>
      {error && <div className="error-box">{error}</div>}
      <button className="primary-btn full-btn" disabled={busy}>
        {busy ? '请稍候…' : mode === 'login' ? '登录 →' : '创建账户 →'}
      </button>
    </form>
  );
}
