import { useCombobox } from 'downshift'
import { forwardRef, useState, useMemo, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import MiniSearch from 'minisearch'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import {
  DropdownHeader,
  DropdownItem,
} from '@/shared/components/dropdown/dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'

const FUZZY_SEARCH_THRESHOLD = 0.5

export type OLAutocompleteItem = {
  value: string
  label: string
  group?: string
}

export type OLAutocompleteProps = {
  items: OLAutocompleteItem[]
  onChange: (value: string) => void
  placeholder?: string
  label: string
  showLabel?: boolean
  allowCreate?: boolean | ((value: string) => boolean)
  disabled?: boolean
  createOptionPrefix?: string
  useFuzzySearch?: boolean
  inputRef?: React.ForwardedRef<HTMLInputElement>
}

type OLAutocompleteDisplayItem =
  | {
      type: 'item'
      value: string
      label: string
    }
  | {
      type: 'create'
      inputValue: string
    }

function OLAutocompleteInternal({
  items,
  onChange,
  placeholder,
  label,
  showLabel = false,
  allowCreate = true,
  disabled = false,
  createOptionPrefix = '+ Create',
  useFuzzySearch = false,
  inputRef,
}: OLAutocompleteProps) {
  const { t } = useTranslation()

  const searchIndex = useMemo(() => {
    if (!useFuzzySearch) return null
    const searchIndex = new MiniSearch({
      fields: ['label'],
      storeFields: ['value', 'label', 'group'],
      idField: 'value',
    })
    searchIndex.addAll(items)
    return searchIndex
  }, [items, useFuzzySearch])

  const [internalInputValue, setInternalInputValue] = useState('')

  const inputItems = useMemo(() => {
    if (!internalInputValue) {
      return items
    }

    if (useFuzzySearch && searchIndex) {
      const results = searchIndex.search(internalInputValue, {
        fuzzy: FUZZY_SEARCH_THRESHOLD,
        prefix: true,
      })
      return results.map(result => ({
        value: result.value,
        label: result.label,
        group: result.group,
      }))
    }

    return items.filter(item =>
      item.label.toLowerCase().includes(internalInputValue.toLowerCase())
    )
  }, [items, internalInputValue, searchIndex, useFuzzySearch])

  const exactMatch = inputItems.some(
    item => item.label.toLowerCase() === internalInputValue.toLowerCase()
  )

  const allowCreateForInput =
    typeof allowCreate === 'function'
      ? allowCreate(internalInputValue)
      : allowCreate

  const showCreateOption =
    allowCreateForInput && internalInputValue && !exactMatch

  const displayItems: OLAutocompleteDisplayItem[] = [
    ...inputItems.map(item => ({
      type: 'item' as const,
      value: item.value,
      label: item.label,
    })),
    ...(showCreateOption
      ? [
          {
            type: 'create' as const,
            inputValue: internalInputValue,
          },
        ]
      : []),
  ]

  const hasGroupedItems = inputItems.some(item => Boolean(item.group))

  const {
    isOpen,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getItemProps,
    highlightedIndex,
    selectItem,
  } = useCombobox<OLAutocompleteDisplayItem>({
    inputValue: internalInputValue,
    items: displayItems,
    defaultHighlightedIndex: 0,
    itemToString: item => {
      if (!item) return ''
      return item.type === 'create' ? item.inputValue : item.label
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) {
        if (selectedItem.type === 'create') {
          onChange(selectedItem.inputValue)
          setInternalInputValue(selectedItem.inputValue)
        } else {
          onChange(selectedItem.value)
          setInternalInputValue(selectedItem.label)
        }
      }
    },
    onInputValueChange: ({ inputValue = '' }) => {
      setInternalInputValue(inputValue)
    },
  })

  const shouldShowDropdown = isOpen && displayItems.length > 0

  const handleClear = () => {
    selectItem(null)
    setInternalInputValue('')
    onChange('')
  }

  return (
    <div className={classnames('dropdown', 'd-block', 'ol-autocomplete')}>
      <OLFormLabel
        {...getLabelProps()}
        className={showLabel ? '' : 'visually-hidden'}
      >
        {label}
      </OLFormLabel>
      <div className="position-relative">
        <OLFormControl
          {...getInputProps({
            ref: inputRef,
          })}
          placeholder={placeholder}
          disabled={disabled}
        />
        {internalInputValue && !disabled && (
          <OLButton
            variant="ghost"
            size="sm"
            className="position-absolute top-50 end-0 translate-middle-y me-1"
            onClick={handleClear}
            aria-label={t('delete')}
          >
            <MaterialIcon type="close" />
          </OLButton>
        )}
      </div>

      <ul
        {...getMenuProps()}
        className={classnames('dropdown-menu', 'select-dropdown-menu', {
          show: shouldShowDropdown,
        })}
      >
        {hasGroupedItems ? (
          <>
            {inputItems.map((item, index) => {
              const previousItem = inputItems[index - 1]
              const hasGroupHeader =
                item.group &&
                (!previousItem || previousItem.group !== item.group)

              return (
                <Fragment key={`${item.value}${index}`}>
                  {hasGroupHeader && index > 0 && (
                    <li role="separator" className="dropdown-divider" />
                  )}
                  {hasGroupHeader && (
                    <li>
                      <DropdownHeader as="span">{item.group}</DropdownHeader>
                    </li>
                  )}
                  <li
                    {...getItemProps({
                      item: {
                        type: 'item',
                        value: item.value,
                        label: item.label,
                      },
                      index,
                    })}
                  >
                    <DropdownItem
                      as="span"
                      role={undefined}
                      className={classnames({
                        'dropdown-item-highlighted': highlightedIndex === index,
                      })}
                    >
                      {item.label}
                    </DropdownItem>
                  </li>
                </Fragment>
              )
            })}
            {showCreateOption && (
              <>
                <li role="separator" className="dropdown-divider" />
                <li
                  {...getItemProps({
                    item: {
                      type: 'create',
                      inputValue: internalInputValue,
                    },
                    index: displayItems.length - 1,
                  })}
                >
                  <DropdownItem
                    as="span"
                    role={undefined}
                    className={classnames({
                      'dropdown-item-highlighted':
                        highlightedIndex === displayItems.length - 1,
                    })}
                  >
                    <span className="text-muted">{createOptionPrefix} </span>
                    <strong>'{internalInputValue}'</strong>
                  </DropdownItem>
                </li>
              </>
            )}
          </>
        ) : (
          displayItems.map((item, index) => {
            const isCreateOption = item.type === 'create'
            const displayValue = isCreateOption ? item.inputValue : item.label

            return (
              <li
                key={
                  item.type === 'create'
                    ? `create-${item.inputValue}-${index}`
                    : `${item.value}${index}`
                }
                {...getItemProps({
                  item,
                  index,
                })}
              >
                <DropdownItem
                  as="span"
                  role={undefined}
                  className={classnames({
                    'dropdown-item-highlighted': highlightedIndex === index,
                  })}
                >
                  {isCreateOption ? (
                    <>
                      <span className="text-muted">{createOptionPrefix} </span>
                      <strong>'{displayValue}'</strong>
                    </>
                  ) : (
                    displayValue
                  )}
                </DropdownItem>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

const OLAutocomplete = forwardRef<HTMLInputElement, OLAutocompleteProps>(
  (props, ref) => {
    return <OLAutocompleteInternal {...props} inputRef={ref} />
  }
)

OLAutocomplete.displayName = 'OLAutocomplete'

export default OLAutocomplete
