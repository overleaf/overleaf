import classnames from 'classnames'

function Action({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={classnames('notification-action', className)} {...props} />
  )
}

export default Action
