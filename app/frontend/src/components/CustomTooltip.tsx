import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  text: string
  delay?: number
  position?: 'top' | 'bottom' | 'left' | 'right'
}

// Singleton pattern to manage a single tooltip instance
// This prevents multiple tooltips from showing at once
let activeTooltipTimeout: number | null = null

export function useTooltip(delay = 100) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [content, setContent] = useState('')
  
  // Clear any existing tooltip timeout when component unmounts
  useEffect(() => {
    return () => {
      if (activeTooltipTimeout !== null) {
        window.clearTimeout(activeTooltipTimeout)
        activeTooltipTimeout = null
      }
    }
  }, [])
  
  const showTooltip = (text: string, x: number, y: number) => {
    // Clear any existing tooltip timeout
    if (activeTooltipTimeout !== null) {
      window.clearTimeout(activeTooltipTimeout)
    }
    
    // Set new timeout
    activeTooltipTimeout = window.setTimeout(() => {
      setContent(text)
      setPosition({ x, y })
      setIsVisible(true)
    }, delay)
  }
  
  const hideTooltip = () => {
    if (activeTooltipTimeout !== null) {
      window.clearTimeout(activeTooltipTimeout)
      activeTooltipTimeout = null
    }
    setIsVisible(false)
  }
  
  // Handlers to be attached to elements
  const tooltipHandlers = {
    onMouseEnter: (e: React.MouseEvent, text: string) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      showTooltip(text, rect.left + rect.width / 2, rect.top)
    },
    onMouseLeave: () => hideTooltip(),
    onFocus: (e: React.FocusEvent, text: string) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      showTooltip(text, rect.left + rect.width / 2, rect.top)
    },
    onBlur: () => hideTooltip()
  }
  
  // The tooltip component that will be rendered with createPortal
  const Tooltip = isVisible ? (
    createPortal(
      <div 
        className="fixed z-50 px-3 py-2 text-sm bg-gray-800 text-white rounded shadow-lg max-w-xs"
        style={{
          left: `${position.x}px`,
          top: `${position.y - 10}px`,
          transform: 'translate(-50%, -100%)',
          opacity: isVisible ? 0.9 : 0, // Make tooltip slightly translucent
          transition: 'opacity 0.2s',
          backdropFilter: 'blur(1px)',
        }}
      >
        {/* Preserve whitespace and line breaks */}
        <div className="whitespace-pre-wrap">{content}</div>
      </div>,
      document.body
    )
  ) : null
  
  return { Tooltip, tooltipHandlers }
}

// Higher order component to add tooltip functionality to any element
export function WithTooltip({ text, children, delay = 100 }: TooltipProps & { children: React.ReactElement }) {
  const { Tooltip, tooltipHandlers } = useTooltip(delay)
  
  const childWithTooltip = React.cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      tooltipHandlers.onMouseEnter(e, text)
      if (children.props.onMouseEnter) children.props.onMouseEnter(e)
    },
    onMouseLeave: (e: React.MouseEvent) => {
      tooltipHandlers.onMouseLeave()
      if (children.props.onMouseLeave) children.props.onMouseLeave(e)
    },
    onFocus: (e: React.FocusEvent) => {
      tooltipHandlers.onFocus(e, text)
      if (children.props.onFocus) children.props.onFocus(e)
    },
    onBlur: (e: React.FocusEvent) => {
      tooltipHandlers.onBlur()
      if (children.props.onBlur) children.props.onBlur(e)
    }
  })
  
  return (
    <>
      {childWithTooltip}
      {Tooltip}
    </>
  )
}