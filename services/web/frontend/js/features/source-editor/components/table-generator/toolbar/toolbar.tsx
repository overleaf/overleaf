import { memo, useMemo } from 'react'
import { useSelectionContext } from '../contexts/selection-context'
import { ToolbarButton } from './toolbar-button'
import { ToolbarButtonMenu } from './toolbar-button-menu'
import { ToolbarDropdown, ToolbarDropdownItem } from './toolbar-dropdown'
import MaterialIcon from '../../../../../shared/components/material-icon'
import {
  BorderTheme,
  insertColumn,
  insertRow,
  mergeCells,
  moveCaption,
  removeCaption,
  removeNodes,
  removeRowOrColumns,
  setAlignment,
  setBorders,
  unmergeCells,
} from './commands'
import { useCodeMirrorViewContext } from '../../codemirror-editor'
import { useTableContext } from '../contexts/table-context'
import { useTabularContext } from '../contexts/tabular-context'
import SplitTestBadge from '../../../../../shared/components/split-test-badge'
import { useTranslation } from 'react-i18next'

export const Toolbar = memo(function Toolbar() {
  const { selection, setSelection } = useSelectionContext()
  const view = useCodeMirrorViewContext()
  const {
    positions,
    rowSeparators,
    cellSeparators,
    tableEnvironment,
    table,
    directTableChild,
  } = useTableContext()
  const { showHelp } = useTabularContext()
  const { t } = useTranslation()

  const borderDropdownLabel = useMemo(() => {
    switch (table.getBorderTheme()) {
      case BorderTheme.FULLY_BORDERED:
        return t('all_borders')
      case BorderTheme.NO_BORDERS:
        return t('no_borders')
      default:
        return t('custom_borders')
    }
  }, [table, t])

  const captionLabel = useMemo(() => {
    if (!tableEnvironment?.caption) {
      return t('no_caption')
    }
    if (tableEnvironment.caption.from < positions.tabular.from) {
      return t('caption_above')
    }
    return t('caption_below')
  }, [tableEnvironment, positions.tabular.from, t])

  if (!selection) {
    return null
  }
  const columnsToInsert = selection.maximumCellWidth(table)
  const rowsToInsert = selection.height()

  return (
    <div className="table-generator-floating-toolbar">
      <div className="table-generator-button-group">
        <ToolbarDropdown
          id="table-generator-caption-dropdown"
          label={captionLabel}
          disabled={!tableEnvironment || !directTableChild}
          disabledTooltip={t(
            'to_insert_or_move_a_caption_make_sure_tabular_is_directly_within_table'
          )}
        >
          <ToolbarDropdownItem
            id="table-generator-caption-none"
            command={() => {
              removeCaption(view, tableEnvironment)
            }}
          >
            {t('no_caption')}
          </ToolbarDropdownItem>
          <ToolbarDropdownItem
            id="table-generator-caption-above"
            command={() => {
              moveCaption(view, positions, 'above', tableEnvironment)
            }}
          >
            {t('caption_above')}
          </ToolbarDropdownItem>
          <ToolbarDropdownItem
            id="table-generator-caption-below"
            command={() => {
              moveCaption(view, positions, 'below', tableEnvironment)
            }}
          >
            {t('caption_below')}
          </ToolbarDropdownItem>
        </ToolbarDropdown>
        <ToolbarDropdown
          id="table-generator-borders-dropdown"
          label={borderDropdownLabel}
        >
          <ToolbarDropdownItem
            id="table-generator-borders-fully-bordered"
            command={() => {
              setBorders(
                view,
                BorderTheme.FULLY_BORDERED,
                positions,
                rowSeparators,
                table
              )
            }}
          >
            <MaterialIcon type="border_all" />
            <span className="table-generator-button-label">
              {t('all_borders')}
            </span>
          </ToolbarDropdownItem>
          <ToolbarDropdownItem
            id="table-generator-borders-no-borders"
            command={() => {
              setBorders(
                view,
                BorderTheme.NO_BORDERS,
                positions,
                rowSeparators,
                table
              )
            }}
          >
            <MaterialIcon type="border_clear" />
            <span className="table-generator-button-label">
              {t('no_borders')}
            </span>
          </ToolbarDropdownItem>
          <div className="table-generator-border-options-coming-soon">
            <div className="info-icon">
              <MaterialIcon type="info" />
            </div>
            {t('more_options_for_border_settings_coming_soon')}
          </div>
        </ToolbarDropdown>
      </div>
      <div className="table-generator-button-group">
        <ToolbarButtonMenu
          label={t('alignment')}
          icon="format_align_left"
          id="table-generator-align-dropdown"
          disabledLabel={t('select_a_column_or_a_merged_cell_to_align')}
          disabled={
            !selection.isColumnSelected(selection.from.cell, table) &&
            !selection.isMergedCellSelected(table)
          }
        >
          <ToolbarButton
            icon="format_align_left"
            id="table-generator-align-left"
            label={t('left')}
            command={() => {
              setAlignment(view, selection, 'left', positions, table)
            }}
          />
          <ToolbarButton
            icon="format_align_center"
            id="table-generator-align-center"
            label={t('center')}
            command={() => {
              setAlignment(view, selection, 'center', positions, table)
            }}
          />
          <ToolbarButton
            icon="format_align_right"
            id="table-generator-align-right"
            label={t('right')}
            command={() => {
              setAlignment(view, selection, 'right', positions, table)
            }}
          />
        </ToolbarButtonMenu>
        <ToolbarButton
          icon="cell_merge"
          id="table-generator-merge-cells"
          label={
            selection.isMergedCellSelected(table)
              ? t('unmerge_cells')
              : t('merge_cells')
          }
          active={selection.isMergedCellSelected(table)}
          disabled={
            !selection.isMergedCellSelected(table) &&
            !selection.isMergeableCells(table)
          }
          disabledLabel={t('select_cells_in_a_single_row_to_merge')}
          command={() => {
            if (selection.isMergedCellSelected(table)) {
              unmergeCells(view, selection, table)
            } else {
              mergeCells(view, selection, table)
            }
          }}
        />
        <ToolbarButton
          icon="delete"
          id="table-generator-remove-column-row"
          label={t('delete_row_or_column')}
          disabledLabel={t('select_a_row_or_a_column_to_delete')}
          disabled={
            (!selection.isAnyRowSelected(table) &&
              !selection.isAnyColumnSelected(table)) ||
            !selection.eq(selection.explode(table))
          }
          command={() =>
            setSelection(
              removeRowOrColumns(
                view,
                selection,
                positions,
                cellSeparators,
                table
              )
            )
          }
        />
        <ToolbarDropdown
          id="table-generator-add-dropdown"
          btnClassName="table-generator-toolbar-button"
          icon="add"
          tooltip={t('insert')}
          disabled={!selection}
        >
          <ToolbarDropdownItem
            id="table-generator-insert-column-left"
            command={() => {
              setSelection(
                insertColumn(view, selection, positions, false, table)
              )
            }}
          >
            <span className="table-generator-button-label">
              {columnsToInsert === 1
                ? t('insert_column_left')
                : t('insert_x_columns_left', { columns: columnsToInsert })}
            </span>
          </ToolbarDropdownItem>
          <ToolbarDropdownItem
            id="table-generator-insert-column-right"
            command={() => {
              setSelection(
                insertColumn(view, selection, positions, true, table)
              )
            }}
          >
            <span className="table-generator-button-label">
              {columnsToInsert === 1
                ? t('insert_column_right')
                : t('insert_x_columns_right', { columns: columnsToInsert })}
            </span>
          </ToolbarDropdownItem>
          <hr />
          <ToolbarDropdownItem
            id="table-generator-insert-row-above"
            command={() => {
              setSelection(
                insertRow(
                  view,
                  selection,
                  positions,
                  false,
                  rowSeparators,
                  table
                )
              )
            }}
          >
            <span className="table-generator-button-label">
              {rowsToInsert === 1
                ? t('insert_row_above')
                : t('insert_x_rows_above', { rows: rowsToInsert })}
            </span>
          </ToolbarDropdownItem>
          <ToolbarDropdownItem
            id="table-generator-insert-row-below"
            command={() => {
              setSelection(
                insertRow(
                  view,
                  selection,
                  positions,
                  true,
                  rowSeparators,
                  table
                )
              )
            }}
          >
            <span className="table-generator-button-label">
              {rowsToInsert === 1
                ? t('insert_row_below')
                : t('insert_x_rows_below', { rows: rowsToInsert })}
            </span>
          </ToolbarDropdownItem>
        </ToolbarDropdown>
      </div>
      <div className="table-generator-button-group">
        <ToolbarButton
          icon="delete_forever"
          id="table-generator-remove-table"
          label={t('delete_table')}
          command={() => {
            removeNodes(view, tableEnvironment?.table ?? positions.tabular)
            view.focus()
          }}
        />
        <ToolbarButton
          icon="help"
          id="table-generator-show-help"
          label={t('help')}
          command={showHelp}
        />
        <div className="toolbar-beta-badge">
          <SplitTestBadge
            displayOnVariants={['enabled']}
            splitTestName="table-generator"
          />
        </div>
      </div>
    </div>
  )
})
