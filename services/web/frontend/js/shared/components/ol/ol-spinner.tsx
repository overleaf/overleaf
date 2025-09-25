import { Spinner } from 'react-bootstrap'

export type OLSpinnerSize = 'sm' | 'lg'

function OLSpinner({
  size = 'sm',
  className,
}: {
  size?: OLSpinnerSize
  className?: string
}) {
  return (
    <Spinner
      size={size === 'sm' ? 'sm' : undefined}
      animation="border"
      aria-hidden="true"
      className={className}
      data-testid="ol-spinner"
    />
  )
}

export default OLSpinner
