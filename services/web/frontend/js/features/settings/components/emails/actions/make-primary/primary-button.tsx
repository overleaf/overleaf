import OLButton, { OLButtonProps } from '@/features/ui/components/ol/ol-button'

function PrimaryButton({
  children,
  disabled,
  isLoading,
  onClick,
}: OLButtonProps) {
  return (
    <OLButton
      size="sm"
      disabled={disabled && !isLoading}
      isLoading={isLoading}
      onClick={onClick}
      variant="secondary"
    >
      {children}
    </OLButton>
  )
}

export default PrimaryButton
