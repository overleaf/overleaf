import { useState, useEffect, forwardRef } from 'react'
import { useCombobox } from 'downshift'
import classnames from 'classnames'
import { escapeRegExp } from 'lodash'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import { DropdownItem } from '@/shared/components/dropdown/dropdown-menu'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import DSFormLabel from '@/shared/components/ds/ds-form-label'
import DSFormControl from '@/shared/components/ds/ds-form-control'
import { Check } from '@phosphor-icons/react'

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
  isCiam?: boolean
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
  isCiam = false,
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
    getItemProps,
    highlightedIndex,
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

  const tickIcon = function () {
    return isCiam ? <Check /> : 'check'
  }

  const shouldOpen = isOpen && inputItems.length > 0

  const dropdown = (
    <ul
      {...getMenuProps()}
      className={classnames('dropdown-menu', 'select-dropdown-menu', {
        show: shouldOpen,
        'ciam-dropdown-menu': isCiam,
      })}
    >
      {showSuggestedText && inputItems.length > 0 && (
        <li>
          <DropdownItem as="span" role={undefined} disabled>
            {itemsTitle}
          </DropdownItem>
        </li>
      )}
      {inputItems.map((item, index) => (
        // eslint-disable-next-line jsx-a11y/role-supports-aria-props
        <li
          key={`${item}${index}`}
          {...getItemProps({ item, index })}
          aria-selected={selectedItem === item}
        >
          <DropdownItem
            as="span"
            role={undefined}
            className={classnames({
              active: selectedItem === item,
              'dropdown-item-highlighted': highlightedIndex === index,
            })}
            trailingIcon={selectedItem === item ? tickIcon() : undefined}
          >
            {highlightMatchedCharacters(item, inputValue)}
          </DropdownItem>
        </li>
      ))}
    </ul>
  )

  if (isCiam) {
    return (
      <div className="dropdown d-block">
        <DSFormLabel
          {...getLabelProps()}
          className={showLabel ? '' : 'visually-hidden'}
        >
          {label}
        </DSFormLabel>
        <DSFormControl
          {...getInputProps({
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              setValue(event.target.value)
            },
            ref: inputRef,
          })}
          placeholder={placeholder}
          disabled={disabled}
        />
        {dropdown}
      </div>
    )
  }

  return (
    <div className={classnames('dropdown', 'd-block')}>
      <div>
        <OLFormLabel
          {...getLabelProps()}
          className={showLabel ? '' : 'visually-hidden'}
        >
          {label}
        </OLFormLabel>
        <OLFormControl
          {...getInputProps({
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              setValue(event.target.value)
            },
            ref: inputRef,
          })}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
      {dropdown}
    </div>
  )
}

const DownshiftInput = forwardRef<
  HTMLInputElement,
  Omit<DownshiftInputProps, 'inputRef'>
>((props, ref) => <Downshift {...props} inputRef={ref} />)

DownshiftInput.displayName = 'DownshiftInput'

export default DownshiftInput
