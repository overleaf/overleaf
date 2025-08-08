import { CSSProperties, FC } from 'react'
import { ToastContainer as BS5ToastContainer } from 'react-bootstrap'

type OLToastContainerProps = {
  style?: CSSProperties
  className?: string
}

export const OLToastContainer: FC<
  React.PropsWithChildren<OLToastContainerProps>
> = ({ children, className, style }) => {
  return (
    <BS5ToastContainer className={className} style={style}>
      {children}
    </BS5ToastContainer>
  )
}
