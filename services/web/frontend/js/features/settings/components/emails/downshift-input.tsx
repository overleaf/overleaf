import { useState } from 'react'
import { useCombobox } from 'downshift'
import classnames from 'classnames'

type DownshiftInputProps = {
  items: string[]
  inputValue: string
  setValue: React.Dispatch<React.SetStateAction<string>>
} & React.InputHTMLAttributes<HTMLInputElement>

const filterItemsByInputValue = (
  items: DownshiftInputProps['items'],
  inputValue: DownshiftInputProps['inputValue']
) => items.filter(item => item.toLowerCase().includes(inputValue.toLowerCase()))

function DownshiftInput({
  items,
  inputValue,
  placeholder,
  setValue,
}: DownshiftInputProps) {
  const [inputItems, setInputItems] = useState(items)

  const {
    isOpen,
    getMenuProps,
    getInputProps,
    getComboboxProps,
    getItemProps,
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
          })}
          className="form-control"
          type="text"
          placeholder={placeholder}
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

export default DownshiftInput
