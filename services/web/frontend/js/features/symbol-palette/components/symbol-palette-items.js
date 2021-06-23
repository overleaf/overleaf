import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import SymbolPaletteItem from './symbol-palette-item'

export default function SymbolPaletteItems({
  items,
  handleSelect,
  focusInput,
}) {
  const [focusedIndex, setFocusedIndex] = useState(0)

  // reset the focused item when the list of items changes
  useEffect(() => {
    setFocusedIndex(0)
  }, [items])

  // navigate through items with left and right arrows
  const handleKeyDown = useCallback(
    event => {
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
        return
      }

      switch (event.key) {
        // focus previous item
        case 'ArrowLeft':
        case 'ArrowUp':
          setFocusedIndex(index => (index > 0 ? index - 1 : items.length - 1))
          break

        // focus next item
        case 'ArrowRight':
        case 'ArrowDown':
          setFocusedIndex(index => (index < items.length - 1 ? index + 1 : 0))
          break

        // focus first item
        case 'Home':
          setFocusedIndex(0)
          break

        // focus last item
        case 'End':
          setFocusedIndex(items.length - 1)
          break

        // allow the default action
        case 'Enter':
        case ' ':
          break

        // any other key returns focus to the input
        default:
          focusInput()
          break
      }
    },
    [focusInput, items.length]
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
