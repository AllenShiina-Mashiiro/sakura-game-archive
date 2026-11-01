import type { ReactNode } from 'react';
const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi;
export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const url = raw.replace(/[),，。；;！？!?]+$/g, '');
    const trailing = raw.slice(url.length);
    if (index > last) parts.push(text.slice(last, index));
    parts.push(<a key={index} href={url} target="_blank" rel="noopener noreferrer" className={className || 'inline-external-link'}>{url}</a>);
    if (trailing) parts.push(trailing);
    last = index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}