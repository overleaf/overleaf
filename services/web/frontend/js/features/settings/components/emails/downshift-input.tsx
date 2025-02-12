import { useState, useEffect, forwardRef } from 'react'
import { useCombobox } from 'downshift'
import classnames from 'classnames'
import { escapeRegExp } from 'lodash'
import { bsVersion } from '@/features/utils/bootstrap-5'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'
import { DropdownItem } from '@/features/ui/components/bootstrap-5/dropdown-menu'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import OLFormLabel from '@/features/ui/components/ol/ol-form-label'

type DownshiftInputProps = {
  highlightMatches?: boolean
  items: string[]
  itemsTitle?: string
  inputValue: string
  label: string
  setValue: (value: string) => void
  inputRef?: React.ForwardedRef<HTMLInputElement>
  showLabel?: boolean
  showSuggestedText?: boolean
} & React.InputHTMLAttributes<HTMLInputElement>

const filterItemsByInputValue = (
  items: DownshiftInputProps['items'],
  inputValue: DownshiftInputProps['inputValue']
) => items.filter(item => item.toLowerCase().includes(inputValue.toLowerCase()))

function Downshift({
  highlightMatches = false,
  items,
  itemsTitle,
  inputValue,
  placeholder,
  label,
  setValue,
  disabled,
  inputRef,
  showLabel = false,
  showSuggestedText = false,
}: DownshiftInputProps) {
  const [inputItems, setInputItems] = useState(items)

  useEffect(() => {
    setInputItems(items)
  }, [items])

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
    initialSelectedItem: inputValue,
    onSelectedItemChange: ({ selectedItem }) => {
      setValue(selectedItem ?? '')
    },
    onInputValueChange: ({ inputValue = '' }) => {
      setInputItems(filterItemsByInputValue(items, inputValue))
    },
    onStateChange: ({ type }) => {
      if (type === useCombobox.stateChangeTypes.FunctionOpenMenu) {
        setInputItems(filterItemsByInputValue(items, inputValue))
      }
    },
  })

  const highlightMatchedCharacters = (item: string, query: string) => {
    if (!query || !highlightMatches) return item
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
    const parts = item.split(regex)
    return parts.map((part, index) =>
      regex.test(part) ? <strong key={`${part}-${index}`}>{part}</strong> : part
    )
  }

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
      <div {...getComboboxProps()}>
        {/* eslint-disable-next-line jsx-a11y/label-has-for */}
        <OLFormLabel
          {...getLabelProps()}
          className={
            showLabel
              ? ''
              : bsVersion({ bs5: 'visually-hidden', bs3: 'sr-only' })
          }
        >
          {label}
        </OLFormLabel>
        <OLFormControl
          {...getInputProps({
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              setValue(event.target.value)
            },
            onFocus: () => {
              if (!isOpen) {
                openMenu()
              }
            },
            ref: inputRef,
          })}
          placeholder={placeholder}
          disabled={disabled}
        />
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
        {showSuggestedText && inputItems.length && (
          <BootstrapVersionSwitcher
            bs3={<li className="ui-select-title">{itemsTitle}</li>}
            bs5={
              <li>
                <DropdownItem as="span" role={undefined} disabled>
                  {itemsTitle}
                </DropdownItem>
              </li>
            }
          />
        )}
        {inputItems.map((item, index) => (
          // eslint-disable-next-line jsx-a11y/role-supports-aria-props
          <li
            className={bsVersion({ bs3: 'ui-select-choices-group' })}
            key={`${item}${index}`}
            {...getItemProps({ item, index })}
            aria-selected={selectedItem === item}
          >
            <BootstrapVersionSwitcher
              bs3={
                <div
                  className={classnames('ui-select-choices-row', {
                    active: selectedItem === item,
                    'ui-select-choices-row--highlighted':
                      highlightedIndex === index,
                  })}
                >
                  <span className="ui-select-choices-row-inner">
                    <span>{highlightMatchedCharacters(item, inputValue)}</span>
                  </span>
                </div>
              }
              bs5={
                <DropdownItem
                  as="span"
                  role={undefined}
                  className={classnames({
                    active: selectedItem === item,
                    'dropdown-item-highlighted': highlightedIndex === index,
                  })}
                  trailingIcon={selectedItem === item ? 'check' : undefined}
                >
                  {highlightMatchedCharacters(item, inputValue)}
                </DropdownItem>
              }
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

const DownshiftInput = forwardRef<
  HTMLInputElement,
  Omit<DownshiftInputProps, 'inputRef'>
>((props, ref) => <Downshift {...props} inputRef={ref} />)

DownshiftInput.displayName = 'DownshiftInput'

export default DownshiftInput
