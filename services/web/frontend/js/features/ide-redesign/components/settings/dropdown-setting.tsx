import OLFormSelect from '@/features/ui/components/ol/ol-form-select'
import { ChangeEventHandler, useCallback } from 'react'
import Setting from './setting'
import classNames from 'classnames'
import { Spinner } from 'react-bootstrap-5'

type PossibleValue = string | number

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
  id: string
  label: string
  description: string
  options: Array<Option<T>>
  onChange: (val: T) => void
  value?: T
  disabled?: boolean
  width?: 'default' | 'wide'
  loading?: boolean
}

export default function DropdownSetting<T extends PossibleValue = string>({
  id,
  label,
  description,
  options,
  onChange,
  value,
  disabled = false,
  width = 'default',
  loading = false,
}: SettingsMenuSelectProps<T>) {
  const handleChange: ChangeEventHandler<HTMLSelectElement> = useCallback(
    event => {
      const selectedValue = event.target.value
      let onChangeValue: PossibleValue = selectedValue
      if (typeof value === 'number') {
        onChangeValue = parseInt(selectedValue, 10)
      }
      onChange(onChangeValue as T)
    },
    [onChange, value]
  )

  return (
    <Setting controlId={id} label={label} description={description}>
      {loading ? (
        <Spinner
          animation="border"
          aria-hidden="true"
          size="sm"
          role="status"
        />
      ) : (
        <OLFormSelect
          id={id}
          className={classNames('ide-dropdown-setting', {
            'ide-dropdown-setting-wide': width === 'wide',
          })}
          size="sm"
          onChange={handleChange}
          value={value?.toString()}
          disabled={disabled}
        >
          {options.map(option => (
            <option
              key={`${id}-${option.value}`}
              value={option.value.toString()}
              aria-hidden={option.ariaHidden}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </OLFormSelect>
      )}
    </Setting>
  )
}
