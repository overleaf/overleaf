import classnames from 'classnames'

function Body({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={classnames('notification-body', className)} {...props} />
  )
}

export default Body
