import React from 'react'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'

export type RadioOption<T extends string = string> = {
  value: T
  label: string
  description?: string
}

type RadioButtonSettingProps<T extends string = string> = {
  id: string
  options: Array<RadioOption<T>>
  value: T | undefined
  onChange: (value: T) => void
}

export default function RadioButtonSetting<T extends string = string>({
  id,
  options,
  value,
  onChange,
}: RadioButtonSettingProps<T>) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value as T)
  }

  return (
    <div className="ide-radio-setting-options">
      {options.map(option => (
        <OLFormCheckbox
          key={`${id}-${option.value}`}
          type="radio"
          id={`${id}-${option.value}`}
          name={id}
          value={option.value}
          checked={value === option.value}
          onChange={handleChange}
          label={option.label}
          description={option.description}
        />
      ))}
    </div>
  )
}
