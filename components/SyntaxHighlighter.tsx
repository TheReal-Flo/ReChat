import React, { memo, useMemo, useRef, useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';

// Language display component
const LanguageLabel = memo(({ 
  language, 
  className = '' 
}: { 
  language: string; 
  className?: string; 
}) => {
  const displayLanguage = useMemo(() => {
    const languageMap: Record<string, string> = {
      'js': 'JavaScript',
      'javascript': 'JavaScript',
      'ts': 'TypeScript',
      'typescript': 'TypeScript',
      'py': 'Python',
      'python': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'csharp': 'C#',
      'php': 'PHP',
      'rb': 'Ruby',
      'ruby': 'Ruby',
      'go': 'Go',
      'rust': 'Rust',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'dart': 'Dart',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'sass': 'Sass',
      'json': 'JSON',
      'xml': 'XML',
      'yaml': 'YAML',
      'yml': 'YAML',
      'toml': 'TOML',
      'sql': 'SQL',
      'bash': 'Bash',
      'sh': 'Shell',
      'powershell': 'PowerShell',
      'dockerfile': 'Dockerfile',
      'markdown': 'Markdown',
      'md': 'Markdown',
      'text': 'Text',
      'plaintext': 'Plain Text',
    };
    
    return languageMap[language.toLowerCase()] || language.toUpperCase();
  }, [language]);
  
  return (
    <div
      className={`language-label ${className}`}
      style={{
        position: 'absolute',
        top: '8px',
        left: '12px',
        background: 'rgba(255, 255, 255, 0.1)',
        color: '#e5e7eb',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        zIndex: 5,
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {displayLanguage}
    </div>
  );
});

// Copy button component (updated positioning to avoid language label)
const CopyButton = memo(({ 
  code, 
  className = '' 
}: { 
  code: string; 
  className?: string; 
}) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <button
      onClick={handleCopy}
      className={`copy-button ${className}`}
      title={copied ? 'Copied!' : 'Copy code'}
      style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        background: copied ? '#10b981' : '#374151',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        padding: '6px 8px',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.2s ease',
        zIndex: 10,
        opacity: 0.8,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.8';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {copied ? (
        <>
          <CheckIcon />
          Copied!
        </>
      ) : (
        <>
          <CopyIcon />
          Copy
        </>
      )}
    </button>
  );
});

// Code block header component
const CodeBlockHeader = memo(({ 
  language, 
  code, 
  showLanguage = true, 
  showCopyButton = true 
}: {
  language: string;
  code: string;
  showLanguage?: boolean;
  showCopyButton?: boolean;
}) => {
  return (
    <>
      {showLanguage && <LanguageLabel language={language} />}
      {showCopyButton && <CopyButton code={code} />}
    </>
  );
});

// Simple SVG icons
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>
);

// Enhanced memoized syntax highlighter with language label and copy button
const MemoizedSyntaxHighlighter = memo(
  ({ 
    children, 
    language, 
    showCopyButton = true,
    showLanguage = true,
    ...props 
  }: {
    children: string;
    language: string;
    showCopyButton?: boolean;
    showLanguage?: boolean;
    [key: string]: any;
  }) => {
    return (
      <div style={{ position: 'relative' }}>
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: '8px',
            fontSize: '14px',
            paddingTop: showLanguage ? '40px' : '16px', // Extra padding for language label
          }}
          {...props}
        >
          {children}
        </SyntaxHighlighter>
        <CodeBlockHeader 
          language={language}
          code={children}
          showLanguage={showLanguage}
          showCopyButton={showCopyButton}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.children === nextProps.children &&
      prevProps.language === nextProps.language &&
      prevProps.showCopyButton === nextProps.showCopyButton &&
      prevProps.showLanguage === nextProps.showLanguage
    );
  }
);

// Streaming-aware code block component with language display
export const StreamingCodeBlock = memo(({
  children, 
  className, 
  showCopyButton = true,
  showLanguage = true,
  ...props 
}: {
  children: string;
  className?: string;
  showCopyButton?: boolean;
  showLanguage?: boolean;
  [key: string]: any;
}) => {
  const [isComplete, setIsComplete] = useState(false);
  const [finalContent, setFinalContent] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>(null);
  
  const language = className?.replace('language-', '') || 'text';
  
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (!isComplete) {
        setFinalContent(children);
        setIsComplete(true);
      }
    }, 100);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [children, isComplete]);
  
  useEffect(() => {
    if (isComplete && finalContent !== children) {
      const contentDiff = Math.abs(children.length - finalContent.length);
      if (contentDiff > children.length * 0.1) {
        setIsComplete(false);
        setFinalContent('');
      }
    }
  }, [children, finalContent, isComplete]);
  
  // Show plain text with language label and copy button while streaming
  if (!isComplete) {
    return (
      <div style={{ position: 'relative' }}>
        <pre 
          className={className} 
          style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: '16px',
            paddingTop: showLanguage ? '40px' : '16px',
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '14px',
            margin: 0,
          }}
          {...props}
        >
          <code>{children}</code>
        </pre>
        <CodeBlockHeader 
          language={language}
          code={children}
          showLanguage={showLanguage}
          showCopyButton={showCopyButton}
        />
      </div>
    );
  }
  
  return (
    <MemoizedSyntaxHighlighter 
      language={language} 
      showCopyButton={showCopyButton}
      showLanguage={showLanguage}
      {...props}
    >
      {finalContent}
    </MemoizedSyntaxHighlighter>
  );
});