import classnames from 'classnames'

type ContainerProps = {
  children?: React.ReactNode
  className?: string
}

function Container({ children, className, ...rest }: ContainerProps) {
  return (
    <div
      className={classnames('review-panel', className)}
      {...rest}
      data-testid="review-panel"
    >
      {children}
    </div>
  )
}

export default Container
