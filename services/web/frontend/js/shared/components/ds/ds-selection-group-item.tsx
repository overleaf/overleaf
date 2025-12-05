import React from 'react'

type DSSelectionGroupItemProps<ValueType> = {
  checked?: boolean
  disabled?: boolean
  onChange?: (value: ValueType) => void
  required?: boolean
  children: React.ReactNode
} & (
  | {
      type: 'radio'
      name: string
      value: ValueType
    }
  | {
      type: 'checkbox'
      name?: string
      value?: ValueType
    }
)

export default function DSSelectionGroupItem(
  props: DSSelectionGroupItemProps<any>
) {
  const handleChange = () => {
    props.onChange?.(props.value)
  }

  return (
    <li className="selection-group-ds-item">
      <label>
        <input
          type={props.type}
          className="check-input-ds"
          name={props.name}
          value={props.value}
          checked={props.checked}
          disabled={props.disabled}
          required={props.required}
          onChange={handleChange}
        />
        {props.children}
      </label>
    </li>
  )
}
