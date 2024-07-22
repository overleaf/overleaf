import { useState, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useCombobox } from 'downshift'
import classnames from 'classnames'
import countries, { CountryCode } from '../../../data/countries-list'
import { bsVersion } from '@/features/utils/bootstrap-5'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'
import { DropdownItem } from '@/features/ui/components/bootstrap-5/dropdown-menu'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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

  const shouldOpen = isOpen && inputItems.length

  return (
    <div
      className={classnames(
        'dropdown',
        bsVersion({
          bs5: 'd-block',
          bs3: classnames('ui-select-container ui-select-bootstrap', {
            open: shouldOpen,
          }),
        })
      )}
    >
      <div
        {...getComboboxProps()}
        className={bsVersion({ bs3: 'ui-select-toggle' })}
      >
        {/* eslint-disable-next-line jsx-a11y/label-has-for */}
        <label
          {...getLabelProps()}
          className={bsVersion({ bs5: 'visually-hidden', bs3: 'sr-only' })}
        >
          {t('country')}
        </label>
        <OLFormControl
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
          placeholder={t('country')}
        />
        <i className="caret" />
      </div>
      <ul
        {...getMenuProps()}
        className={classnames(
          'dropdown-menu',
          bsVersion({
            bs5: classnames('select-dropdown-menu', { show: shouldOpen }),
            bs3: 'ui-select-choices ui-select-choices-content ui-select-dropdown',
          })
        )}
      >
        {inputItems.map((item, index) => (
          // eslint-disable-next-line jsx-a11y/role-supports-aria-props
          <li
            className={bsVersion({ bs3: 'ui-select-choices-group' })}
            key={`${item.name}-${index}`}
            {...getItemProps({ item, index })}
            aria-selected={selectedItem?.name === item.name}
          >
            <BootstrapVersionSwitcher
              bs3={
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
              }
              bs5={
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
              }
            />
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
