import classnames from 'classnames'

const reviewPanelClasses = ['ol-cm-review-panel']

type ContainerProps = {
  children?: React.ReactNode
  className?: string
}

function Container({ children, className, ...rest }: ContainerProps) {
  return (
    <div
      className={classnames(...reviewPanelClasses, className)}
      {...rest}
      data-testid="review-panel"
    >
      {children}
    </div>
  )
}

export default Container
