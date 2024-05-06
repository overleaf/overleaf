type TrackChangesToggleProps = {
  id: string
  description: string
  disabled: boolean
  handleToggle: () => void
  value: boolean
}

function TrackChangesToggle({
  id,
  description,
  disabled,
  handleToggle,
  value,
}: TrackChangesToggleProps) {
  return (
    <div className="input-switch">
      <input
        id={`input-switch-${id}`}
        disabled={disabled}
        type="checkbox"
        autoComplete="off"
        className="input-switch-hidden-input"
        onChange={handleToggle}
        checked={value}
      />
      <label htmlFor={`input-switch-${id}`} className="input-switch-btn">
        <span className="sr-only">{description}</span>
      </label>
    </div>
  )
}

export default TrackChangesToggle
