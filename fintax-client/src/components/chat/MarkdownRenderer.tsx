import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-white prose-code:text-blue-300 prose-code:bg-slate-900/70 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-white">{children}</h3>,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/5">{children}</thead>,
          th: ({ children }) => <th className="border border-white/10 px-2 py-1 text-left font-semibold text-white">{children}</th>,
          td: ({ children }) => <td className="border border-white/10 px-2 py-1 text-slate-200">{children}</td>,
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-200">
              {children}
            </pre>
          ),
          code: ({ children }) => <code>{children}</code>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-blue-300 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-200"
            >
              {children}
            </a>
          ),
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
