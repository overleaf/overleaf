import { memo } from 'react'
import { useSelectionContext } from '../contexts/selection-context'
import { ToolbarButton } from './toolbar-button'
import { ToolbarButtonMenu } from './toolbar-button-menu'
import { ToolbarDropdown } from './toolbar-dropdown'
import MaterialIcon from '../../../../../shared/components/material-icon'
import { BorderTheme, setBorders } from './commands'
import { useCodeMirrorViewContext } from '../../codemirror-editor'
import { useTableContext } from '../contexts/table-context'

export const Toolbar = memo(function Toolbar() {
  const { selection } = useSelectionContext()
  const view = useCodeMirrorViewContext()
  const { positions, rowSeparators } = useTableContext()
  if (!selection) {
    return null
  }
  return (
    <div className="table-generator-floating-toolbar">
      <ToolbarDropdown
        id="table-generator-caption-dropdown"
        label="Caption below"
        disabled
      >
        <button
          className="ol-cm-toolbar-menu-item"
          role="menuitem"
          type="button"
        >
          No caption
        </button>
        <button
          className="ol-cm-toolbar-menu-item"
          role="menuitem"
          type="button"
        >
          Caption above
        </button>
        <button
          className="ol-cm-toolbar-menu-item"
          role="menuitem"
          type="button"
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
          disabled
        >
          <ToolbarButton
            icon="format_align_left"
            id="table-generator-align-left"
            label="Left"
          />
          <ToolbarButton
            icon="format_align_center"
            id="table-generator-align-center"
            label="Center"
          />
          <ToolbarButton
            icon="format_align_right"
            id="table-generator-align-right"
            label="Right"
          />
          <ToolbarButton
            icon="format_align_justify"
            id="table-generator-align-justify"
            label="Justify"
          />
        </ToolbarButtonMenu>
        <ToolbarButton
          icon="cell_merge"
          id="table-generator-merge-cells"
          label="Merge cells"
          disabled
        />
        <ToolbarButton
          icon="delete"
          id="table-generator-remove-column-row"
          label="Remove row or column"
          disabled
        />
        <ToolbarDropdown
          id="table-generator-add-dropdown"
          btnClassName="table-generator-toolbar-button"
          icon="add"
          tooltip="Insert"
          disabled
        >
          <button
            className="ol-cm-toolbar-menu-item"
            role="menuitem"
            type="button"
          >
            <span className="table-generator-button-label">
              Insert column left
            </span>
          </button>
          <button
            className="ol-cm-toolbar-menu-item"
            role="menuitem"
            type="button"
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
          >
            <span className="table-generator-button-label">
              Insert row above
            </span>
          </button>
          <button
            className="ol-cm-toolbar-menu-item"
            role="menuitem"
            type="button"
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
          label="Remove table"
          disabled
        />
      </div>
    </div>
  )
})
