import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import SymbolPaletteItems from './symbol-palette-items'

export default function SymbolPaletteBody({
  categories,
  categorisedSymbols,
  filteredSymbols,
  handleSelect,
  focusInput,
  activeCategoryId,
}) {
  const { t } = useTranslation()

  // searching with matches: show the matched symbols
  // searching with no matches: show a message
  // note: include empty tab panels so that aria-controls on tabs can still reference the panel ids
  if (filteredSymbols) {
    return (
      <div className="symbol-palette-panels">
        {filteredSymbols.length ? (
          <SymbolPaletteItems
            items={filteredSymbols}
            handleSelect={handleSelect}
            focusInput={focusInput}
          />
        ) : (
          <div className="symbol-palette-empty">{t('no_symbols_found')}</div>
        )}

        {categories.map(category => (
          <div
            key={category.id}
            role="tabpanel"
            className="symbol-palette-panel"
            id={`symbol-palette-panel-${category.id}`}
            aria-labelledby={`symbol-palette-tab-${category.id}`}
            hidden
          />
        ))}
      </div>
    )
  }

  // not searching: show the symbols grouped by category
  return (
    <div className="symbol-palette-panels">
      {categories.map((category) => (
        <div
          key={category.id}
          id={`symbol-palette-panel-${category.id}`}
          className="symbol-palette-panel"
          role="tabpanel"
          aria-labelledby={`symbol-palette-tab-${category.id}`}
          hidden={category.id !== activeCategoryId}
        >
          <SymbolPaletteItems
            items={categorisedSymbols[category.id]}
            handleSelect={handleSelect}
            focusInput={focusInput}
          />
        </div>
      ))}
    </div>
  )


}
SymbolPaletteBody.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.object).isRequired,
  categorisedSymbols: PropTypes.object,
  filteredSymbols: PropTypes.arrayOf(PropTypes.object),
  handleSelect: PropTypes.func.isRequired,
  focusInput: PropTypes.func.isRequired,
  activeCategoryId: PropTypes.string.isRequired,
}
