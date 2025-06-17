import React, { memo, useState } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { StreamingCodeBlock } from './SyntaxHighlighter'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkdownMessageProps {
  content: string
  className?: string
}

const MarkdownMessage = memo(function MarkdownMessage({ content, className = '' }: MarkdownMessageProps) {
  const [showThinking, setShowThinking] = useState(false)
  
  // Extract thinking blocks and regular content
  // Handle both complete and incomplete thinking blocks
  const hasOpenThink = content.includes('<think>')
  let thinkingContent = ''
  let regularContent = content
  
  if (hasOpenThink) {
    // Check for complete thinking blocks first
    const completeThinkRegex = /<think>(.*?)<\/think>/g
    const completeMatches = content.match(completeThinkRegex)
    
    if (completeMatches) {
      // Handle complete blocks
      thinkingContent = completeMatches.map(match => match.replace(/<\/?think>/g, '')).join('\n\n')
      regularContent = content.replace(completeThinkRegex, '').trim()
    } else {
      // Handle incomplete block (streaming)
      const openThinkIndex = content.indexOf('<think>')
      if (openThinkIndex !== -1) {
        const afterThink = content.substring(openThinkIndex + 7) // 7 is length of '<think>'
        const closeThinkIndex = afterThink.indexOf('</think>')
        
        if (closeThinkIndex === -1) {
          // Incomplete block - show everything after <think>
          thinkingContent = afterThink
          regularContent = content.substring(0, openThinkIndex).trim()
        } else {
          // This shouldn't happen if completeMatches worked, but handle it
          thinkingContent = afterThink.substring(0, closeThinkIndex)
          regularContent = (content.substring(0, openThinkIndex) + afterThink.substring(closeThinkIndex + 8)).trim()
        }
      }
    }
  }
  const markdownComponents: Components = {
    // Custom styling for different markdown elements
    h1: ({ children }) => (
      <h1 className="text-xl font-bold text-white mb-3 mt-4">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-semibold text-white mb-2 mt-3">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-medium text-white mb-2 mt-2">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-gray-300 mb-2 leading-relaxed">{children}</p>
    ),
    code: ({ node, inline, className, children, ...codeProps }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      
      if (!inline && match) {
        return (
          <StreamingCodeBlock 
            className={className} 
            showCopyButton={true}
            {...codeProps}
          >
            {String(children).replace(/\n$/, '')}
          </StreamingCodeBlock>
        );
      }
      
      return (
        <code className="bg-gray-700 px-1 py-1 rounded text-teal-300 text-sm font-mono inline">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-gray-800 p-3 rounded-lg overflow-x-auto mb-3 max-w-full">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-teal-500 pl-4 italic text-gray-400 my-3">
        {children}
      </blockquote>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-gray-300">{children}</li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-gray-300">{children}</em>
    ),
    a: ({ children, href }) => (
      <a 
        href={href} 
        className="text-teal-400 hover:text-teal-300 underline" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto mb-3 max-w-full">
        <table className="min-w-full border border-gray-600 rounded-lg">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-700">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="bg-gray-800">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="border-b border-gray-600">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left text-white font-medium">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-gray-300">{children}</td>
    ),
    hr: () => (
      <hr className="border-gray-600 my-4" />
    ),
    img: ({ src, alt, ...props }) => {
      // Don't render if src is empty or invalid
      if (!src || (typeof src === 'string' && (src.trim() === '' || src === 'data:image/png;base64,'))) {
        console.warn('Invalid or empty image source:', src)
        return null
      }
      return (
        <img 
          src={src} 
          alt={alt || 'Generated image'}
          className="max-w-full h-auto rounded-lg my-3"
          loading="lazy"
          {...props}
        />
      )
    },
  }

  return (
    <div className={`w-full min-w-0 bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl rounded-tl-md p-4 border border-gray-700/50 shadow-lg backdrop-blur-sm glow-border-blue transition-all duration-200 ${className}`}>
      {/* Thinking toggle button - only show if there's thinking content */}
      {thinkingContent && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowThinking(!showThinking)}
          className="mb-3 text-gray-400 hover:text-gray-300 hover:bg-gray-800 p-2 h-auto max-w-full"
        >
          <Brain className="h-4 w-4 mr-2" />
          <span className="text-sm">Reasoning</span>
          {showThinking ? (
            <ChevronDown className="h-4 w-4 ml-2" />
          ) : (
            <ChevronRight className="h-4 w-4 ml-2" />
          )}
        </Button>
      )}
      
      {/* Thinking content - collapsible */}
      {thinkingContent && showThinking && (
      <div className="mb-4 p-4 bg-gray-800 border border-gray-700 rounded-lg max-w-full min-w-0 overflow-hidden">
          <div className="text-xs text-gray-400 mb-2 font-medium uppercase">Reasoning Process</div>
          <div className="max-w-full min-w-0 overflow-x-auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {thinkingContent}
            </ReactMarkdown>
          </div>
        </div>
      )}
      
      {/* Regular content */}
      {regularContent && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {regularContent}
        </ReactMarkdown>
      )}
    </div>
  )
})

export { MarkdownMessage }