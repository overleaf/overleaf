import { Tabs } from '@reach/tabs'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import { matchSorter } from 'match-sorter'

import symbols from '../data/symbols.json'
import { buildCategorisedSymbols, createCategories } from '../utils/categories'
import SymbolPaletteSearch from './symbol-palette-search'

import '@reach/tabs/styles.css'
import SymbolPaletteBody from './symbol-palette-body'
import SymbolPaletteTabs from './symbol-palette-tabs'

export default function SymbolPaletteContent({ handleSelect }) {
  const [input, setInput] = useState('')

  const { t } = useTranslation()

  // build the list of categories with translated labels
  const categories = useMemo(() => createCategories(t), [t])

  // group the symbols by category
  const categorisedSymbols = useMemo(
    () => buildCategorisedSymbols(categories),
    [categories]
  )

  // select symbols which match the input
  const filteredSymbols = useMemo(() => {
    if (input === '') {
      return null
    }

    return matchSorter(symbols, input, {
      keys: ['command', 'description'],
      threshold: matchSorter.rankings.CONTAINS,
    })
  }, [input])

  const inputRef = useRef(null)

  // allow the input to be focused
  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // focus the input when the symbol palette is opened
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  return (
    <Tabs className="symbol-palette-container">
      <div className="symbol-palette">
        <div className="symbol-palette-header">
          <SymbolPaletteTabs
            categories={categories}
            disabled={input.length > 0}
          />
          <SymbolPaletteSearch setInput={setInput} inputRef={inputRef} />
        </div>
        <div className="symbol-palette-body">
          <SymbolPaletteBody
            categories={categories}
            categorisedSymbols={categorisedSymbols}
            filteredSymbols={filteredSymbols}
            handleSelect={handleSelect}
            focusInput={focusInput}
          />
        </div>
      </div>
    </Tabs>
  )
}
SymbolPaletteContent.propTypes = {
  handleSelect: PropTypes.func.isRequired,
}
