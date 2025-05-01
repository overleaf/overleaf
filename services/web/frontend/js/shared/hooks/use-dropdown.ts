import { useCallback, useEffect, useRef, useState } from 'react'
import { findDOMNode } from 'react-dom'

export default function useDropdown(defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen)

  // store the dropdown node for use in the "click outside" event listener
  const ref = useRef<ReturnType<typeof findDOMNode>>(null)

  // react-bootstrap v0.x passes `component` instead of `node` to the ref callback
  const handleRef = useCallback(
    (component: any) => {
      if (component) {
        // eslint-disable-next-line react/no-find-dom-node
        ref.current = findDOMNode(component)
      }
    },
    [ref]
  )

  // prevent a click on the dropdown toggle propagating to the original handler
  const handleClick = useCallback((event: any) => {
    event.stopPropagation()
  }, [])

  // handle dropdown toggle
  const handleToggle = useCallback((value: any) => {
    setOpen(Boolean(value))
  }, [])

  // close the dropdown on click outside the dropdown
  const handleDocumentClick = useCallback(
    (event: any) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false)
      }
    },
    [ref]
  )

  // add/remove listener for click anywhere in document
  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleDocumentClick)
    }

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [open, handleDocumentClick])

  // return props for the Dropdown component
  return { ref: handleRef, onClick: handleClick, onToggle: handleToggle, open }
}
