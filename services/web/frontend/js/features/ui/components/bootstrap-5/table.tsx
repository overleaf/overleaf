import { Table as BS5Table } from 'react-bootstrap-5'
import classnames from 'classnames'

export function TableContainer({
  responsive,
  bordered,
  striped,
  children,
}: React.ComponentProps<typeof BS5Table>) {
  return (
    <div
      className={classnames('table-container', {
        'table-container-bordered': bordered,
        'table-responsive': responsive,
        'table-striped': striped,
      })}
    >
      {children}
    </div>
  )
}

type TableProps = React.ComponentProps<typeof BS5Table> & {
  container?: boolean
}

function Table({
  container = true,
  responsive,
  bordered,
  striped,
  ...rest
}: TableProps) {
  return container ? (
    <TableContainer responsive={responsive} bordered={bordered}>
      <BS5Table striped={striped} {...rest} />
    </TableContainer>
  ) : (
    <BS5Table {...rest} />
  )
}

export default Table
