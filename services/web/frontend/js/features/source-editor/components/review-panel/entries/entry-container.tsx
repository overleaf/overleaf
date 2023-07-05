import classnames from 'classnames'

function EntryContainer({ className, ...rest }: React.ComponentProps<'div'>) {
  return <div className={classnames('rp-entry-wrapper', className)} {...rest} />
}

export default EntryContainer
