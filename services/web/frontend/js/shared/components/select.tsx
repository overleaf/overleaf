/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
import classNames from 'classnames'
import { useSelect } from 'downshift'
import Icon from './icon'
import { useTranslation } from 'react-i18next'

type SelectProps<T> = {
  items: T[]
  itemToString: (item: T | null) => string
  label?: string
  defaultText?: string
  itemToSubtitle?: (item: T | null) => string
  itemToKey: (item: T) => string
  onSelectedItemChanged?: (item: T | null | undefined) => void
  disabled?: boolean
  optionalLabel?: boolean
  loading?: boolean
}

export const Select = <T,>({
  items,
  itemToString = item => (item === null ? '' : String(item)),
  label,
  defaultText = 'Items',
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
  } = useSelect({
    items: items ?? [],
    itemToString,
    onSelectedItemChange: changes => {
      if (onSelectedItemChanged) {
        onSelectedItemChanged(changes.selectedItem)
      }
    },
  })
  return (
    <div className="select-wrapper">
      <div>
        {label ? (
          <label {...getLabelProps()}>
            {label}{' '}
            {optionalLabel && (
              <span className="select-optional-label text-muted">
                ({t('optional')})
              </span>
            )}{' '}
            {loading && <Icon fw type="spinner" spin />}
          </label>
        ) : null}
        <div
          className={classNames({ disabled }, 'select-trigger')}
          {...getToggleButtonProps({ disabled })}
        >
          <div>{selectedItem ? itemToString(selectedItem) : defaultText}</div>
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
