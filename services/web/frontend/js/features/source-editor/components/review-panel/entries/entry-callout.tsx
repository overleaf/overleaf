import classnames from 'classnames'

function EntryCallout({ className, ...rest }: React.ComponentProps<'div'>) {
  return <div className={classnames('rp-entry-callout', className)} {...rest} />
}

export default EntryCallout
