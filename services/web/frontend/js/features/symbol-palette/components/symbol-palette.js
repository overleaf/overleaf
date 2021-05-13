import React from 'react'
import PropTypes from 'prop-types'
import SymbolPaletteContent from './symbol-palette-content'

export default function SymbolPalette({ show, handleSelect }) {
  if (!show) {
    return null
  }

  return <SymbolPaletteContent handleSelect={handleSelect} />
}
SymbolPalette.propTypes = {
  show: PropTypes.bool,
  handleSelect: PropTypes.func.isRequired,
}
