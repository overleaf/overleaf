/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
import {
  useRef,
  useEffect,
  KeyboardEventHandler,
  useCallback,
  ReactNode,
  useState,
} from 'react'
import classNames from 'classnames'
import { useSelect } from 'downshift'
import Icon from './icon'
import { useTranslation } from 'react-i18next'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { Form, Spinner } from 'react-bootstrap-5'
import FormControl from '@/features/ui/components/bootstrap-5/form/form-control'
import MaterialIcon from '@/shared/components/material-icon'
import { DropdownItem } from '@/features/ui/components/bootstrap-5/dropdown-menu'

export type SelectProps<T> = {
  // The items rendered as dropdown options.
  items: T[]
  // Stringifies an item of type T. The resulting string is rendered as a dropdown option.
  itemToString: (item: T | null | undefined) => string
  // Caption for the dropdown.
  label?: ReactNode
  // Attribute used to identify the component inside a Form. This name is used to
  // retrieve FormData when the form is submitted. The value of the FormData entry
  // is the string returned by `itemToString(selectedItem)`.
  name?: string
  // Hint text displayed in the initial render.
  defaultText?: string
  // Initial selected item, displayed in the initial render. When both `defaultText`
  // and `defaultItem` are set the latter is ignored.
  defaultItem?: T | null
  // Stringifies an item. The resulting string is rendered as a subtitle in a dropdown option.
  itemToSubtitle?: (item: T | null | undefined) => string
  // Stringifies an item. The resulting string is rendered as a React `key` for each item.
  itemToKey: (item: T) => string
  // Callback invoked after the selected item is updated.
  onSelectedItemChanged?: (item: T | null | undefined) => void
  // Optionally directly control the selected item.
  selected?: T | null
  // When `true` item selection is disabled.
  disabled?: boolean
  // Determine which items should be disabled
  itemToDisabled?: (item: T | null | undefined) => boolean
  // When `true` displays an "Optional" subtext after the `label` caption.
  optionalLabel?: boolean
  // When `true` displays a spinner next to the `label` caption.
  loading?: boolean
  // Show a checkmark next to the selected item
  selectedIcon?: boolean
}

