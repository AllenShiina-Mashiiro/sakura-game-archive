'use client';
import { useEffect, useState } from 'react';
const colors = ['#ec8eb8', '#b99bea', '#83c8e8', '#9ccf9b', '#e6b96b', '#e78f8f'];
export function ThemeEffects({ initialMode, initialColor, initialPetals }: { initialMode: 'light' | 'dark'; initialColor: string; initialPetals: boolean }) {
  const [mode, setMode] = useState(initialMode);
  const [color, setColor] = useState(initialColor || '#ec8eb8');
  const [petals, setPetals] = useState(initialPetals);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.style.setProperty('--accent', color);
    root.style.setProperty('--user-accent', color);
  }, [mode, color]);
  async function save(next: { themeMode?: string; themeColor?: string; sakuraEnabled?: boolean }) {
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'user-appearance', ...next }),
      });
    } catch {}
  }
  function changeMode() {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    save({ themeMode: next });
  }
  function changeColor(v: string) {
    setColor(v);
    save({ themeColor: v });
  }
  function changePetals() {
    const next = !petals;
    setPetals(next);
    save({ sakuraEnabled: next });
  }
  return (
    <>
      <div className="sakura-particles" aria-hidden="true" data-enabled={petals}>
        {Array.from({ length: 18 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 37 + 7) % 100}%`,
              animationDelay: `${(i % 9) * -2.3}s`,
              animationDuration: `${13 + (i % 7) * 2}s`,
              fontSize: `${10 + (i % 5) * 3}px`,
              color: colors[i % colors.length],
            }}
          >
            ✿
          </i>
        ))}
      </div>
      <div className="appearance-float">
        <button type="button" className="appearance-toggle" onClick={() => setOpen((v) => !v)} aria-label="外观设置">
          ✿
        </button>
        {open && (
          <div className="appearance-popover">
            <b>外观设置</b>
            <button type="button" className="appearance-option" onClick={changeMode}>
              {mode === 'dark' ? '☀ 切换昼间模式' : '☾ 切换夜间模式'}
            </button>
            <label className="appearance-color">
              主题颜色
              <input type="color" value={color} onChange={(e) => changeColor(e.target.value)} />
            </label>
            <button type="button" className="appearance-option" onClick={changePetals}>
              {petals ? '❀ 关闭樱花粒子' : '❀ 开启樱花粒子'}
            </button>
            <small>设置自动保存到个人账户</small>
          </div>
        )}
      </div>
    </>
  );
}
