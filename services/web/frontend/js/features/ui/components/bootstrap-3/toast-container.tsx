import classNames from 'classnames'
import { FC, HTMLProps } from 'react'

export const ToastContainer: FC<HTMLProps<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={classNames('toast-container', className)} {...props}>
      {children}
    </div>
  )
}
