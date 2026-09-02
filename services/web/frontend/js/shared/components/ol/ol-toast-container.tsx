import { CSSProperties, FC } from 'react'
import { ToastContainer } from 'react-bootstrap'

type OLToastContainerProps = {
  style?: CSSProperties
  className?: string
}

export const OLToastContainer: FC<
  React.PropsWithChildren<OLToastContainerProps>
> = ({ children, className, style }) => {
  return (
    <ToastContainer className={className} style={style}>
      {children}
    </ToastContainer>
  )
}
