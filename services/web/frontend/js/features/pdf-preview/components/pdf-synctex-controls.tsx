import classNames from 'classnames'
import { memo, useCallback, useMemo } from 'react'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { Placement } from 'react-bootstrap/types'
import useSynctex from '../hooks/use-synctex'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import OLSpinner from '@/shared/components/ol/ol-spinner'

const GoToCodeButton = memo(function GoToCodeButton({
  syncToCode,
  syncToCodeInFlight,
  isDetachLayout,
}: {
  syncToCode: ({ visualOffset }: { visualOffset: number }) => void
  syncToCodeInFlight: boolean
  isDetachLayout?: boolean
}) {
  const { t } = useTranslation()
  const buttonClasses = classNames('synctex-control', {
    'detach-synctex-control': !!isDetachLayout,
  })

  let buttonIcon = null
  if (syncToCodeInFlight) {
    buttonIcon = <OLSpinner size="sm" />
  } else if (!isDetachLayout) {
    buttonIcon = (
      <MaterialIcon type="arrow_left_alt" className="synctex-control-icon" />
    )
  }

  const syncToCodeWithButton = useCallback(() => {
    syncToCode({ visualOffset: 72 })
  }, [syncToCode])

  const overlayProps = useMemo(
    () => ({
      placement: (isDetachLayout ? 'bottom' : 'right') as Placement,
    }),
    [isDetachLayout]
  )

  return (
    <OLTooltip
      id="sync-to-code"
      description={t('go_to_pdf_location_in_code')}
      overlayProps={overlayProps}
    >
      <span>
        <OLButton
          variant="secondary"
          size="sm"
          onClick={syncToCodeWithButton}
          disabled={syncToCodeInFlight}
          className={buttonClasses}
          aria-label={t('go_to_pdf_location_in_code')}
        >
          {buttonIcon}
          {isDetachLayout ? <span>&nbsp;{t('show_in_code')}</span> : ''}
        </OLButton>
      </span>
    </OLTooltip>
  )
})

const GoToPdfButton = memo(function GoToPdfButton({
  syncToPdf,
  syncToPdfInFlight,
  isDetachLayout,
  canSyncToPdf,
}: {
  syncToPdf: () => void
  syncToPdfInFlight: boolean
  canSyncToPdf: boolean
  isDetachLayout?: boolean
}) {
  const { t } = useTranslation()
  const tooltipPlacement = isDetachLayout ? 'bottom' : 'right'
  const buttonClasses = classNames('synctex-control', {
    'detach-synctex-control': !!isDetachLayout,
  })

  let buttonIcon = null
  if (syncToPdfInFlight) {
    buttonIcon = <OLSpinner size="sm" />
  } else if (!isDetachLayout) {
    buttonIcon = (
      <MaterialIcon type="arrow_right_alt" className="synctex-control-icon" />
    )
  }

  return (
    <OLTooltip
      id="sync-to-pdf"
      description={t('go_to_code_location_in_pdf')}
      overlayProps={{ placement: tooltipPlacement }}
    >
      <span>
        <OLButton
          variant="secondary"
          size="sm"
          onClick={syncToPdf}
          disabled={syncToPdfInFlight || !canSyncToPdf}
          className={buttonClasses}
          aria-label={t('go_to_code_location_in_pdf')}
        >
          {buttonIcon}
          {isDetachLayout ? <span>&nbsp;{t('show_in_pdf')}</span> : ''}
        </OLButton>
      </span>
    </OLTooltip>
  )
})

function PdfSynctexControls() {
  const { detachRole } = useLayoutContext()
  const { pdfUrl, pdfViewer, position } = useCompileContext()
  const {
    syncToCode,
    syncToPdf,
    syncToCodeInFlight,
    syncToPdfInFlight,
    canSyncToPdf,
  } = useSynctex()
  const visualPreviewEnabled = useFeatureFlag('visual-preview')

  if (visualPreviewEnabled) {
    return null
  }

  if (!position) {
    return null
  }

  if (!pdfUrl || pdfViewer === 'native') {
    return null
  }

  if (detachRole === 'detacher') {
    return (
      <GoToPdfButton
        syncToPdf={syncToPdf}
        syncToPdfInFlight={syncToPdfInFlight}
        isDetachLayout
        canSyncToPdf={canSyncToPdf}
      />
    )
  } else if (detachRole === 'detached') {
    return (
      <GoToCodeButton
        syncToCode={syncToCode}
        syncToCodeInFlight={syncToCodeInFlight}
        isDetachLayout
      />
    )
  } else {
    return (
      <>
        <GoToPdfButton
          syncToPdf={syncToPdf}
          syncToPdfInFlight={syncToPdfInFlight}
          canSyncToPdf={canSyncToPdf}
        />

        <GoToCodeButton
          syncToCode={syncToCode}
          syncToCodeInFlight={syncToCodeInFlight}
        />
      </>
    )
  }
}

export default memo(PdfSynctexControls)
