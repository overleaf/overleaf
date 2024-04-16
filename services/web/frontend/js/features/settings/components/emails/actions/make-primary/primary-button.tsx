import ButtonWrapper, {
  ButtonWrapperProps,
} from '@/features/ui/components/bootstrap-5/wrappers/button-wrapper'
import { bsVersion } from '@/features/utils/bootstrap-5'

function PrimaryButton({ children, disabled, onClick }: ButtonWrapperProps) {
  return (
    <ButtonWrapper
      size="small"
      disabled={disabled}
      onClick={onClick}
      variant="secondary"
      bs3Props={{ bsStyle: null }}
      className={bsVersion({
        bs3: 'btn-secondary btn-secondary-info',
      })}
    >
      {children}
    </ButtonWrapper>
  )
}

export default PrimaryButton
