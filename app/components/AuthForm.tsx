'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      const messages: Record<string, string> = {
        access_denied: '你取消了第三方登录。',
        oauth_state: '登录验证已过期，请重新尝试。',
      };
      setError(messages[oauthError] || decodeURIComponent(oauthError));
    }
  }, []);

  async function sendCode() {
    setError('');
    setNotice('');
    setSendingCode(true);
    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '验证码发送失败');
      setNotice('验证码已发送，请检查邮箱（10 分钟内有效）');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = mode === 'login'
        ? { username: identifier.trim().replace(/^@/, ''), password }
        : { username: identifier.trim().toLowerCase().replace(/^@/, ''), email, code, password, nickname };
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '操作失败');
      router.replace('/');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-form">
      <form className="stack-form" onSubmit={submit}>
        <label>
          {mode === 'login' ? 'ID / 邮箱' : '用户 ID'}
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            minLength={mode === 'register' ? 3 : undefined}
            maxLength={mode === 'login' ? 320 : 24}
            required
            autoComplete="username"
            placeholder={mode === 'login' ? '@用户名或邮箱地址' : '小写字母、数字、下划线，3-24 位'}
          />
          {mode === 'register' && <small>注册时不需要输入 @，公开主页会显示为 @你的ID。</small>}
        </label>

        {mode === 'register' && (
          <>
            <label>
              昵称
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={24} required placeholder="你希望大家如何称呼你" />
            </label>
            <label>
              邮箱
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required autoComplete="email" placeholder="用于接收注册验证码" />
            </label>
            <label>
              邮箱验证码
              <div className="auth-code-row">
                <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} required placeholder="6 位验证码" />
                <button type="button" className="secondary-btn" disabled={sendingCode || !email.trim()} onClick={sendCode}>
                  {sendingCode ? '发送中…' : '发送验证码'}
                </button>
              </div>
            </label>
          </>
        )}

        <label>
          密码
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === 'register' ? 8 : 1} maxLength={128} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? '请输入密码' : '至少 8 位'} />
        </label>

        {error && <div className="error-box">{error}</div>}
        {notice && <div className="success-box" role="status">{notice}</div>}
        <button className="primary-btn full-btn" disabled={busy}>
          {busy ? '请稍候…' : mode === 'login' ? '登录 →' : '验证邮箱并创建账户 →'}
        </button>
      </form>

      <div className="auth-oauth-divider"><span>或使用第三方账户</span></div>
      <div className="auth-oauth-actions">
        <a className="secondary-btn" href="/api/auth/oauth/google">使用 Google 继续</a>
        <a className="secondary-btn" href="/api/auth/oauth/github">使用 GitHub 继续</a>
      </div>
    </div>
  );
}
