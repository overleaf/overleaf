import OLFormSwitch from '@/features/ui/components/ol/ol-form-switch'

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
    <OLFormSwitch
      id={`input-switch-${id}`}
      disabled={disabled}
      onChange={handleToggle}
      checked={value}
      label={description}
    />
  )
}

export default TrackChangesToggle
