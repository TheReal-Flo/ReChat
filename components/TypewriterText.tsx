import { useState, useEffect } from 'react'

interface TypewriterTextProps {
  text: string
  speed?: number
  className?: string
  onComplete?: () => void
}

export function TypewriterText({ text, speed = 50, className = '', onComplete }: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [previousText, setPreviousText] = useState('')

  useEffect(() => {
    // Only start typewriter effect if text has actually changed
    if (text !== previousText && text) {
      setPreviousText(text)
      setDisplayText('')
      setCurrentIndex(0)
      setIsTyping(true)
    }
  }, [text, previousText])

  useEffect(() => {
    if (isTyping && currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)

      return () => clearTimeout(timer)
    } else if (isTyping && currentIndex >= text.length) {
      setIsTyping(false)
      onComplete?.()
    }
  }, [currentIndex, text, speed, isTyping, onComplete])

  // If not typing, show the full text immediately
  const textToShow = isTyping ? displayText : text

  return (
    <span className={className}>
      {textToShow}
      {isTyping && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  )
}