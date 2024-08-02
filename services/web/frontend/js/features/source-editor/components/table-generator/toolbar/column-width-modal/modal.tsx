import AccessibleModal from '@/shared/components/accessible-modal'
import { Button, Modal, Form, FormGroup } from 'react-bootstrap'
import { useTabularContext } from '../../contexts/tabular-context'
import { Select } from '@/shared/components/select'
import { Trans, useTranslation } from 'react-i18next'
import {
  FormEventHandler,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSelectionContext } from '../../contexts/selection-context'
import { useTableContext } from '../../contexts/table-context'
import { setColumnWidth } from '../commands'
import { UNITS, WidthSelection, WidthUnit } from './column-width'
import { useCodeMirrorViewContext } from '../../../codemirror-editor'
import { CopyToClipboard } from '@/shared/components/copy-to-clipboard'
import Tooltip from '@/shared/components/tooltip'
import Icon from '@/shared/components/icon'

type UnitDescription = { label: string; tooltip?: string } | undefined

export const ColumnWidthModal = memo(function ColumnWidthModal() {
  const { columnWidthModalShown } = useTabularContext()
  if (!columnWidthModalShown) {
    return null
  }
  return <ColumnWidthModalBody />
})

const ColumnWidthModalBody = () => {
  const { columnWidthModalShown, closeColumnWidthModal } = useTabularContext()
  const view = useCodeMirrorViewContext()
  const { selection } = useSelectionContext()
  const { positions, table } = useTableContext()
  const { t } = useTranslation()
  const [currentUnit, setCurrentUnit] = useState<WidthUnit | undefined | null>(
    '%'
  )
  const [currentWidth, setCurrentWidth] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  const unitHelp: UnitDescription = useMemo(() => {
    switch (currentUnit) {
      case '%':
        return {
          label: t('percent_is_the_percentage_of_the_line_width'),
          tooltip: t(
            'line_width_is_the_width_of_the_line_in_the_current_environment'
          ),
        }
      case 'custom':
        return {
          label: t('enter_any_size_including_units_or_valid_latex_command'),
        }
      default:
        return undefined
    }
  }, [currentUnit, t])

  useEffect(() => {
    if (columnWidthModalShown) {
      inputRef.current?.focus()
      if (
        !selection ||
        selection.width() !== 1 ||
        !table.columns[selection.to.cell].isParagraphColumn ||
        !table.columns[selection.to.cell].size
      ) {
        setCurrentUnit('%')
        setCurrentWidth('')
        return
      }
      const { to } = selection
      const columnIndexToReadWidthAndUnit = to.cell
      const column = table.columns[columnIndexToReadWidthAndUnit]
      const size = column.size!
      if (size.unit === '%') {
        setCurrentUnit('%')
        const widthWithUpToTwoDecimalPlaces = Math.round(size.width * 100) / 100
        setCurrentWidth(widthWithUpToTwoDecimalPlaces.toString())
      } else if (size.unit === 'custom') {
        setCurrentUnit('custom')
        // Slice off p{ and }
        setCurrentWidth(column.content.slice(2, -1))
      } else {
        setCurrentUnit(size.unit)
        setCurrentWidth(size.width.toString())
      }
    }
  }, [columnWidthModalShown, selection, table])

  const onSubmit: FormEventHandler<Form> = useCallback(
    e => {
      e.preventDefault()
      if (selection && currentUnit) {
        const currentWidthNumber = parseFloat(currentWidth)
        let newWidth: WidthSelection
        if (currentUnit === 'custom') {
          newWidth = { unit: 'custom', width: currentWidth }
        } else {
          newWidth = { unit: currentUnit, width: currentWidthNumber }
        }
        setColumnWidth(view, selection, newWidth, positions, table)
      }
      closeColumnWidthModal()
      return false
    },
    [
      closeColumnWidthModal,
      currentUnit,
      currentWidth,
      positions,
      selection,
      table,
      view,
    ]
  )

  return (
    <AccessibleModal
      show={columnWidthModalShown}
      onHide={closeColumnWidthModal}
      className="table-generator-width-modal"
    >
      <Form onSubmit={onSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{t('set_column_width')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="clearfix">
            <FormGroup className="col-md-8 p-0 mb-0">
              <label
                className="table-generator-width-label"
                htmlFor="column-width-modal-width"
              >
                {t('column_width')}
              </label>
              <input
                id="column-width-modal-width"
                value={currentWidth}
                required
                onChange={e => setCurrentWidth(e.target.value)}
                type={currentUnit === 'custom' ? 'text' : 'number'}
                className="form-control"
                ref={inputRef}
              />
            </FormGroup>
            <FormGroup className="col-md-4 mb-0">
              <Select
                label={
                  <>
                    &nbsp;<span className="sr-only">{t('length_unit')}</span>
                  </>
                }
                items={UNITS}
                itemToKey={x => x ?? ''}
                itemToString={x => (x === 'custom' ? t('custom') : (x ?? ''))}
                onSelectedItemChanged={item => setCurrentUnit(item)}
                defaultItem={currentUnit}
              />
            </FormGroup>
          </div>
          {unitHelp && (
            <p className="my-1">
              {unitHelp.label}{' '}
              {unitHelp.tooltip && (
                <Tooltip
                  id="table-generator-unit-tooltip"
                  description={unitHelp.tooltip}
                  overlayProps={{ delay: 0, placement: 'top' }}
                >
                  <Icon type="question-circle" fw />
                </Tooltip>
              )}
            </p>
          )}
          <div className="mt-2">
            <Trans
              i18nKey="to_use_text_wrapping_in_your_table_make_sure_you_include_the_array_package"
              // eslint-disable-next-line react/jsx-key
              components={[<b />, <code />]}
            />
          </div>
          <div className="mt-1 table-generator-usepackage-copy">
            <code>
              \usepackage{'{'}array{'}'}
            </code>
            <CopyToClipboard
              content={
                '\\usepackage{array} % required for text wrapping in tables'
              }
              tooltipId="table-generator-array-copy"
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            bsStyle={null}
            className="btn-secondary"
            onClick={() => {
              closeColumnWidthModal()
            }}
          >
            {t('cancel')}
          </Button>
          <Button bsStyle={null} className="btn-primary" type="submit">
            {t('ok')}
          </Button>
        </Modal.Footer>
      </Form>
    </AccessibleModal>
  )
}
