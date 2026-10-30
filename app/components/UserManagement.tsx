'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
type U = {
  id: string;
  username: string;
  nickname: string;
  role: string;
  status: string;
  createdAt: string;
  exp: number;
  lastLoginAt?: string;
  lastLoginIp?: string;
};
export function UserManagement({ users }: { users: U[] }) {
  const [query, setQuery] = useState('');
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const filtered = useMemo(() => users.filter((u) => [u.username, u.nickname, u.id].some((x) => x.toLowerCase().includes(query.toLowerCase()))), [users, query]);
  async function send(data: Record<string, string>) {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || '操作失败');
    return d;
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const d = await send({ action: 'admin-user-create', username, nickname, password, role });
      setMessage(d.message || '账号创建成功');
      setUsername('');
      setNickname('');
      setPassword('');
      setRole('user');
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusy(false);
    }
  }
  async function update(u: U, patch: Record<string, string>) {
    setBusy(true);
    try {
      const d = await send({ action: 'admin-user-update', id: u.id, ...patch });
      setMessage(d.message || '已更新');
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '更新失败');
    } finally {
      setBusy(false);
    }
  }
  async function remove(u: U) {
    if (!window.confirm(`确定删除账号 ${u.username}？此操作不可撤销。`)) return;
    setBusy(true);
    try {
      const d = await send({ action: 'admin-user-delete', id: u.id });
      setMessage(d.message || '已删除');
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }
  const admins = filtered.filter((u) => u.role === 'admin');
  const normal = filtered.filter((u) => u.role !== 'admin');
  return (
    <div className="user-management">
      <div className="admin-subnav">
        <a href="#admin-accounts">管理员账户</a>
        <a href="#member-accounts">普通用户列表</a>
        <a href="#create-account">新增账号</a>
      </div>
      <section id="create-account" className="admin-form-panel">
        <h3>新增账号</h3>
        <form className="stack-form user-create-form" onSubmit={create}>
          <label>
            用户名
            <input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={24} required pattern="[A-Za-z0-9_]{3,24}" />
          </label>
          <label>
            显示昵称
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} placeholder="不填则使用用户名" />
          </label>
          <label>
            初始密码
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </label>
          <label>
            账号类型
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">普通用户</option>
              <option value="vip">VIP 用户</option>
            </select>
          </label>
          <button className="primary-btn" disabled={busy}>
            {busy ? '处理中…' : '创建账号'}
          </button>
        </form>
      </section>
      <section id="admin-accounts">
        <h3>
          管理员账户 <small>({admins.length})</small>
        </h3>
        <div className="table-card">
          {admins.map((u) => (
            <UserRow key={u.id} user={u} busy={busy} update={update} remove={remove} />
          ))}
        </div>
      </section>
      <section id="member-accounts">
        <div className="user-list-heading">
          <h3>
            普通用户列表 <small>({normal.length})</small>
          </h3>
          <input aria-label="搜索用户" placeholder="搜索用户名、昵称或 ID…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="table-card">
          {normal.map((u) => (
            <UserRow key={u.id} user={u} busy={busy} update={update} remove={remove} />
          ))}
          {!normal.length && <p className="muted">没有匹配的普通用户。</p>}
        </div>
      </section>
      {message && (
        <p className="user-management-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
function UserRow({ user, busy, update, remove }: { user: U; busy: boolean; update: (u: U, p: Record<string, string>) => void; remove: (u: U) => void }) {
  return (
    <div className="admin-row user-management-row">
      <div className="user-row-info">
        <b>
          {user.nickname} (@{user.username})
        </b>
        <small>
          {user.createdAt.slice(0, 10)} · {user.exp} EXP · 最近登录 {user.lastLoginAt || '未登录'}
        </small>
        <small>最近 IP：{user.lastLoginIp || '暂无'}</small>
      </div>
      <div className="user-row-actions">
        <select aria-label="账号角色" defaultValue={user.role} onChange={(e) => update(user, { role: e.target.value })} disabled={busy}>
          <option value="user">普通用户</option>
          <option value="vip">VIP</option>
          <option value="admin">管理员</option>
        </select>
        <select aria-label="账号状态" defaultValue={user.status} onChange={(e) => update(user, { status: e.target.value })} disabled={busy}>
          <option value="active">正常</option>
          <option value="banned">封禁</option>
        </select>
        {user.role !== 'admin' && (
          <button className="outline-btn danger-outline" type="button" disabled={busy} onClick={() => remove(user)}>
            删除账号
          </button>
        )}
      </div>
    </div>
  );
}
