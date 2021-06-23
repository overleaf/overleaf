import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import { FormControl } from 'react-bootstrap'
import useDebounce from '../../../shared/hooks/use-debounce'

export default function SymbolPaletteSearch({ setInput, inputRef }) {
  const [localInput, setLocalInput] = useState('')

  // debounce the search input until a typing delay
  const debouncedLocalInput = useDebounce(localInput, 250)

  useEffect(() => {
    setInput(debouncedLocalInput)
  }, [debouncedLocalInput, setInput])

  const { t } = useTranslation()

  const inputRefCallback = useCallback(
    element => {
      inputRef.current = element
    },
    [inputRef]
  )

  return (
    <FormControl
      className="symbol-palette-search"
      type="search"
      inputRef={inputRefCallback}
      id="symbol-palette-input"
      aria-label="Search"
      value={localInput}
      placeholder={t('search') + '…'}
      onChange={event => {
        setLocalInput(event.target.value)
      }}
    />
  )
}
SymbolPaletteSearch.propTypes = {
  setInput: PropTypes.func.isRequired,
  inputRef: PropTypes.object.isRequired,
}
