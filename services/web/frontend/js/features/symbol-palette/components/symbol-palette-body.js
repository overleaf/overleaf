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

  // searching with matches: show the matched symbols
  // searching with no matches: show a message
  // note: include empty tab panels so that aria-controls on tabs can still reference the panel ids
  if (filteredSymbols) {
    return (
      <>
        {filteredSymbols.length ? (
          <SymbolPaletteItems
            items={filteredSymbols}
            handleSelect={handleSelect}
            focusInput={focusInput}
          />
        ) : (
          <div className="symbol-palette-empty">{t('no_symbols_found')}</div>
        )}

        <TabPanels>
          {categories.map(category => (
            <TabPanel key={category.id} tabIndex={-1} />
          ))}
        </TabPanels>
      </>
    )
  }

  // not searching: show the symbols grouped by category
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
SymbolPaletteBody.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.object).isRequired,
  categorisedSymbols: PropTypes.object,
  filteredSymbols: PropTypes.arrayOf(PropTypes.object),
  handleSelect: PropTypes.func.isRequired,
  focusInput: PropTypes.func.isRequired,
}
