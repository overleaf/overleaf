export type Option = {
  value: string
  label: string
  ariaHidden?: 'true' | 'false'
  disabled?: boolean
}

export type Optgroup = {
  label: string
  options: Array<Option>
}

type SettingsMenuSelectProps = {
  label: string
  name: string
  options: Array<Option>
  optgroup?: Optgroup
  loading?: boolean
}

export default function SettingsMenuSelect({
  label,
  name,
  options,
  optgroup,
  loading,
}: SettingsMenuSelectProps) {
  return (
    <div className="form-group left-menu-setting">
      <label htmlFor={name}>{label}</label>
      {loading ? (
        <p className="loading pull-right">
          <i className="fa fa-fw fa-spin fa-refresh" />
        </p>
      ) : (
        <select name={name} className="form-control">
          {options.map(option => (
            <option
              key={`${name}-${option.value}`}
              value={option.value}
              aria-hidden={option.ariaHidden}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
          {optgroup ? (
            <optgroup label={optgroup.label}>
              {optgroup.options.map(option => (
                <option value={option.value} key={option.value}>
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
