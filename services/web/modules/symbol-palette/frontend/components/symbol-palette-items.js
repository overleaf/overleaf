import { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import SymbolPaletteItem from './symbol-palette-item'

export default function SymbolPaletteItems({
  items,
  handleSelect,
  focusInput,
}) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const itemRefs = useRef([])

  useEffect(() => {
    itemRefs.current = items.map((_, i) => itemRefs.current[i] || null)
    setFocusedIndex(0)
  }, [items])

  const getItemRects = () => {
    return itemRefs.current.map(ref => ref?.getBoundingClientRect?.() ?? null)
  }

  const handleKeyDown = useCallback(
    event => {
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return

      const rects = getItemRects()
      const currentRect = rects[focusedIndex]
      if (!currentRect) return

      let newIndex = focusedIndex

      switch (event.key) {
        case 'ArrowLeft':
          newIndex = focusedIndex > 0 ? focusedIndex - 1 : items.length - 1
          break
        case 'ArrowRight':
          newIndex = focusedIndex < items.length - 1 ? focusedIndex + 1 : 0
          break
        case 'ArrowUp':
        case 'ArrowDown': {
          const direction = event.key === 'ArrowUp' ? -1 : 1
          const candidates = rects
            .map((rect, i) => ({ rect, i }))
            .filter(({ rect }, i) =>
              i !== focusedIndex &&
              rect &&
              Math.abs(rect.x - currentRect.x) < currentRect.width * 0.8 &&
              (direction === -1 ? rect.y < currentRect.y : rect.y > currentRect.y)
            )

          if (candidates.length > 0) {
            const closest = candidates.reduce((a, b) =>
              Math.abs(b.rect.y - currentRect.y) < Math.abs(a.rect.y - currentRect.y) ? b : a
            )
            newIndex = closest.i
          }
          break
        }
        case 'Home':
          newIndex = 0
          break
        case 'End':
          newIndex = items.length - 1
          break
        case 'Enter':
        case ' ':
          handleSelect(items[focusedIndex])
          window.dispatchEvent(new CustomEvent('editor:focus'))
          break
        case 'Escape':
          window.dispatchEvent(new CustomEvent('editor:focus'))
          break

        default:
          focusInput()
          return
      }

      event.preventDefault()
      setFocusedIndex(newIndex)
    },
    [focusedIndex, items, focusInput, handleSelect]
  )

  return (
    <div className="symbol-palette-items" role="listbox" aria-label="Symbols">
      {items.map((symbol, index) => (
        <SymbolPaletteItem
          key={symbol.codepoint}
          symbol={symbol}
          handleSelect={symbol => {
            handleSelect(symbol)
            setFocusedIndex(index)
          }}
          handleKeyDown={handleKeyDown}
          focused={index === focusedIndex}
          ref={el => {
            itemRefs.current[index] = el
          }}
        />
      ))}
    </div>
  )
}

SymbolPaletteItems.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      codepoint: PropTypes.string.isRequired,
    })
  ).isRequired,
  handleSelect: PropTypes.func.isRequired,
  focusInput: PropTypes.func.isRequired,
}

