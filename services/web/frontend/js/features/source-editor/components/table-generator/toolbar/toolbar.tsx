import { memo } from 'react'
import { useSelectionContext } from '../contexts/selection-context'
import { ToolbarButton } from './toolbar-button'
import { ToolbarButtonMenu } from './toolbar-button-menu'
import { ToolbarDropdown } from './toolbar-dropdown'
import MaterialIcon from '../../../../../shared/components/material-icon'
import {
  BorderTheme,
  insertColumn,
  insertRow,
  moveCaption,
  removeCaption,
  removeNodes,
  removeRowOrColumns,
  setAlignment,
  setBorders,
} from './commands'
import { useCodeMirrorViewContext } from '../../codemirror-editor'
import { useTableContext } from '../contexts/table-context'

export const Toolbar = memo(function Toolbar() {
  const { selection, setSelection } = useSelectionContext()
  const view = useCodeMirrorViewContext()
  const { positions, rowSeparators, cellSeparators, tableEnvironment } =
    useTableContext()
  if (!selection) {
    return null
  }
  return (
    <div className="table-generator-floating-toolbar">
      <ToolbarDropdown
        id="table-generator-caption-dropdown"
        label="Caption below"
        disabled={!tableEnvironment}
      >
        <button
          className="ol-cm-toolbar-menu-item"
          role="menuitem"
          type="button"
          onClick={() => {
            removeCaption(view, tableEnvironment)
          }}
        >
          No caption
        </button>
        <button
          className="ol-cm-toolbar-menu-item"
          role="menuitem"
          type="button"
          onClick={() => {
            moveCaption(view, positions, 'above', tableEnvironment)
          }}
        >
          Caption above
        </button>
        <button
          className="ol-cm-toolbar-menu-item"
          role="menuitem"
          type="button"
          onClick={() => {
            moveCaption(view, positions, 'below', tableEnvironment)
          }}
        >
          Caption below
        </button>
      </ToolbarDropdown>
      <ToolbarDropdown
        id="table-generator-borders-dropdown"
        label="All borders"
      >
        <button
          className="ol-cm-toolbar-menu-item"
          role="menuitem"
          type="button"
          onClick={() => {
            setBorders(
              view,
              BorderTheme.FULLY_BORDERED,
              positions,
              rowSeparators
            )
          }}
        >
          <MaterialIcon type="border_all" />
          <span className="table-generator-button-label">All borders</span>
        </button>
        <button
          className="ol-cm-toolbar-menu-item"
          role="menuitem"
          type="button"
          onClick={() => {
            setBorders(view, BorderTheme.NO_BORDERS, positions, rowSeparators)
          }}
        >
          <MaterialIcon type="border_clear" />
          <span className="table-generator-button-label">No borders</span>
        </button>
        <div className="table-generator-border-options-coming-soon">
          <div className="info-icon">
            <MaterialIcon type="info" />
          </div>
          More options for border settings coming soon.
        </div>
      </ToolbarDropdown>
      <div className="table-generator-button-group">
        <ToolbarButtonMenu
          label="Alignment"
          icon="format_align_left"
          id="table-generator-align-dropdown"
          disabledLabel="Select a column or a merged cell to align"
          disabled={
            !selection.isColumnSelected(
              selection.from.cell,
              positions.rowPositions.length
            )
          }
        >
          <ToolbarButton
            icon="format_align_left"
            id="table-generator-align-left"
            label="Left"
            command={() => {
              setAlignment(view, selection, 'left', positions)
            }}
          />
          <ToolbarButton
            icon="format_align_center"
            id="table-generator-align-center"
            label="Center"
            command={() => {
              setAlignment(view, selection, 'center', positions)
            }}
          />
          <ToolbarButton
            icon="format_align_right"
            id="table-generator-align-right"
            label="Right"
            command={() => {
              setAlignment(view, selection, 'right', positions)
            }}
          />
        </ToolbarButtonMenu>
        <ToolbarButton
          icon="cell_merge"
          id="table-generator-merge-cells"
          label="Merge cells"
          disabled
          disabledLabel="Select cells in a row to merge"
        />
        <ToolbarButton
          icon="delete"
          id="table-generator-remove-column-row"
          label="Delete row or column"
          disabledLabel="Select a row or a column to delete"
          disabled={
            !(
              positions.cells.length &&
              selection.isAnyRowSelected(positions.cells[0].length)
            ) && !selection.isAnyColumnSelected(positions.rowPositions.length)
          }
          command={() =>
            setSelection(
              removeRowOrColumns(view, selection, positions, cellSeparators)
            )
          }
        />
        <ToolbarDropdown
          id="table-generator-add-dropdown"
          btnClassName="table-generator-toolbar-button"
          icon="add"
          tooltip="Insert"
          disabled={!selection}
        >
          <button
            className="ol-cm-toolbar-menu-item"
            role="menuitem"
            type="button"
            onClick={() => {
              setSelection(insertColumn(view, selection, positions, false))
            }}
          >
            <span className="table-generator-button-label">
              Insert column left
            </span>
          </button>
          <button
            className="ol-cm-toolbar-menu-item"
            role="menuitem"
            type="button"
            onClick={() => {
              setSelection(insertColumn(view, selection, positions, true))
            }}
          >
            <span className="table-generator-button-label">
              Insert column right
            </span>
          </button>
          <hr />
          <button
            className="ol-cm-toolbar-menu-item"
            role="menuitem"
            type="button"
            onClick={() => {
              setSelection(insertRow(view, selection, positions, false))
            }}
          >
            <span className="table-generator-button-label">
              Insert row above
            </span>
          </button>
          <button
            className="ol-cm-toolbar-menu-item"
            role="menuitem"
            type="button"
            onClick={() => {
              setSelection(insertRow(view, selection, positions, true))
            }}
          >
            <span className="table-generator-button-label">
              Insert row below
            </span>
          </button>
        </ToolbarDropdown>
      </div>
      <div className="table-generator-button-group">
        <ToolbarButton
          icon="delete_forever"
          id="table-generator-remove-table"
          label="Delete table"
          command={() => {
            removeNodes(view, tableEnvironment?.table ?? positions.tabular)
          }}
        />
      </div>
    </div>
  )
})
