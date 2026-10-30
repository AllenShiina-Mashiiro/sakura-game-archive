'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
export function SocialIndicators() {
  const [messages, setMessages] = useState(0);
  const [notifications, setNotifications] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/social/unread', { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (alive) {
          setMessages(d.unreadMessages || 0);
          setNotifications(d.unreadNotifications || 0);
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <span className="social-indicators">
      <Link href="/messages">私信{messages > 0 && <i>{messages > 99 ? '99+' : messages}</i>}</Link>
      <Link href="/notifications">通知{notifications > 0 && <i>{notifications > 99 ? '99+' : notifications}</i>}</Link>
    </span>
  );
}
