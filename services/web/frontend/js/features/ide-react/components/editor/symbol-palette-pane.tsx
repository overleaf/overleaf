import React, { ElementType, FC } from 'react'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'

const symbolPaletteComponents = importOverleafModules(
  'sourceEditorSymbolPalette'
) as { import: { default: ElementType }; path: string }[]

const SymbolPalettePane: FC = () => {
  return (
    <div className="ide-react-symbol-palette">
      {symbolPaletteComponents.map(
        ({ import: { default: Component }, path }) => (
          <Component key={path} />
        )
      )}
    </div>
  )
}

export default SymbolPalettePane
