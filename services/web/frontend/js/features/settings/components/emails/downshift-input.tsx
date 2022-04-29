import { useState, useEffect, forwardRef } from 'react'
import { useCombobox } from 'downshift'
import classnames from 'classnames'

type DownshiftInputProps = {
  items: string[]
  inputValue: string
  label: string
  setValue: React.Dispatch<React.SetStateAction<string>>
  inputRef?: React.ForwardedRef<HTMLInputElement>
} & React.InputHTMLAttributes<HTMLInputElement>

const filterItemsByInputValue = (
  items: DownshiftInputProps['items'],
  inputValue: DownshiftInputProps['inputValue']
) => items.filter(item => item.toLowerCase().includes(inputValue.toLowerCase()))

function Downshift({
  items,
  inputValue,
  placeholder,
  label,
  setValue,
  disabled,
  inputRef,
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

  return (
    <div
      className={classnames(
        'ui-select-container ui-select-bootstrap dropdown',
        {
          open: isOpen && inputItems.length,
        }
      )}
    >
      <div {...getComboboxProps()} className="form-group mb-2">
        {/* eslint-disable-next-line jsx-a11y/label-has-for */}
        <label {...getLabelProps()} className="sr-only">
          {label}
        </label>
        <input
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
          className="form-control"
          type="text"
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
      <ul
        {...getMenuProps()}
        className="ui-select-choices ui-select-choices-content ui-select-dropdown dropdown-menu"
      >
        {inputItems.map((item, index) => (
          <li
            className="ui-select-choices-group"
            key={`${item}${index}`}
            {...getItemProps({ item, index })}
          >
            <div
              className={classnames('ui-select-choices-row', {
                active: selectedItem === item,
                'ui-select-choices-row--highlighted':
                  highlightedIndex === index,
              })}
            >
              <span className="ui-select-choices-row-inner">
                <span>{item}</span>
              </span>
            </div>
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
