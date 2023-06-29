import classnames from 'classnames'

function EntryActions({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={classnames('rp-entry-actions', className)} {...rest} />
}

EntryActions.Button = function EntryActionsButton({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<'button'>) {
  return (
    <button className={classnames('rp-entry-button', className)} {...rest} />
  )
}

export default EntryActions
