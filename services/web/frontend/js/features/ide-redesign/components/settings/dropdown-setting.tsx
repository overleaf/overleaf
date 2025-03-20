import OLFormSelect from '@/features/ui/components/ol/ol-form-select'
import { ChangeEventHandler, useCallback } from 'react'
import Setting from './setting'
import classNames from 'classnames'
import { Spinner } from 'react-bootstrap-5'

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
  options: Array<Option<T>>
  onChange: (val: T) => void
  description?: string
  // TODO: We can remove optgroup when the spellcheck setting is
  // split into 2 and no longer uses it.
  optgroup?: Optgroup<T>
  value?: T
  disabled?: boolean
  width?: 'default' | 'wide'
  loading?: boolean
}

export default function DropdownSetting<T extends PossibleValue = string>({
  id,
  label,
  options,
  onChange,
  value,
  optgroup,
  description = undefined,
  disabled = false,
  width = 'default',
  loading = false,
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
        </OLFormSelect>
      )}
    </Setting>
  )
}
