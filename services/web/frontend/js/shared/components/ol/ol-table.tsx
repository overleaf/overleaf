import { Table } from 'react-bootstrap'
import classnames from 'classnames'

export function TableContainer({
  responsive,
  bordered,
  striped,
  children,
}: React.ComponentProps<typeof Table>) {
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

type OLTableProps = React.ComponentProps<typeof Table> & {
  container?: boolean
}

function OLTable({
  container = true,
  responsive,
  bordered,
  striped,
  ...rest
}: OLTableProps) {
  return container ? (
    <TableContainer responsive={responsive} bordered={bordered}>
      <Table striped={striped} {...rest} />
    </TableContainer>
  ) : (
    <Table {...rest} />
  )
}

export default OLTable
