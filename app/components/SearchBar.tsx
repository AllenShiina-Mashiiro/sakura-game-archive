import Link from 'next/link';
export function SearchBar({ q = '', type = '', platform = '', tag = '', action = '/games' }: { q?: string; type?: string; platform?: string; tag?: string; action?: string }) {
  return (
    <form className="archive-search" action={action}>
      <input name="q" defaultValue={q} placeholder="搜索名称、标签、简介…" />
      <input name="tag" defaultValue={tag} placeholder="标签" />
      <input name="type" defaultValue={type} placeholder="类型" />
      <input name="platform" defaultValue={platform} placeholder="平台" />
      <button className="primary-btn">搜索</button>
      <Link className="outline-btn" href={action}>
        重置
      </Link>
    </form>
  );
}
