import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { matchSorter } from 'match-sorter'
import { useCombobox, UseMultipleSelectionReturnValue } from 'downshift'
import classnames from 'classnames'

import MaterialIcon from '@/shared/components/material-icon'
import { DropdownItem } from '@/shared/components/dropdown/dropdown-menu'
import { Contact } from '../utils/types'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import OLFormFeedback from '@/shared/components/ol/ol-form-feedback'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLTag from '@/shared/components/ol/ol-tag'
import AddCollaboratorsSelect from '@/features/share-project-modal/components/add-collaborators-select'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { isValidEmail } from '@/shared/utils/email'
import { useShareProjectContext } from '@/features/share-project-modal/components/share-project-modal'

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

const INPUT_ERRORS = {
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  INVALID_FORMAT: 'INVALID_FORMAT',
} as const

type InputError = {
  key: `${InputError['email']}:${(typeof INPUT_ERRORS)[keyof typeof INPUT_ERRORS]}`
  email: string
  message: string
}

export default function SelectCollaborators({
  loading,
  options,
  multipleSelectionProps,
  currentMemberEmails,
  readOnly,
  size,
}: {
  loading: boolean
  options: Contact[]
  multipleSelectionProps: UseMultipleSelectionReturnValue<ContactItem>
  currentMemberEmails: string[]
  readOnly?: boolean
  size?: 'lg'
}) {
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')
  const { t } = useTranslation()
  const { setSuccessActionMessage } = useShareProjectContext()
  const {
    getSelectedItemProps,
    getDropdownProps,
    addSelectedItem,
    removeSelectedItem,
    selectedItems,
  } = multipleSelectionProps

  const [inputValue, setInputValue] = useState('')
  const [inviteSent, setInviteSent] = useState(false)
  const [inputErrors, setInputErrors] = useState<InputError[]>([])

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
    // Pinning `selectedItem` to null means every selection is treated as a change
    // by downshift, so re-selecting the same option reliably fires `onStateChange`.
    selectedItem: null,
    defaultHighlightedIndex: 0,
    items: filteredOptions,
    itemToString: item => (item && item.name) || '',
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

        const inputErrorsSetter = (
          inputErrors: InputError[],
          errorType: (typeof INPUT_ERRORS)[keyof typeof INPUT_ERRORS],
          message: InputError['message']
        ) => {
          const key = `${email}:${errorType}` as const
          return [
            ...inputErrors.filter(e => !(e.email === email && e.key === key)),
            {
              key,
              email,
              message,
            },
          ]
        }

        // Validate email format
        if (!isValidEmail(email)) {
          setInputErrors(prev =>
            inputErrorsSetter(
              prev,
              INPUT_ERRORS.INVALID_FORMAT,
              t('email_must_be_a_valid_format')
            )
          )
        }

        // Validate against existing members
        if (currentMemberEmails.includes(email.toLowerCase())) {
          setInputErrors(prev =>
            inputErrorsSetter(
              prev,
              INPUT_ERRORS.ALREADY_MEMBER,
              t('only_add_people_who_dont_yet_have_access')
            )
          )
        }

        if (focus) {
          focusInput()
        }
        return true
      }
    },
    [
      addSelectedItem,
      selectedEmails,
      isValidInput,
      focusInput,
      reset,
      currentMemberEmails,
      t,
    ]
  )

  // close and reset the menu when there are no matching items
  useEffect(() => {
    if (isOpen && filteredOptions.length === 0) {
      reset()
    }
  }, [reset, isOpen, filteredOptions.length])

  useEffect(() => {
    setInputErrors(prev => prev.filter(e => selectedEmails.includes(e.email)))
  }, [selectedEmails])

  useEffect(() => {
    setInviteSent(false)
  }, [selectedItems])

  return (
    <div className="tags-input tags-new">
      {isSharingUpdatesEnabled ? (
        // eslint-disable-next-line jsx-a11y/label-has-for
        <OLFormLabel {...getLabelProps()}>
          {t('enter_emails_separated_by_commas')}
        </OLFormLabel>
      ) : (
        // eslint-disable-next-line jsx-a11y/label-has-for
        <OLFormLabel className="small" {...getLabelProps()}>
          {t('add_email_address')}
          {loading && <OLSpinner size="sm" className="ms-2" />}
        </OLFormLabel>
      )}

      <OLRow
        className={classnames('align-items-start', {
          'g-2': isSharingUpdatesEnabled,
        })}
      >
        <OLCol>
          <div className="host">
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <div
              className={classnames('tags form-control', {
                'form-control-lg': size === 'lg',
                'is-invalid':
                  !isValidInput ||
                  (isSharingUpdatesEnabled && inputErrors.length > 0),
              })}
              onClick={focusInput}
            >
              {selectedItems.map((selectedItem, index) => (
                <SelectedItem
                  key={`selected-item-${index}`}
                  removeSelectedItem={removeSelectedItem}
                  selectedItem={selectedItem}
                  focusInput={focusInput}
                  index={index}
                  getSelectedItemProps={getSelectedItemProps}
                  hasIssue={inputErrors.some(
                    ({ email }) => email === selectedItem.email
                  )}
                />
              ))}

              <input
                data-testid="collaborator-email-input"
                aria-describedby={
                  isSharingUpdatesEnabled
                    ? undefined
                    : 'add-collaborator-help-text'
                }
                {...getInputProps(
                  getDropdownProps({
                    className: classnames('input', {
                      'invalid-tag': !isSharingUpdatesEnabled && !isValidInput,
                      'is-invalid': !isSharingUpdatesEnabled && !isValidInput,
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
                      setInviteSent(false)
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
                        case ' ':
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
        </OLCol>
        {isSharingUpdatesEnabled && (
          <OLCol xs="auto">
            <div className="add-collaborator-controls">
              <AddCollaboratorsSelect
                readOnly={readOnly}
                multipleSelectionProps={multipleSelectionProps}
                currentMemberEmails={currentMemberEmails}
                inputValue={inputValue}
                onInviteSuccess={() => {
                  setInviteSent(true)
                  setSuccessActionMessage(undefined)
                }}
                hasErrors={inputErrors.length > 0}
              />
            </div>
          </OLCol>
        )}
      </OLRow>
      {isSharingUpdatesEnabled && (
        <>
          {inputErrors.length > 0 ? (
            inputErrors.length === 1 ? (
              <OLFormFeedback type="invalid" unfilled className="d-block">
                {inputErrors[0].message}
              </OLFormFeedback>
            ) : (
              <ul className="text-danger m-0 mt-2">
                {inputErrors.map(inputError => (
                  <li key={inputError.key} className="small p-0">
                    {inputError.message}
                  </li>
                ))}
              </ul>
            )
          ) : null}
          {inputErrors.length === 0 && inviteSent && (
            <OLFormFeedback type="valid" unfilled className="d-block">
              {t('invitations_sent')}
            </OLFormFeedback>
          )}
        </>
      )}
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
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')
  return (
    <li {...getItemProps({ item, index })}>
      <DropdownItem
        as="span"
        role={undefined}
        leadingIcon={
          isSharingUpdatesEnabled ? (
            <MaterialIcon type="person" unfilled />
          ) : (
            <MaterialIcon type="person" />
          )
        }
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
  hasIssue,
}: {
  removeSelectedItem: (item: ContactItem) => void
  selectedItem: ContactItem
  focusInput: () => void
  getSelectedItemProps: (any: any) => any
  index: number
  hasIssue?: boolean
}) {
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      removeSelectedItem(selectedItem)
      focusInput()
    },
    [focusInput, removeSelectedItem, selectedItem]
  )

  let prepend: React.ReactNode
  if (isSharingUpdatesEnabled) {
    if (hasIssue) {
      prepend = <MaterialIcon type="error" unfilled className="text-danger" />
    }
  } else {
    prepend = <MaterialIcon type="person" />
  }

  return (
    <OLTag
      prepend={prepend}
      closeBtnProps={{
        onClick: handleClick,
      }}
      translate="no"
      {...getSelectedItemProps({ selectedItem, index })}
    >
      {selectedItem.display}
    </OLTag>
  )
}
