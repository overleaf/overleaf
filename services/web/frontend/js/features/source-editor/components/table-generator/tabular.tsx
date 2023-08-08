import { SyntaxNode } from '@lezer/common'
import { FC } from 'react'
import { CellPosition, RowPosition } from './utils'
import { Toolbar } from './toolbar/toolbar'
import { Table } from './table'
import { SelectionContextProvider } from './contexts/selection-context'
import { EditingContextProvider } from './contexts/editing-context'
import { EditorView } from '@codemirror/view'
import { ErrorBoundary } from 'react-error-boundary'
import { Alert, Button } from 'react-bootstrap'
import { EditorSelection } from '@codemirror/state'
import { CodeMirrorViewContextProvider } from '../codemirror-editor'
import { TableProvider } from './contexts/table-context'

export type CellData = {
  // TODO: Add columnSpan
  content: string
}

export type RowData = {
  cells: CellData[]
  borderTop: number
  borderBottom: number
}

export type ColumnDefinition = {
  alignment: 'left' | 'center' | 'right' | 'paragraph'
  borderLeft: number
  borderRight: number
}

export type TableData = {
  rows: RowData[]
  columns: ColumnDefinition[]
}

export type Positions = {
  cells: CellPosition[][]
  columnDeclarations: { from: number; to: number }
  rowPositions: RowPosition[]
}

export const FallbackComponent: FC<{ view: EditorView; node: SyntaxNode }> = ({
  view,
  node,
}) => {
  return (
    <Alert bsStyle="warning" style={{ marginBottom: 0 }}>
      Table rendering error{' '}
      <Button
        onClick={() =>
          view.dispatch({
            selection: EditorSelection.cursor(node.from),
          })
        }
      >
        View code
      </Button>
    </Alert>
  )
}

export const Tabular: FC<{
  tabularNode: SyntaxNode
  view: EditorView
}> = ({ tabularNode, view }) => {
  return (
    <ErrorBoundary
      fallbackRender={() => (
        <FallbackComponent view={view} node={tabularNode} />
      )}
      onError={(error, componentStack) => console.error(error, componentStack)}
    >
      <CodeMirrorViewContextProvider value={view}>
        <TableProvider tabularNode={tabularNode} view={view}>
          <SelectionContextProvider>
            <EditingContextProvider>
              <div className="table-generator">
                <Toolbar />
                <Table />
              </div>
            </EditingContextProvider>
          </SelectionContextProvider>
        </TableProvider>
      </CodeMirrorViewContextProvider>
    </ErrorBoundary>
  )
}
