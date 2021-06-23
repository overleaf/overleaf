import { useEffect, useRef } from 'react'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'

export default function SymbolPaletteItem({
  focused,
  handleSelect,
  handleKeyDown,
  symbol,
}) {
  const buttonRef = useRef(null)

  // call focus() on this item when appropriate
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
    <OverlayTrigger
      placement="top"
      trigger={['hover', 'focus']}
      overlay={
        <Tooltip id={`tooltip-symbol-${symbol.codepoint}`}>
          <div className="symbol-palette-item-description">
            {symbol.description}
          </div>
          <div className="symbol-palette-item-command">{symbol.command}</div>
          {symbol.notes && (
            <div className="symbol-palette-item-notes">{symbol.notes}</div>
          )}
        </Tooltip>
      }
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
    </OverlayTrigger>
  )
}
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
