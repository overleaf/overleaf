import classnames from 'classnames'

function BulkActions({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={classnames('rp-entry-bulk-actions', className)} {...rest} />
  )
}

BulkActions.Button = function BulkActionsButton({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      className={classnames('rp-bulk-actions-btn', className)}
      {...rest}
    />
  )
}

export default BulkActions
