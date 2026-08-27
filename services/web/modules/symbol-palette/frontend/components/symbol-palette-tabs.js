import PropTypes from 'prop-types'
import { useRef } from 'react'


export default function SymbolPaletteTabs({
  categories,
  activeCategoryId,
  setActiveCategoryId,
}) {

  const buttonRefs = useRef([])
  const focusTab = (index) => {
    setActiveCategoryId(categories[index].id)
    buttonRefs.current[index]?.focus()
  }

  const handleKeyDown = (e, index) => {
    switch (e.key) {
      case 'ArrowRight':
        focusTab((index + 1) % categories.length)
        break
      case 'ArrowLeft':
        focusTab((index - 1 + categories.length) % categories.length)
        break
      case 'Home':
      case 'PageUp':
        focusTab(0)
        break
      case 'End':
      case 'PageDown':
        focusTab(categories.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Symbol Categories"
      className="symbol-palette-tab-list"
            tabIndex={0}
    >
      {categories.map((category, index) => {
        const selected = activeCategoryId === category.id
        return (
          <button
            key={category.id}
            role="tab"
            type="button"
            className="symbol-palette-tab"
            id={`symbol-palette-tab-${category.id}`}
            aria-controls={`symbol-palette-panel-${category.id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            ref={(el) => (buttonRefs.current[index] = el)}
            onClick={() => setActiveCategoryId(category.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {category.label}
          </button>
        )
      })}
    </div>
  )
}

SymbolPaletteTabs.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  activeCategoryId: PropTypes.string.isRequired,
  setActiveCategoryId: PropTypes.func.isRequired,
}
