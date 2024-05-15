import OLButton, { OLButtonProps } from '@/features/ui/components/ol/ol-button'

function PrimaryButton({
  children,
  disabled,
  isLoading,
  onClick,
}: OLButtonProps) {
  return (
    <OLButton
      size="small"
      disabled={disabled && !isLoading}
      isLoading={isLoading}
      onClick={onClick}
      variant="secondary"
      bs3Props={{
        bsStyle: null,
        className: 'btn-secondary btn-secondary-info',
      }}
    >
      {children}
    </OLButton>
  )
}

export default PrimaryButton
