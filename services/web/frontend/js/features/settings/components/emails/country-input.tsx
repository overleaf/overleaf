import { useState, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useCombobox } from 'downshift'
import classnames from 'classnames'
import { defaults as countries } from '../../countries-list'
import { CountryCode } from '../../../../../../types/country'

type CountryInputProps = {
  setValue: React.Dispatch<React.SetStateAction<CountryCode | null>>
  inputRef?: React.ForwardedRef<HTMLInputElement>
} & React.InputHTMLAttributes<HTMLInputElement>

const itemToString = (item: typeof countries[number] | null) => item?.name ?? ''

function Downshift({ setValue, inputRef }: CountryInputProps) {
  const { t } = useTranslation()
  const [inputItems, setInputItems] = useState(() => countries)
  const [inputValue, setInputValue] = useState('')

  const {
    isOpen,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getComboboxProps,
    getItemProps,
    highlightedIndex,
    openMenu,
    selectedItem,
  } = useCombobox({
    inputValue,
    items: inputItems,
    itemToString,
    onSelectedItemChange: ({ selectedItem }) => {
      setValue(selectedItem?.code ?? null)
      setInputValue(selectedItem?.name ?? '')
    },
    onInputValueChange: ({ inputValue = '' }) => {
      setInputItems(
        countries.filter(country =>
          itemToString(country).toLowerCase().includes(inputValue.toLowerCase())
        )
      )
    },
  })

  return (
    <div
      className={classnames(
        'ui-select-container ui-select-bootstrap dropdown',
        {
          open: isOpen && inputItems.length,
        }
      )}
    >
      <div {...getComboboxProps()} className="form-group mb-2 ui-select-toggle">
        {/* eslint-disable-next-line jsx-a11y/label-has-for */}
        <label {...getLabelProps()} className="sr-only">
          {t('country')}
        </label>
        <input
          {...getInputProps({
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              setInputValue(event.target.value)
            },
            onFocus: () => {
              if (!isOpen) {
                openMenu()
              }
            },
            ref: inputRef,
          })}
          className="form-control"
          type="text"
          placeholder={t('country')}
        />
        <i className="caret" />
      </div>
      <ul
        {...getMenuProps()}
        className="ui-select-choices ui-select-choices-content ui-select-dropdown dropdown-menu"
      >
        {inputItems.map((item, index) => (
          <li
            className="ui-select-choices-group"
            key={`${item.name}-${index}`}
            {...getItemProps({ item, index })}
          >
            <div
              className={classnames('ui-select-choices-row', {
                active: selectedItem?.name === item.name,
                'ui-select-choices-row--highlighted':
                  highlightedIndex === index,
              })}
            >
              <span className="ui-select-choices-row-inner">
                <span>{item.name}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const CountryInput = forwardRef<
  HTMLInputElement,
  Omit<CountryInputProps, 'inputRef'>
>((props, ref) => <Downshift {...props} inputRef={ref} />)

CountryInput.displayName = 'CountryInput'

export default CountryInput
