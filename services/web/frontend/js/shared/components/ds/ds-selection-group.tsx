import classNames from 'classnames'

export default function DSSelectionGroup({
  legend,
  className,
  children,
}: {
  legend?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className={classNames('selection-group-ds', className)}>
      {legend ? (
        <legend className="selection-group-ds-legend">{legend}</legend>
      ) : null}
      <ul className="selection-group-ds-list">{children}</ul>
    </fieldset>
  )
}
