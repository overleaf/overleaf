import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

import { CSSProperties, FC } from 'react'
import { ToastContainer as BS5ToastContainer } from 'react-bootstrap-5'
import { ToastContainer as BS3ToastContainer } from '../bootstrap-3/toast-container'

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
    <BootstrapVersionSwitcher
      bs5={
        <BS5ToastContainer className={className} style={style}>
          {children}
        </BS5ToastContainer>
      }
      bs3={
        <BS3ToastContainer className={className} style={style}>
          {children}
        </BS3ToastContainer>
      }
    />
  )
}
