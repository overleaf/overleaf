import classnames from 'classnames'

function EntryContainer({
  id,
  className,
  ...rest
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={classnames('rp-entry-wrapper', className)}
      data-entry-id={id}
      {...rest}
    />
  )
}

export default EntryContainer
