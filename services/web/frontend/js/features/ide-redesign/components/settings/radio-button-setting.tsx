import React from 'react'

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
        <label key={`${id}-${option.value}`} className="ide-radio-option">
          <input
            type="radio"
            id={`${id}-${option.value}`}
            name={id}
            value={option.value}
            checked={value === option.value}
            onChange={handleChange}
            className="ide-radio-input"
          />
          <div className="ide-radio-text">
            <span className="ide-setting-title">{option.label}</span>
            {option.description && (
              <span className="ide-setting-description">
                {option.description}
              </span>
            )}
          </div>
        </label>
      ))}
    </div>
  )
}
