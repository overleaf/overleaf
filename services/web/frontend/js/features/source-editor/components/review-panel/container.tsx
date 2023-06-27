import Toggler from './toggler'
import Toolbar from './toolbar/toolbar'
import Nav from './nav'
import classnames from 'classnames'

const reviewPanelClasses = ['ol-cm-review-panel']

type ContainerProps = {
  children?: React.ReactNode
  classNames?: Record<string, boolean>
  style?: React.CSSProperties
}

function Container({ children, classNames, ...rest }: ContainerProps) {
  return (
    <div
      className={classnames(...reviewPanelClasses, classNames)}
      {...rest}
      data-testid="review-panel"
    >
      <div className="review-panel-tools">
        <Toolbar />
        <Nav />
      </div>
      <Toggler />
      {children}
    </div>
  )
}

export default Container
