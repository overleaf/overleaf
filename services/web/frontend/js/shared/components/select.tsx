/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
import {
  useRef,
  useEffect,
  KeyboardEventHandler,
  useCallback,
  ReactNode,
} from 'react'
import classNames from 'classnames'
import { useSelect } from 'downshift'
import Icon from './icon'
import { useTranslation } from 'react-i18next'

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
  defaultItem?: T
  // Stringifies an item. The resulting string is rendered as a subtitle in a dropdown option.
  itemToSubtitle?: (item: T | null | undefined) => string
  // Stringifies an item. The resulting string is rendered as a React `key` for each item.
  itemToKey: (item: T) => string
  // Callback invoked after the selected item is updated.
  onSelectedItemChanged?: (item: T | null | undefined) => void
  // When `true` item selection is disabled.
  disabled?: boolean
  // When `true` displays an "Optional" subtext after the `label` caption.
  optionalLabel?: boolean
  // When `true` displays a spinner next to the `label` caption.
  loading?: boolean
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
  disabled = false,
  optionalLabel = false,
  loading = false,
}: SelectProps<T>) => {
  const { t } = useTranslation()
  const {
    isOpen,
    selectedItem,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    getItemProps,
    highlightedIndex,
    openMenu,
  } = useSelect({
    items: items ?? [],
    itemToString,
    onSelectedItemChange: changes => {
      if (onSelectedItemChanged) {
        onSelectedItemChanged(changes.selectedItem)
      }
    },
  })

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

  const onKeyDown: KeyboardEventHandler<HTMLButtonElement> = useCallback(
    event => {
      if (event.key === 'Enter' && !isOpen) {
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
            {loading && <Icon data-testid="spinner" fw type="spinner" spin />}
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
        {...getMenuProps({ disabled })}
      >
        {isOpen &&
          items?.map((item, index) => (
            <li
              className={classNames({
                'select-highlighted': highlightedIndex === index,
                'selected-active': selectedItem === item,
              })}
              key={itemToKey(item)}
              {...getItemProps({ item, index })}
            >
              <span className="select-item-title">{itemToString(item)}</span>
              {itemToSubtitle ? (
                <span className="text-muted select-item-subtitle">
                  {itemToSubtitle(item)}
                </span>
              ) : null}
            </li>
          ))}
      </ul>
    </div>
  )
}
