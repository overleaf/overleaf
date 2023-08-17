import { SyntaxNode } from '@lezer/common'
import { FC, useEffect } from 'react'
import { CellPosition, RowPosition } from './utils'
import { Toolbar } from './toolbar/toolbar'
import { Table } from './table'
import {
  SelectionContextProvider,
  useSelectionContext,
} from './contexts/selection-context'
import {
  EditingContextProvider,
  useEditingContext,
} from './contexts/editing-context'
import { EditorView } from '@codemirror/view'
import { ErrorBoundary } from 'react-error-boundary'
import { Alert, Button } from 'react-bootstrap'
import { EditorSelection } from '@codemirror/state'
import { CodeMirrorViewContextProvider } from '../codemirror-editor'
import { TableProvider } from './contexts/table-context'
import { TabularProvider, useTabularContext } from './contexts/tabular-context'
import Icon from '../../../../shared/components/icon'

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
  content: string
}

export type TableData = {
  rows: RowData[]
  columns: ColumnDefinition[]
}

export type Positions = {
  cells: CellPosition[][]
  columnDeclarations: { from: number; to: number }
  rowPositions: RowPosition[]
  tabular: { from: number; to: number }
}

export const TableRenderingError: FC<{
  view: EditorView
  codePosition?: number
}> = ({ view, codePosition }) => {
  return (
    <Alert className="table-generator-error">
      <span className="table-generator-error-icon">
        <Icon type="exclamation-circle" />
      </span>
      <span className="table-generator-error-message">
        We couldn't render your table
      </span>
      {codePosition !== undefined && (
        <Button
          onClick={() =>
            view.dispatch({
              selection: EditorSelection.cursor(codePosition),
            })
          }
        >
          View code
        </Button>
      )}
    </Alert>
  )
}

export const Tabular: FC<{
  tabularNode: SyntaxNode
  view: EditorView
  tableNode: SyntaxNode | null
}> = ({ tabularNode, view, tableNode }) => {
  return (
    <ErrorBoundary
      fallbackRender={() => (
        <TableRenderingError view={view} codePosition={tabularNode.from} />
      )}
    >
      <CodeMirrorViewContextProvider value={view}>
        <TabularProvider>
          <TableProvider
            tabularNode={tabularNode}
            view={view}
            tableNode={tableNode}
          >
            <SelectionContextProvider>
              <EditingContextProvider>
                <TabularWrapper />
              </EditingContextProvider>
            </SelectionContextProvider>
          </TableProvider>
        </TabularProvider>
      </CodeMirrorViewContextProvider>
    </ErrorBoundary>
  )
}

const TabularWrapper: FC = () => {
  const { setSelection, selection } = useSelectionContext()
  const { commitCellData, cellData } = useEditingContext()
  const { ref } = useTabularContext()
  useEffect(() => {
    const listener: (event: MouseEvent) => void = event => {
      if (!ref.current?.contains(event.target as Node)) {
        if (selection) {
          setSelection(null)
        }
        if (cellData) {
          commitCellData()
        }
      }
    }
    window.addEventListener('mousedown', listener)

    return () => {
      window.removeEventListener('mousedown', listener)
    }
  }, [cellData, commitCellData, selection, setSelection, ref])
  return (
    <div className="table-generator" ref={ref}>
      <Toolbar />
      <Table />
    </div>
  )
}
