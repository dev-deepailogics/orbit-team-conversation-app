"use client";

import React, { useState, useMemo } from "react";
import DOMPurify from "dompurify";
import { Image as ImageIcon, ShieldCheck } from "lucide-react";

interface SandboxedMailViewerProps {
  htmlContent?: string | null;
  textContent?: string | null;
}

export const SandboxedMailViewer: React.FC<SandboxedMailViewerProps> = ({
  htmlContent,
  textContent,
}) => {
  const [loadRemoteImages, setLoadRemoteImages] = useState(false);

  // Check if content has remote images
  const hasRemoteImages = useMemo(() => {
    if (!htmlContent) return false;
    return /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i.test(htmlContent);
  }, [htmlContent]);

  // Sanitize and transform HTML
  const sanitizedSrcDoc = useMemo(() => {
    if (htmlContent) {
      let processed = htmlContent;

      if (!loadRemoteImages) {
        // Replace external image sources with placeholder
        processed = processed.replace(
          /<img([^>]+)src=["'](https?:\/\/[^"']+)["']([^>]*)>/gi,
          '<img$1data-original-src="$2" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'30\' viewBox=\'0 0 100 30\'%3E%3Crect width=\'100\' height=\'30\' fill=\'%23333333\' rx=\'4\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23888888\' font-size=\'10\'%3EImage blocked%3C/text%3E%3C/svg%3E"$3>'
        );
      }

      const cleanHtml = DOMPurify.sanitize(processed, {
        ADD_TAGS: ["style"],
        ADD_ATTR: ["target", "data-original-src"],
        FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
      });

      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <base target="_blank" />
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                color: #e2e8f0;
                background-color: transparent;
                margin: 0;
                padding: 16px;
                word-break: break-word;
              }
              a { color: #60a5fa; text-decoration: underline; }
              img { max-width: 100%; height: auto; }
              table { max-width: 100% !important; }
              pre, code {
                font-family: monospace;
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
                padding: 2px 4px;
              }
              blockquote {
                border-left: 3px solid #4b5563;
                margin: 0 0 16px 0;
                padding-left: 12px;
                color: #9ca3af;
              }
            </style>
          </head>
          <body>${cleanHtml}</body>
        </html>
      `;
    }

    // Plain text fallback
    const escapedText = (textContent || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br />");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #e2e8f0;
              margin: 0;
              padding: 16px;
              white-space: pre-wrap;
              word-break: break-word;
            }
          </style>
        </head>
        <body>${escapedText}</body>
      </html>
    `;
  }, [htmlContent, textContent, loadRemoteImages]);

  return (
    <div className="flex flex-col h-full w-full">
      {hasRemoteImages && !loadRemoteImages && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <ImageIcon size={14} className="text-amber-400" />
            <span>Remote images are blocked to protect your privacy.</span>
          </div>
          <button
            onClick={() => setLoadRemoteImages(true)}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded font-medium transition"
          >
            Load Images
          </button>
        </div>
      )}

      {hasRemoteImages && loadRemoteImages && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20 text-[11px] text-emerald-400">
          <ShieldCheck size={13} />
          <span>Remote images loaded</span>
        </div>
      )}

      <iframe
        srcDoc={sanitizedSrcDoc}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        title="Email content"
        className="w-full flex-1 border-0 bg-transparent min-h-[400px]"
      />
    </div>
  );
};
