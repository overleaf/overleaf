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
  removeColumnWidths,
  removeNodes,
  removeRowOrColumns,
  setAlignment,
  setBorders,
  unmergeCells,
} from './commands'
import { useCodeMirrorViewContext } from '../../codemirror-context'
import { useTableContext } from '../contexts/table-context'
import { useTabularContext } from '../contexts/tabular-context'
import { useTranslation } from 'react-i18next'
import { FeedbackBadge } from '@/shared/components/feedback-badge'
import classNames from 'classnames'

type CaptionPosition = 'no_caption' | 'above' | 'below'

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
  const { showHelp, openColumnWidthModal } = useTabularContext()
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

  const captionPosition: CaptionPosition = useMemo(() => {
    if (!tableEnvironment?.caption) {
      return 'no_caption'
    }
    if (tableEnvironment.caption.from < positions.tabular.from) {
      return 'above'
    }
    return 'below'
  }, [tableEnvironment, positions])

  const captionLabel = useMemo(() => {
    switch (captionPosition) {
      case 'no_caption':
        return t('no_caption')
      case 'above':
        return t('caption_above')
      case 'below':
        return t('caption_below')
    }
  }, [t, captionPosition])

  const currentAlignment = useMemo(() => {
    if (!selection) {
      return undefined
    }
    if (selection.isMergedCellSelected(table)) {
      const cell = table.getCell(selection.from.row, selection.from.cell)
      if (cell.multiColumn) {
        // NOTE: Assumes merged columns can only have one internal column
        return cell.multiColumn.columns.specification[0].alignment
      }
    }
    const { minX, maxX } = selection.normalized()
    const alignment = table.columns[minX].alignment
    for (let x = minX + 1; x <= maxX; x++) {
      if (table.columns[x].alignment !== alignment) {
        return undefined
      }
    }
    return alignment
  }, [selection, table])

  const alignmentIcon = useMemo(() => {
    switch (currentAlignment) {
      case 'left':
        return 'format_align_left'
      case 'center':
        return 'format_align_center'
      case 'right':
        return 'format_align_right'
      case 'paragraph':
        return 'format_align_justify'
      default:
        return 'format_align_left'
    }
  }, [currentAlignment])

  const hasCustomSizes = useMemo(
    () => table.columns.some(x => x.size),
    [table.columns]
  )

  if (!selection) {
    return null
  }
  const columnsToInsert = selection.maximumCellWidth(table)
  const rowsToInsert = selection.height()

  const onlyFixedWidthColumnsSelected = selection.isOnlyFixedWidthColumns(table)
  const onlyNonFixedWidthColumnsSelected =
    selection.isOnlyNonFixedWidthColumns(table)

  return (
    <div
      className={classNames('table-generator-floating-toolbar', {
        'table-generator-toolbar-floating-custom-sizes': hasCustomSizes,
      })}
    >
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
            active={captionPosition === 'no_caption'}
          >
            {t('no_caption')}
          </ToolbarDropdownItem>
          <ToolbarDropdownItem
            id="table-generator-caption-above"
            command={() => {
              moveCaption(view, positions, 'above', tableEnvironment)
            }}
            active={captionPosition === 'above'}
          >
            {t('caption_above')}
          </ToolbarDropdownItem>
          <ToolbarDropdownItem
            id="table-generator-caption-below"
            command={() => {
              moveCaption(view, positions, 'below', tableEnvironment)
            }}
            active={captionPosition === 'below'}
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
            active={table.getBorderTheme() === BorderTheme.FULLY_BORDERED}
            icon="border_all"
          >
            {t('all_borders')}
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
            active={table.getBorderTheme() === BorderTheme.NO_BORDERS}
            icon="border_clear"
          >
            {t('no_borders')}
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
          icon={alignmentIcon}
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
            active={currentAlignment === 'left'}
          />
          <ToolbarButton
            icon="format_align_center"
            id="table-generator-align-center"
            label={t('center')}
            command={() => {
              setAlignment(view, selection, 'center', positions, table)
            }}
            active={currentAlignment === 'center'}
          />
          <ToolbarButton
            icon="format_align_right"
            id="table-generator-align-right"
            label={t('right')}
            command={() => {
              setAlignment(view, selection, 'right', positions, table)
            }}
            active={currentAlignment === 'right'}
          />
          {onlyFixedWidthColumnsSelected &&
            !selection.isMergedCellSelected(table) && (
              <ToolbarButton
                icon="format_align_justify"
                id="table-generator-align-justify"
                label={t('justify')}
                command={() => {
                  setAlignment(view, selection, 'paragraph', positions, table)
                }}
                active={currentAlignment === 'paragraph'}
              />
            )}
        </ToolbarButtonMenu>
        <ToolbarDropdown
          id="format_text_wrap"
          btnClassName="table-generator-toolbar-button"
          icon={
            selection.isOnlyParagraphCells(table) ? 'format_text_wrap' : 'width'
          }
          tooltip={t('adjust_column_width')}
          disabled={!selection.isAnyColumnSelected(table)}
          disabledTooltip={t('select_a_column_to_adjust_column_width')}
          showCaret
        >
          <ToolbarDropdownItem
            id="table-generator-unwrap-text"
            icon="width"
            active={onlyNonFixedWidthColumnsSelected}
            command={() =>
              removeColumnWidths(view, selection, positions, table)
            }
            disabled={!selection.isAnyColumnSelected(table)}
          >
            {t('stretch_width_to_text')}
          </ToolbarDropdownItem>
          <ToolbarDropdownItem
            id="table-generator-wrap-text"
            icon="format_text_wrap"
            active={onlyFixedWidthColumnsSelected}
            command={openColumnWidthModal}
            disabled={!selection.isAnyColumnSelected(table)}
          >
            {onlyFixedWidthColumnsSelected
              ? t('fixed_width')
              : t('fixed_width_wrap_text')}
          </ToolbarDropdownItem>
          {onlyFixedWidthColumnsSelected && (
            <>
              <hr />
              <ToolbarDropdownItem
                id="table-generator-resize"
                command={openColumnWidthModal}
              >
                {t('set_column_width')}
              </ToolbarDropdownItem>
            </>
          )}
        </ToolbarDropdown>
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
          <FeedbackBadge
            id="table-generator-feedback"
            url="https://forms.gle/9dHxXPGugxEHgY3L9"
            text={<FeedbackBadgeContent />}
          />
        </div>
      </div>
    </div>
  )
})

const FeedbackBadgeContent = () => (
  <>
    We have a new way to insert and edit tables.
    <br />
    Click to give feedback
  </>
)
