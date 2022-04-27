import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useCombobox } from 'downshift'
import classnames from 'classnames'
import { defaults as countries } from '../../countries-list'
import { CountryCode } from '../../../../../../types/country'

type CountryInputProps = {
  setValue: React.Dispatch<React.SetStateAction<CountryCode | null>>
} & React.InputHTMLAttributes<HTMLInputElement>

const itemToString = (item: typeof countries[number] | null) => item?.name ?? ''

function CountryInput({ setValue }: CountryInputProps) {
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

export default CountryInput
