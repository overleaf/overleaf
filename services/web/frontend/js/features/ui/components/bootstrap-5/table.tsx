import { Table as BS5Table } from 'react-bootstrap-5'
import classnames from 'classnames'

function Table({ responsive, ...rest }: React.ComponentProps<typeof BS5Table>) {
  const content = (
    <div
      className={classnames('table-container', {
        'table-container-bordered': rest.bordered,
      })}
    >
      <BS5Table {...rest} />
    </div>
  )

  if (responsive) {
    return <div className="table-responsive d-flex">{content}</div>
  }

  return content
}

export default Table
