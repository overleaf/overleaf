import { ChangeEventHandler, useCallback } from 'react'

type PossibleValue = string | number | boolean

export type Option<T extends PossibleValue = string> = {
  value: T
  label: string
  ariaHidden?: 'true' | 'false'
  disabled?: boolean
}

export type Optgroup<T extends PossibleValue = string> = {
  label: string
  options: Array<Option<T>>
}

type SettingsMenuSelectProps<T extends PossibleValue = string> = {
  label: string
  name: string
  options: Array<Option<T>>
  optgroup?: Optgroup<T>
  loading?: boolean
  onChange: (val: T) => void
  value?: T
  disabled?: boolean
}

export default function SettingsMenuSelect<T extends PossibleValue = string>({
  label,
  name,
  options,
  optgroup,
  loading,
  onChange,
  value,
  disabled = false,
}: SettingsMenuSelectProps<T>) {
  const handleChange: ChangeEventHandler<HTMLSelectElement> = useCallback(
    event => {
      const selectedValue = event.target.value
      let onChangeValue: PossibleValue = selectedValue
      if (typeof value === 'boolean') {
        onChangeValue = selectedValue === 'true'
      } else if (typeof value === 'number') {
        onChangeValue = parseInt(selectedValue, 10)
      }
      onChange(onChangeValue as T)
    },
    [onChange, value]
  )

  return (
    <div className="form-group left-menu-setting">
      <label htmlFor={`settings-menu-${name}`}>{label}</label>
      {loading ? (
        <p className="loading pull-right">
          <i className="fa fa-fw fa-spin fa-refresh" />
        </p>
      ) : (
        <select
          id={`settings-menu-${name}`}
          className="form-control"
          onChange={handleChange}
          value={value?.toString()}
          disabled={disabled}
        >
          {options.map(option => (
            <option
              key={`${name}-${option.value}`}
              value={option.value.toString()}
              aria-hidden={option.ariaHidden}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
          {optgroup ? (
            <optgroup label={optgroup.label}>
              {optgroup.options.map(option => (
                <option
                  value={option.value.toString()}
                  key={option.value.toString()}
                >
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      )}
    </div>
  )
}
