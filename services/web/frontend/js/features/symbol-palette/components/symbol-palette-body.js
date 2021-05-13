import React from 'react'
import { TabPanels, TabPanel } from '@reach/tabs'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import SymbolPaletteItems from './symbol-palette-items'

export default function SymbolPaletteBody({
  categories,
  categorisedSymbols,
  filteredSymbols,
  handleSelect,
  focusInput,
}) {
  const { t } = useTranslation()

  // not searching: show the symbols grouped by category
  if (!filteredSymbols) {
    return (
      <TabPanels>
        {categories.map(category => (
          <TabPanel key={category.id} tabIndex={-1}>
            <SymbolPaletteItems
              items={categorisedSymbols[category.id]}
              handleSelect={handleSelect}
              focusInput={focusInput}
            />
          </TabPanel>
        ))}
      </TabPanels>
    )
  }

  // searching with no matches: show a message
  if (!filteredSymbols.length) {
    return <div className="symbol-palette-empty">{t('no_symbols_found')}</div>
  }

  // searching with matches: show the matched symbols
  return (
    <SymbolPaletteItems
      items={filteredSymbols}
      handleSelect={handleSelect}
      focusInput={focusInput}
    />
  )
}
SymbolPaletteBody.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.object).isRequired,
  categorisedSymbols: PropTypes.object,
  filteredSymbols: PropTypes.arrayOf(PropTypes.object),
  handleSelect: PropTypes.func.isRequired,
  focusInput: PropTypes.func.isRequired,
}
