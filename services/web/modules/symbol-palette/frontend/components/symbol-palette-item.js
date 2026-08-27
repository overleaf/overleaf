import { useEffect, useRef, forwardRef } from 'react'
import PropTypes from 'prop-types'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

const SymbolPaletteItem = forwardRef(function ({ 
  focused,
  handleSelect,
  handleKeyDown,
  symbol,
}, ref) {
  const buttonRef = useRef(null)

  // Forward internal ref to parent
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(buttonRef.current)
      } else {
        ref.current = buttonRef.current
      }
    }
  }, [ref])

  // Focus the item when it becomes focused
  useEffect(() => {
    if (
      focused &&
      buttonRef.current &&
      document.activeElement?.closest('.symbol-palette-items')
    ) {
      buttonRef.current.focus()
    }
  }, [focused])

  return (
    <OLTooltip
      id={`symbol-${symbol.codepoint}`}
      description={
        <div>
          <div className="symbol-palette-item-description">
            {symbol.description}
          </div>
          <div className="symbol-palette-item-command">
            {symbol.command}
          </div>
          {symbol.notes && (
            <div className="symbol-palette-item-notes">
              {symbol.notes}
            </div>
          )}
        </div>
      }
      overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
    >
      <button
        key={symbol.codepoint}
        className="symbol-palette-item"
        onClick={() => handleSelect(symbol)}
        onKeyDown={handleKeyDown}
        tabIndex={focused ? 0 : -1}
        ref={buttonRef}
        role="option"
        aria-label={symbol.description}
        aria-selected={focused ? 'true' : 'false'}
      >
        {symbol.character}
      </button>
    </OLTooltip>
  )
})

SymbolPaletteItem.propTypes = {
  symbol: PropTypes.shape({
    codepoint: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    command: PropTypes.string.isRequired,
    character: PropTypes.string.isRequired,
    notes: PropTypes.string,
  }),
  handleKeyDown: PropTypes.func.isRequired,
  handleSelect: PropTypes.func.isRequired,
  focused: PropTypes.bool,
}
export default SymbolPaletteItem
