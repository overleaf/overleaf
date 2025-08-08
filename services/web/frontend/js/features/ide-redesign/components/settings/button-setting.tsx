import OLButton from '@/shared/components/ol/ol-button'
import Setting from './setting'

export default function ButtonSetting({
  id,
  label,
  buttonText,
  onClick,
  description,
  disabled,
}: {
  id: string
  label: string
  buttonText: string
  onClick: () => void
  description?: string
  disabled?: boolean
}) {
  return (
    <Setting controlId={id} label={label} description={description}>
      <OLButton
        id={id}
        variant="secondary"
        size="sm"
        onClick={onClick}
        disabled={disabled}
      >
        {buttonText}
      </OLButton>
    </Setting>
  )
}
