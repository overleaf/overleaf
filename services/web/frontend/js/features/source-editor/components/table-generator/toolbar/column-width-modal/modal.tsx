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
import { useCodeMirrorViewContext } from '../../../codemirror-context'
import { CopyToClipboard } from '@/shared/components/copy-to-clipboard'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLCol from '@/shared/components/ol/ol-col'
import OLRow from '@/shared/components/ol/ol-row'
import OLForm from '@/shared/components/ol/ol-form'
import MaterialIcon from '@/shared/components/material-icon'

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

  const onSubmit: FormEventHandler<HTMLFormElement> = useCallback(
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
    <OLModal
      show={columnWidthModalShown}
      onHide={closeColumnWidthModal}
      className="table-generator-width-modal"
    >
      <OLModalHeader>
        <OLModalTitle>{t('set_column_width')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <OLForm id="table-generator-width-form" onSubmit={onSubmit}>
          <OLRow className="g-3">
            <OLCol lg={8}>
              <OLFormGroup
                controlId="column-width-modal-width"
                className="mb-0"
              >
                <OLFormLabel>{t('column_width')}</OLFormLabel>
                <OLFormControl
                  value={currentWidth}
                  required
                  onChange={e => setCurrentWidth(e.target.value)}
                  type={currentUnit === 'custom' ? 'text' : 'number'}
                  ref={inputRef}
                />
              </OLFormGroup>
            </OLCol>
            <OLCol lg={4}>
              <OLFormGroup className="mb-0">
                <Select
                  label={
                    <>
                      &nbsp;
                      <span className="visually-hidden">
                        {t('length_unit')}
                      </span>
                    </>
                  }
                  items={UNITS}
                  itemToKey={x => x ?? ''}
                  itemToString={x => (x === 'custom' ? t('custom') : (x ?? ''))}
                  onSelectedItemChanged={item => setCurrentUnit(item)}
                  defaultItem={currentUnit}
                />
              </OLFormGroup>
            </OLCol>
          </OLRow>
          {unitHelp && (
            <p className="my-1">
              {unitHelp.label}{' '}
              {unitHelp.tooltip && (
                <OLTooltip
                  id="table-generator-unit-tooltip"
                  description={unitHelp.tooltip}
                  overlayProps={{ delay: 0, placement: 'top' }}
                >
                  <span>
                    <MaterialIcon type="help" className="align-middle" />
                  </span>
                </OLTooltip>
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
        </OLForm>
      </OLModalBody>
      <OLModalFooter>
        <OLButton
          variant="secondary"
          onClick={() => {
            closeColumnWidthModal()
          }}
        >
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          form="table-generator-width-form"
          type="submit"
        >
          {t('ok')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
