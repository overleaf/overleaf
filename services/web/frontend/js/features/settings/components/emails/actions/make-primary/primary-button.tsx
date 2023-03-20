import { Button } from 'react-bootstrap'

function PrimaryButton({ children, disabled, onClick }: Button.ButtonProps) {
  return (
    <Button
      bsSize="small"
      bsStyle={null}
      className="btn-secondary-info btn-secondary"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export default PrimaryButton
