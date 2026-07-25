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
  expandUp?: boolean
  onClose?: () => void
  isOpen?: boolean
  scrollIntoView?: (
    node: HTMLElement | null,
    menuNode: HTMLElement | null
  ) => void
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
  expandUp = false,
  onClose,
  isOpen: controlledIsOpen,
  scrollIntoView,
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

  const createDisplayItem: OLAutocompleteDisplayItem[] = showCreateOption
    ? [{ type: 'create' as const, inputValue: internalInputValue }]
    : []

  const displayItems: OLAutocompleteDisplayItem[] = [
    ...(expandUp ? [] : createDisplayItem),
    ...inputItems.map(item => ({
      type: 'item' as const,
      value: item.value,
      label: item.label,
    })),
    ...(expandUp ? createDisplayItem : []),
  ]

  const getDisplayIndex = (inputItemIndex: number) =>
    !expandUp && showCreateOption ? inputItemIndex + 1 : inputItemIndex

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
    ...(controlledIsOpen !== undefined && { isOpen: controlledIsOpen }),
    ...(scrollIntoView !== undefined && { scrollIntoView }),
    itemToString: item => {
      if (!item) return ''
      return item.type === 'create' ? item.inputValue : item.label
    },
    stateReducer: (_state, { type, changes }) => {
      if (type === useCombobox.stateChangeTypes.InputChange) {
        const newInputValue = changes.inputValue || ''
        const newAllowCreate =
          typeof allowCreate === 'function'
            ? allowCreate(newInputValue)
            : allowCreate
        const hasExactMatch = items.some(
          item => item.label.toLowerCase() === newInputValue.toLowerCase()
        )
        const hasMatchingItems = items.some(item =>
          item.label.toLowerCase().includes(newInputValue.toLowerCase())
        )
        const newShowCreate = newAllowCreate && newInputValue && !hasExactMatch
        return {
          ...changes,
          highlightedIndex:
            !expandUp && newShowCreate && hasMatchingItems ? 1 : 0,
        }
      }
      return changes
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
    onIsOpenChange: ({ isOpen }) => {
      if (!isOpen) {
        onClose?.()
      }
    },
  })

  const shouldShowDropdown = isOpen && displayItems.length > 0

  const renderCreateOption = (index: number) => (
    <>
      {hasGroupedItems && expandUp && (
        <li role="separator" className="dropdown-divider" />
      )}
      <li
        {...getItemProps({
          item: { type: 'create', inputValue: internalInputValue },
          index,
        })}
      >
        <OLButton
          variant="ghost"
          size="sm"
          className={classnames('w-100', 'justify-content-start', {
            'dropdown-item-highlighted': highlightedIndex === index,
          })}
        >
          <span className="text-muted">{createOptionPrefix} </span>
          <strong>'{internalInputValue}'</strong>
        </OLButton>
      </li>
      {hasGroupedItems && !expandUp && (
        <li role="separator" className="dropdown-divider" />
      )}
    </>
  )

  const handleClear = () => {
    selectItem(null)
    setInternalInputValue('')
    onChange('')
  }

  const renderSearchBar = () => (
    <div className={classnames({ 'mb-3': !expandUp, 'mt-3': expandUp })}>
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
    </div>
  )

  const renderResultsList = () => (
    <>
      <ul
        {...getMenuProps()}
        className={classnames('dropdown-menu', 'select-dropdown-menu', {
          show: shouldShowDropdown,
          'select-dropdown-menu-expand-up': expandUp,
        })}
      >
        {hasGroupedItems ? (
          <>
            {!expandUp && showCreateOption && <>{renderCreateOption(0)}</>}
            {inputItems.map((item, index) => {
              const previousItem = inputItems[index - 1]
              const hasGroupHeader =
                item.group &&
                (!previousItem || previousItem.group !== item.group)
              const displayIndex = getDisplayIndex(index)

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
                      index: displayIndex,
                    })}
                  >
                    <DropdownItem
                      as="span"
                      role={undefined}
                      className={classnames({
                        'dropdown-item-highlighted':
                          highlightedIndex === displayIndex,
                      })}
                    >
                      {item.label}
                    </DropdownItem>
                  </li>
                </Fragment>
              )
            })}
            {expandUp && showCreateOption && (
              <>{renderCreateOption(displayItems.length - 1)}</>
            )}
          </>
        ) : (
          displayItems.map((item, index) => {
            if (item.type === 'create') {
              return (
                <Fragment key={`create-${item.inputValue}-${index}`}>
                  {renderCreateOption(index)}
                </Fragment>
              )
            }

            return (
              <li
                key={`${item.value}${index}`}
                {...getItemProps({ item, index })}
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
            )
          })
        )}
      </ul>
    </>
  )

  return (
    <div className={classnames('dropdown', 'd-block', 'ol-autocomplete')}>
      {expandUp ? (
        <>
          {renderResultsList()}
          {renderSearchBar()}
        </>
      ) : (
        <>
          {renderSearchBar()}
          {renderResultsList()}
        </>
      )}
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
