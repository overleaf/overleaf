import OLFormSelect from '@/shared/components/ol/ol-form-select'
import { ChangeEventHandler, useCallback } from 'react'
import Setting from './setting'
import classNames from 'classnames'
import OLSpinner from '@/shared/components/ol/ol-spinner'

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
  id: string
  label: string
  options?: Array<Option<T>>
  onChange: (val: T) => void
  description?: string
  optgroups?: Array<Optgroup<T>>
  value?: T
  disabled?: boolean
  width?: 'default' | 'wide'
  loading?: boolean
  translateOptions?: 'yes' | 'no'
}

export default function DropdownSetting<T extends PossibleValue = string>({
  id,
  label,
  options,
  onChange,
  value,
  optgroups,
  description = undefined,
  disabled = false,
  width = 'default',
  loading = false,
  translateOptions,
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
    <Setting controlId={id} label={label} description={description}>
      {loading ? (
        <OLSpinner size="sm" />
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
          translate={translateOptions}
        >
          {options?.map(option => (
            <option
              key={`${id}-${option.value}`}
              value={option.value.toString()}
              aria-hidden={option.ariaHidden}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
          {optgroups?.map(optgroup => (
            <optgroup label={optgroup.label} key={optgroup.label}>
              {optgroup.options.map(option => (
                <option
                  value={option.value.toString()}
                  key={option.value.toString()}
                >
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </OLFormSelect>
      )}
    </Setting>
  )
}