export const Select = <T,>({
  items,
  itemToString = item => (item === null ? '' : String(item)),
  label,
  name,
  defaultText = 'Items',
  defaultItem,
  itemToSubtitle,
  itemToKey,
  onSelectedItemChanged,
  selected,
  disabled = false,
  itemToDisabled,
  optionalLabel = false,
  loading = false,
  selectedIcon = false,
}: SelectProps<T>) => {
  const [selectedItem, setSelectedItem] = useState<T | undefined | null>(
    defaultItem
  )

  const { t } = useTranslation()
  const {
    isOpen,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    getItemProps,
    highlightedIndex,
    openMenu,
    closeMenu,
  } = useSelect({
    items: items ?? [],
    itemToString,
    selectedItem: selected || defaultItem,
    onSelectedItemChange: changes => {
      if (onSelectedItemChanged) {
        onSelectedItemChanged(changes.selectedItem)
      }
      setSelectedItem(changes.selectedItem)
    },
  })

  useEffect(() => {
    setSelectedItem(selected)
  }, [selected])

  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!name || !rootRef.current) return

    const parentForm: HTMLFormElement | null | undefined =
      rootRef.current?.closest('form')
    if (!parentForm) return

    function handleFormDataEvent(event: FormDataEvent) {
      const data = event.formData
      const key = name as string // can't be undefined due to early exit in the effect
      if (selectedItem || defaultItem) {
        data.append(key, itemToString(selectedItem || defaultItem))
      }
    }

    parentForm.addEventListener('formdata', handleFormDataEvent)
    return () => {
      parentForm.removeEventListener('formdata', handleFormDataEvent)
    }
  }, [name, itemToString, selectedItem, defaultItem])

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation()
      closeMenu()
    }
  }

  const onKeyDown: KeyboardEventHandler<HTMLButtonElement> = useCallback(
    event => {
      if ((event.key === 'Enter' || event.key === ' ') && !isOpen) {
        event.preventDefault()
        ;(event.nativeEvent as any).preventDownshiftDefault = true
        openMenu()
      }
    },
    [isOpen, openMenu]
  )

  let value: string | undefined
  if (selectedItem || defaultItem) {
    value = itemToString(selectedItem || defaultItem)
  } else {
    value = defaultText
  }
  return (
    <BootstrapVersionSwitcher
      bs3={
        <div className="select-wrapper" ref={rootRef}>
          <div>
            {label ? (
              <label {...getLabelProps()}>
                {label}{' '}
                {optionalLabel && (
                  <span className="select-optional-label text-muted">
                    ({t('optional')})
                  </span>
                )}{' '}
                {loading && (
                  <Icon data-testid="spinner" fw type="spinner" spin />
                )}
              </label>
            ) : null}
            <div
              className={classNames({ disabled }, 'select-trigger')}
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              {...getToggleButtonProps({
                disabled,
                onKeyDown,
              })}
            >
              <div>{value}</div>
              <div>
                {isOpen ? (
                  <Icon type="chevron-up" fw />
                ) : (
                  <Icon type="chevron-down" fw />
                )}
              </div>
            </div>
          </div>
          <ul
            className={classNames({ hidden: !isOpen }, 'select-items')}
            {...getMenuProps({ disabled, onKeyDown: handleMenuKeyDown })}
          >
            {isOpen &&
              items?.map((item, index) => {
                const isDisabled = itemToDisabled && itemToDisabled(item)
                return (
                  <li
                    className={classNames({
                      'select-highlighted': highlightedIndex === index,
                      'selected-active': selectedItem === item,
                      'select-icon': selectedIcon,
                      'select-disabled': isDisabled,
                    })}
                    key={itemToKey(item)}
                    {...getItemProps({ item, index, disabled: isDisabled })}
                  >
                    <span className="select-item-title">
                      {selectedIcon && (
                        <div className="select-item-icon">
                          {(selectedItem === item ||
                            (!selectedItem && defaultItem === item)) && (
                            <Icon type="check" fw />
                          )}
                        </div>
                      )}
                      {itemToString(item)}
                    </span>

                    {itemToSubtitle ? (
                      <span className="text-muted select-item-subtitle">
                        {itemToSubtitle(item)}
                      </span>
                    ) : null}
                  </li>
                )
              })}
          </ul>
        </div>
      }
      bs5={
        <div className="select-wrapper" ref={rootRef}>
          {label ? (
            <Form.Label {...getLabelProps()}>
              {label}{' '}
              {optionalLabel && (
                <span className="fw-normal">({t('optional')})</span>
              )}{' '}
              {loading && (
                <span data-testid="spinner">
                  <Spinner
                    animation="border"
                    aria-hidden="true"
                    as="span"
                    role="status"
                    size="sm"
                  />
                </span>
              )}
            </Form.Label>
          ) : null}
          <FormControl
            {...getToggleButtonProps({
              disabled,
              onKeyDown,
              className: 'select-trigger',
            })}
            value={value}
            readOnly
            append={
              <MaterialIcon
                type={isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                className="align-text-bottom"
              />
            }
          />
          <ul
            {...getMenuProps({ disabled, onKeyDown: handleMenuKeyDown })}
            className={classNames('dropdown-menu w-100', { show: isOpen })}
          >
            {isOpen &&
              items?.map((item, index) => {
                const isDisabled = itemToDisabled && itemToDisabled(item)
                return (
                  <li role="none" key={itemToKey(item)}>
                    <DropdownItem
                      as="button"
                      className={classNames({
                        'select-highlighted': highlightedIndex === index,
                      })}
                      active={selectedItem === item}
                      trailingIcon={selectedItem === item ? 'check' : undefined}
                      description={
                        itemToSubtitle ? itemToSubtitle(item) : undefined
                      }
                      {...getItemProps({ item, index, disabled: isDisabled })}
                    >
                      {itemToString(item)}
                    </DropdownItem>
                  </li>
                )
              })}
          </ul>
        </div>
      }
    />
  )
}
