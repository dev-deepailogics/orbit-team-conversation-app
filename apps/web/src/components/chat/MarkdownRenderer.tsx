'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onMentionClick?: (username: string) => void;
  onChannelClick?: (channelId: string) => void;
  currentUsername?: string;
}

export function formatMentions(text: string): string {
  if (!text) return '';
  // Split by code blocks (```...```) and inline code (`...`) to preserve them
  const parts = text.split(/(```[\s\S]*?```|`[^`]*`)/g);
  return parts
    .map((part) => {
      if (part.startsWith('`')) return part;
      // Convert @username (preceded by start of line, whitespace, or bracket) to markdown link: [@username](mention://username)
      return part.replace(/(^|[\s(])@([a-zA-Z0-9_\.\-]+)/g, '$1[@$2](mention://$2)');
    })
    .join('');
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  onMentionClick,
  onChannelClick,
  currentUsername,
}) => {
  const formattedContent = React.useMemo(() => formatMentions(content), [content]);

  return (
    <div
      style={{ color: 'var(--theme-text-primary)' }}
      className={`max-w-none break-words text-sm leading-relaxed prose-code:before:content-none prose-code:after:content-none ${className}`}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1
              className="text-base md:text-lg font-bold mt-2 mb-1 border-b pb-0.5"
              style={{ color: 'var(--theme-text-primary)', borderColor: 'var(--theme-border)' }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className="text-sm md:text-base font-bold mt-1.5 mb-1"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className="text-xs md:text-sm font-bold mt-1 mb-0.5"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed mb-1 last:mb-0" style={{ color: 'var(--theme-text-primary)' }}>
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic" style={{ color: 'var(--theme-text-primary)' }}>
              {children}
            </em>
          ),
          del: ({ children }) => (
            <del className="line-through" style={{ color: 'var(--theme-text-muted)' }}>
              {children}
            </del>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              className="border-l-4 px-3 py-1 my-1.5 rounded-r italic"
              style={{
                borderColor: 'var(--theme-primary)',
                backgroundColor: 'var(--theme-bg-surface)',
                color: 'var(--theme-text-muted)',
              }}
            >
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre
              className="border rounded-xl p-3 my-2 font-mono text-xs overflow-x-auto shadow-inner leading-relaxed block [&_code]:bg-transparent [&_code]:border-0 [&_code]:p-0 [&_code]:font-mono [&_code]:text-xs [&_code]:font-normal"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {children}
            </pre>
          ),
          code: ({ children, ...props }: any) => {
            return (
              <code
                className="px-1.5 py-0.5 rounded font-mono text-[12px] border font-medium inline leading-none align-baseline"
                style={{
                  backgroundColor: 'var(--theme-bg-surface-hover)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-primary)',
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          a: ({ href, children }) => {
            if (href?.startsWith('mention://')) {
              const username = href.replace('mention://', '');
              const isMe = currentUsername && username.toLowerCase() === currentUsername.toLowerCase();
              return (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onMentionClick?.(username);
                  }}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs transition cursor-pointer select-none mx-0.5 ${
                    isMe
                      ? 'bg-slack-green/20 text-slack-green border border-slack-green/40 hover:bg-slack-green/30 font-bold'
                      : 'bg-[#1D3B53] text-[#36C5F0] border border-[#36C5F0]/30 hover:bg-[#234b6b] font-medium'
                  }`}
                  title={`Mention @${username}`}
                >
                  {children}
                </span>
              );
            }

            if (href?.startsWith('channel://')) {
              const channelId = href.replace('channel://', '');
              return (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onChannelClick?.(channelId);
                  }}
                  className="text-slack-green font-semibold hover:underline cursor-pointer inline-flex items-center gap-0.5"
                >
                  {children}
                </span>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-[#36C5F0] hover:underline hover:text-[#5bd3f7] transition font-medium inline-flex items-center gap-0.5"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
};
