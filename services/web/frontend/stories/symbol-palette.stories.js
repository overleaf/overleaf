import React from 'react'

import SymbolPalette from '../js/features/symbol-palette/components/symbol-palette'

export const Interactive = args => {
  return <SymbolPalette {...args} />
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
