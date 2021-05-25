import React from 'react'

import SymbolPalette from '../js/features/symbol-palette/components/symbol-palette'

export const Interactive = args => {
  return (
    <div style={{ maxWidth: 700, marginTop: 120 }}>
      <SymbolPalette {...args} />
    </div>
  )
}

export default {
  title: 'Symbol Palette',
  component: SymbolPalette,
  args: {
    show: true,
  },
  argTypes: {
    handleSelect: { action: 'handleSelect' },
  },
}
