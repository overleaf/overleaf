import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { matchSorter } from 'match-sorter'
import { useCombobox, UseMultipleSelectionReturnValue } from 'downshift'
import classnames from 'classnames'

import MaterialIcon from '@/shared/components/material-icon'
import Tag from '@/shared/components/tag'
import { DropdownItem } from '@/shared/components/dropdown/dropdown-menu'
import { Contact } from '../utils/types'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLSpinner from '@/shared/components/ol/ol-spinner'

export type ContactItem = {
  email: string
  display: string
  type: string
}

// Unicode characters in these Unicode groups:
//  "General Punctuation — Spaces"
//  "General Punctuation — Format character" (including zero-width spaces)
const matchAllSpaces =
  /[\u061C\u2000-\u200F\u202A-\u202E\u2060\u2066-\u2069\u2028\u2029\u202F]/g

export default function SelectCollaborators({
  loading,
  options,
  multipleSelectionProps,
}: {
  loading: boolean
  options: Contact[]
  multipleSelectionProps: UseMultipleSelectionReturnValue<ContactItem>
}) {
  const { t } = useTranslation()
  const {
    getSelectedItemProps,
    getDropdownProps,
    addSelectedItem,
    removeSelectedItem,
    selectedItems,
  } = multipleSelectionProps

  const [inputValue, setInputValue] = useState('')

  const selectedEmails = useMemo(
    () => selectedItems.map(item => item.email),
    [selectedItems]
  )

  const unselectedOptions = useMemo(
    () => options.filter(option => !selectedEmails.includes(option.email)),
    [options, selectedEmails]
  )

  const filteredOptions = useMemo(() => {
    if (inputValue === '') {
      return unselectedOptions
    }

    return matchSorter(unselectedOptions, inputValue, {
      keys: ['name', 'email'],
      threshold: matchSorter.rankings.CONTAINS,
      baseSort: (a, b) => {
        // Prefer server-side sorting for ties in the match ranking.
        return a.index - b.index > 0 ? 1 : -1
      },
    })
  }, [unselectedOptions, inputValue])

  const inputRef = useRef<HTMLInputElement>(null)

  const focusInput = useCallback(() => {
    if (inputRef.current) {
      window.setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 10)
    }
  }, [inputRef])

  const isValidInput = useMemo(() => {
    if (inputValue.includes('@')) {
      for (const selectedItem of selectedItems) {
        if (selectedItem.email === inputValue) {
          return false
        }
      }
    }

    return true
  }, [inputValue, selectedItems])

  function stateReducer(_: unknown, actionAndChanges: any) {
    const { type, changes } = actionAndChanges
    // force selected item to be null so that adding, removing, then re-adding the same collaborator is recognised as a selection change
    if (type === useCombobox.stateChangeTypes.InputChange) {
      return { ...changes, selectedItem: null }
    }
    return changes
  }

  const {
    isOpen,
    getLabelProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    reset,
  } = useCombobox({
    inputValue,
    defaultHighlightedIndex: 0,
    items: filteredOptions,
    itemToString: item => (item && item.name) || '',
    stateReducer,
    onStateChange: ({ type, selectedItem }) => {
      switch (type) {
        // add a selected item on Enter (keypress), click or blur
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
        case useCombobox.stateChangeTypes.InputBlur:
          if (selectedItem) {
            setInputValue('')
            addSelectedItem(selectedItem)
          }
          break
      }
    },
  })

  const addNewItem = useCallback(
    (_email: string, focus = true) => {
      const email = _email.replace(matchAllSpaces, '')

      if (
        isValidInput &&
        email.includes('@') &&
        !selectedEmails.includes(email)
      ) {
        addSelectedItem({
          email,
          display: email,
          type: 'user',
        })
        setInputValue('')
        reset()
        if (focus) {
          focusInput()
        }
        return true
      }
    },
    [addSelectedItem, selectedEmails, isValidInput, focusInput, reset]
  )

  // close and reset the menu when there are no matching items
  useEffect(() => {
    if (isOpen && filteredOptions.length === 0) {
      reset()
    }
  }, [reset, isOpen, filteredOptions.length])

  return (
    <div className="tags-input tags-new">
      {/* eslint-disable-next-line jsx-a11y/label-has-for */}
      <OLFormLabel className="small" {...getLabelProps()}>
        {t('add_email_address')}
        {loading && <OLSpinner size="sm" className="ms-2" />}
      </OLFormLabel>

      <div className="host">
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
        <div className="tags form-control" onClick={focusInput}>
          {selectedItems.map((selectedItem, index) => (
            <SelectedItem
              key={`selected-item-${index}`}
              removeSelectedItem={removeSelectedItem}
              selectedItem={selectedItem}
              focusInput={focusInput}
              index={index}
              getSelectedItemProps={getSelectedItemProps}
            />
          ))}

          <input
            data-testid="collaborator-email-input"
            aria-describedby="add-collaborator-help-text"
            {...getInputProps(
              getDropdownProps({
                className: classnames('input', {
                  'invalid-tag': !isValidInput,
                }),
                type: 'email',
                size: inputValue.length ? inputValue.length + 5 : 5,
                ref: inputRef,
                // preventKeyAction: showDropdown,
                onBlur: () => {
                  addNewItem(inputValue, false)
                },
                onChange: e => {
                  setInputValue((e.target as HTMLInputElement).value)
                },
                onClick: () => focusInput,
                onKeyDown: event => {
                  switch (event.key) {
                    case 'Enter':
                      // Enter: always prevent form submission
                      event.preventDefault()
                      event.stopPropagation()
                      break

                    case 'Tab':
                      // Tab: if the dropdown isn't open, try to create a new item using inputValue and prevent blur if successful
                      if (!isOpen && addNewItem(inputValue)) {
                        event.preventDefault()
                        event.stopPropagation()
                      }
                      break

                    case ',':
                      // comma: try to create a new item using inputValue
                      event.preventDefault()
                      addNewItem(inputValue)
                      break
                  }
                },
                onPaste: event => {
                  const data =
                    // modern browsers
                    event.clipboardData?.getData('text/plain') ??
                    // @ts-ignore IE11
                    window.clipboardData?.getData('text')

                  if (data) {
                    const emails = data
                      .split(/[\r\n,; ]+/)
                      .filter(item => item.includes('@'))
                      .map(email => email.replace(matchAllSpaces, ''))

                    if (emails.length) {
                      // pasted comma-separated email addresses
                      event.preventDefault()

                      // dedupe emails in pasted content and previously-entered items
                      const uniqueEmails = [...new Set(emails)].filter(
                        email => !selectedEmails.includes(email)
                      )

                      for (const email of uniqueEmails) {
                        addNewItem(email)
                      }
                    }
                  }
                },
              })
            )}
          />
        </div>

        <div>
          <ul
            {...getMenuProps()}
            className={classnames('dropdown-menu select-dropdown-menu', {
              show: isOpen,
            })}
          >
            {isOpen &&
              filteredOptions.map((item, index) => (
                <Option
                  key={item.email}
                  index={index}
                  item={item}
                  selected={index === highlightedIndex}
                  getItemProps={getItemProps}
                />
              ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Option({
  selected,
  item,
  getItemProps,
  index,
}: {
  selected: boolean
  item: Contact
  getItemProps: (any: any) => any
  index: number
}) {
  return (
    <li {...getItemProps({ item, index })}>
      <DropdownItem
        as="span"
        role={undefined}
        leadingIcon="person"
        className={classnames({
          active: selected,
        })}
      >
        {item.display}
      </DropdownItem>
    </li>
  )
}

function SelectedItem({
  removeSelectedItem,
  selectedItem,
  focusInput,
  getSelectedItemProps,
  index,
}: {
  removeSelectedItem: (item: ContactItem) => void
  selectedItem: ContactItem
  focusInput: () => void
  getSelectedItemProps: (any: any) => any
  index: number
}) {
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      removeSelectedItem(selectedItem)
      focusInput()
    },
    [focusInput, removeSelectedItem, selectedItem]
  )

  return (
    <Tag
      prepend={<MaterialIcon type="person" />}
      closeBtnProps={{
        onClick: handleClick,
      }}
      {...getSelectedItemProps({ selectedItem, index })}
    >
      {selectedItem.display}
    </Tag>
  )
}
