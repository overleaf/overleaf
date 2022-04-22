import classNames from 'classnames'

type CellProps = {
  children: React.ReactNode
  className?: string
}

function Cell({ children, className }: CellProps) {
  return (
    <div className={classNames('affiliations-table-cell', className)}>
      {children}
    </div>
  )
}

export default Cell
