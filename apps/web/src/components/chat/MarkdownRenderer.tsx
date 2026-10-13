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
      className={`prose prose-invert max-w-none break-words text-gray-200 text-sm leading-relaxed prose-code:before:content-none prose-code:after:content-none ${className}`}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-base md:text-lg font-bold text-white mt-2 mb-1 border-b border-gray-700/50 pb-0.5">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm md:text-base font-bold text-white mt-1.5 mb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs md:text-sm font-bold text-gray-200 mt-1 mb-0.5">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="leading-relaxed mb-1 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
          del: ({ children }) => <del className="line-through text-gray-400">{children}</del>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-slack-green bg-[#222529]/70 px-3 py-1 my-1.5 rounded-r text-gray-300 italic">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="bg-[#141618] border border-gray-700/70 rounded-xl p-3 my-2 font-mono text-xs text-gray-200 overflow-x-auto shadow-inner leading-relaxed block [&_code]:bg-transparent [&_code]:text-gray-200 [&_code]:border-0 [&_code]:p-0 [&_code]:font-mono [&_code]:text-xs [&_code]:font-normal">
              {children}
            </pre>
          ),
          code: ({ children, ...props }: any) => {
            return (
              <code
                className="bg-[#2C3136] text-[#ECB22E] px-1.5 py-0.5 rounded font-mono text-[12px] border border-gray-700/60 font-medium inline leading-none align-baseline"
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
