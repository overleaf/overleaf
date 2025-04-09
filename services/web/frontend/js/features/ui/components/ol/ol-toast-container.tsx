import { CSSProperties, FC } from 'react'
import { ToastContainer as BS5ToastContainer } from 'react-bootstrap-5'

type OLToastContainerProps = {
  style?: CSSProperties
  className?: string
}

export const OLToastContainer: FC<OLToastContainerProps> = ({
  children,
  className,
  style,
}) => {
  return (
    <BS5ToastContainer className={className} style={style}>
      {children}
    </BS5ToastContainer>
  )
}
