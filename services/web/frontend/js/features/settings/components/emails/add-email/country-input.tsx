import { useState, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useCombobox } from 'downshift'
import classnames from 'classnames'
import countries, { CountryCode } from '../../../data/countries-list'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import { DropdownItem } from '@/shared/components/dropdown/dropdown-menu'

type CountryInputProps = {
  setValue: React.Dispatch<React.SetStateAction<CountryCode | null>>
  inputRef?: React.ForwardedRef<HTMLInputElement>
} & React.InputHTMLAttributes<HTMLInputElement>

const itemToString = (item: (typeof countries)[number] | null) =>
  item?.name ?? ''

function Downshift({ setValue, inputRef }: CountryInputProps) {
  const { t } = useTranslation()
  const [inputItems, setInputItems] = useState(() => [...countries])
  const [inputValue, setInputValue] = useState('')

  const {
    isOpen,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getItemProps,
    highlightedIndex,
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

  const shouldOpen = isOpen && inputItems.length

  return (
    <div className={classnames('dropdown', 'd-block')}>
      <div>
        {/* eslint-disable-next-line jsx-a11y/label-has-for */}
        <label {...getLabelProps()}>{t('country')}</label>
        <OLFormControl
          {...getInputProps({
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              setInputValue(event.target.value)
            },
            ref: inputRef,
          })}
          append={<i className="caret" aria-hidden />}
        />
      </div>
      <ul
        {...getMenuProps()}
        className={classnames('dropdown-menu', 'select-dropdown-menu', {
          show: shouldOpen,
        })}
      >
        {inputItems.map((item, index) => (
          // eslint-disable-next-line jsx-a11y/role-supports-aria-props
          <li
            key={`${item.name}-${index}`}
            {...getItemProps({ item, index })}
            aria-selected={selectedItem?.name === item.name}
          >
            <DropdownItem
              as="span"
              role={undefined}
              className={classnames({
                active: selectedItem?.name === item.name,
                'dropdown-item-highlighted': highlightedIndex === index,
              })}
              trailingIcon={
                selectedItem?.name === item.name ? 'check' : undefined
              }
            >
              {item.name}
            </DropdownItem>
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
