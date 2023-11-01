import React from 'react'

type RadioChipProps<ValueType> = {
  checked?: boolean
  disabled?: boolean
  name: string
  onChange: (value: ValueType) => void
  required?: boolean
  label: React.ReactElement | string
  value: ValueType
}

const RadioChip = <T extends string>({
  checked,
  disabled,
  name,
  onChange,
  label,
  required,
  value,
}: RadioChipProps<T>) => {
  const handleChange = () => {
    onChange(value)
  }

  return (
    <label className="radio-chip" data-disabled={disabled ? 'true' : undefined}>
      <input
        checked={checked}
        disabled={disabled}
        name={name}
        onChange={handleChange}
        type="radio"
        required={required}
        value={value}
      />
      {label}
    </label>
  )
}

export default RadioChip
