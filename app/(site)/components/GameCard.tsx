import Link from 'next/link';
import type { Game } from '@/lib/types';
import { FavoriteButton } from '../../components/ActionForm';
export function GameCard({ game }: { game: Game }) {
  return (
    <article className="game-card">
      <Link href={`/games/${game.slug}`}>
        <div className="cover-wrap">
          <img src={game.cover || '/placeholder-cover.svg'} alt={`${game.name}封面`} className="game-cover" />
          <span className="status-pill">{game.status}</span>
        </div>
        <div className="game-card-body">
          <div className="game-title-row">
            <h3>{game.name}</h3>
            <span className="version">{game.latestVersion || '未记录'}</span>
          </div>
          <p className="game-genre">{game.genre || '未分类'}</p>
          <p className="game-desc">{game.description}</p>
          <div className="card-footer">
            <span>{game.views || 0} 次浏览</span>
            <span>最近更新 {game.updatedAt}</span>
          </div>
        </div>
      </Link>
      <div className="game-card-body game-card-tags">
        <div className="tag-row">
          {(game.tags || []).slice(0, 5).map((t) => (
            <Link href={`/tags/${encodeURIComponent(t)}`} className="tag" key={t}>
              {t}
            </Link>
          ))}
        </div>
      </div>
      <div className="card-action">
        <FavoriteButton targetType="game" targetId={game.id} />
      </div>
    </article>
  );
}
