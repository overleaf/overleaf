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
import { useTranslation } from 'react-i18next'
import { Form } from 'react-bootstrap'
import FormControl from '@/shared/components/form/form-control'
import MaterialIcon from '@/shared/components/material-icon'
import { CaretUp, CaretDown, Check } from '@phosphor-icons/react'
import { DropdownItem } from '@/shared/components/dropdown/dropdown-menu'
import OLSpinner from './ol/ol-spinner'
import DSFormLabel from '@/shared/components/ds/ds-form-label'
import DSFormGroup from '@/shared/components/ds/ds-form-group'
import DSFormControl from '@/shared/components/ds/ds-form-control'

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
  // testId for the input element
  dataTestId?: string
  // CIAM-specific layout
  isCiam?: boolean
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
  dataTestId,
  isCiam,
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
    isItemDisabled: item => itemToDisabled?.(item) || false,
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

  const onKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback(
    event => {
      if ((event.key === 'Enter' || event.key === ' ') && !isOpen) {
        event.preventDefault()
        ;(event.nativeEvent as any).preventDownshiftDefault = true
        openMenu()
      } else if (event.key === 'Escape' && isOpen) {
        event.stopPropagation()
        closeMenu()
      }
    },
    [closeMenu, isOpen, openMenu]
  )

  let value: string | undefined
  if (selectedItem || defaultItem) {
    value = itemToString(selectedItem || defaultItem)
  } else {
    value = defaultText
  }

  const tickIcon = function () {
    return isCiam ? <Check /> : 'check'
  }

  const dropdown = (
    <ul
      {...getMenuProps({ disabled })}
      className={classNames('dropdown-menu', {
        'w-100': !isCiam,
        'ciam-dropdown-menu': isCiam,
        show: isOpen,
      })}
    >
      {isOpen &&
        items?.map((item, index) => {
          // We're using an actual disabled button so we don't need the
          // aria-disabled prop
          const { 'aria-disabled': disabled, ...itemProps } = getItemProps({
            item,
            index,
          })
          return (
            <li role="none" key={itemToKey(item)}>
              <DropdownItem
                as="button"
                type="button"
                className={classNames({
                  'select-highlighted': highlightedIndex === index,
                })}
                active={selectedItem === item}
                trailingIcon={
                  selectedIcon && selectedItem === item ? tickIcon() : undefined
                }
                description={itemToSubtitle ? itemToSubtitle(item) : undefined}
                {...itemProps}
                disabled={disabled}
              >
                {itemToString(item)}
              </DropdownItem>
            </li>
          )
        })}
    </ul>
  )

  if (isCiam) {
    return (
      <div className="select-wrapper" ref={rootRef}>
        <DSFormGroup>
          {label ? (
            <DSFormLabel {...getLabelProps()}>
              {label} {optionalLabel && <span>({t('optional')})</span>}{' '}
              {loading && <OLSpinner size="sm" />}
            </DSFormLabel>
          ) : null}
          <DSFormControl
            data-testid={dataTestId}
            {...getToggleButtonProps({
              disabled,
              onKeyDown,
              className: 'select-trigger',
            })}
            value={value}
            readOnly
            append={isOpen ? <CaretUp /> : <CaretDown />}
          />
          {dropdown}
        </DSFormGroup>
      </div>
    )
  }

  return (
    <div className="select-wrapper" ref={rootRef}>
      {label ? (
        <Form.Label {...getLabelProps()}>
          {label}{' '}
          {optionalLabel && (
            <span className="fw-normal">({t('optional')})</span>
          )}{' '}
          {loading && <OLSpinner size="sm" />}
        </Form.Label>
      ) : null}
      <FormControl
        data-testid={dataTestId}
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
      {dropdown}
    </div>
  )
}
