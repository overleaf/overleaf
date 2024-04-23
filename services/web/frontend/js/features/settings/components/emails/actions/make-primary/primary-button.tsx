import ButtonWrapper, {
  ButtonWrapperProps,
} from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'

function PrimaryButton({
  children,
  disabled,
  isLoading,
  onClick,
}: ButtonWrapperProps) {
  return (
    <ButtonWrapper
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
    </ButtonWrapper>
  )
}

export default PrimaryButton
