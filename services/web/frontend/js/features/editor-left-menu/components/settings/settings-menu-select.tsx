import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormSelect from '@/shared/components/ol/ol-form-select'
import { ChangeEventHandler, useCallback, useEffect, useRef } from 'react'
import { useEditorLeftMenuContext } from '@/features/editor-left-menu/components/editor-left-menu-context'
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
  label: string
  name: string
  options?: Array<Option<T>>
  optgroups?: Array<Optgroup<T>>
  loading?: boolean
  onChange: (val: T) => void
  value?: T
  disabled?: boolean
  translateOptions?: 'yes' | 'no'
}

export default function SettingsMenuSelect<T extends PossibleValue = string>({
  label,
  name,
  options,
  optgroups,
  loading,
  onChange,
  value,
  disabled = false,
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

  const { settingToFocus } = useEditorLeftMenuContext()

  const selectRef = useRef<HTMLSelectElement | null>(null)

  useEffect(() => {
    if (settingToFocus === name && selectRef.current) {
      selectRef.current.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
      selectRef.current.focus()
    }

    // clear the focus setting
    window.dispatchEvent(
      new CustomEvent('ui.focus-setting', { detail: undefined })
    )
  }, [name, settingToFocus])

  return (
    <OLFormGroup
      controlId={`settings-menu-${name}`}
      className="left-menu-setting"
    >
      <OLFormLabel>{label}</OLFormLabel>
      {loading ? (
        <OLSpinner size="sm" />
      ) : (
        <OLFormSelect
          size="sm"
          onChange={handleChange}
          value={value?.toString()}
          disabled={disabled}
          ref={selectRef}
          translate={translateOptions}
        >
          {options?.map(option => (
            <option
              key={`${name}-${option.value}`}
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
    </OLFormGroup>
  )
}
