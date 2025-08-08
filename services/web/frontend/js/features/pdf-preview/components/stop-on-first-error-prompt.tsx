import { useCallback } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'
import PdfLogEntry from './pdf-log-entry'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'

export default function StopOnFirstErrorPrompt() {
  const { t } = useTranslation()
  const { startCompile, setAnimateCompileDropdownArrow } = useCompileContext()
  const { disableStopOnFirstError } = useStopOnFirstError({
    eventSource: 'logs-pane',
  })

  const handleDisableButtonClick = useCallback(() => {
    disableStopOnFirstError()
    startCompile({ stopOnFirstError: false })
    setAnimateCompileDropdownArrow(true)
  }, [disableStopOnFirstError, startCompile, setAnimateCompileDropdownArrow])

  return (
    <PdfLogEntry
      headerTitle={t('stop_on_first_error_enabled_title')}
      formattedContent={
        <>
          <Trans
            i18nKey="stop_on_first_error_enabled_description"
            // eslint-disable-next-line react/jsx-key
            components={[<strong />]}
          />{' '}
          <OLButton
            variant="primary"
            size="sm"
            onClick={handleDisableButtonClick}
          >
            {t('disable_stop_on_first_error')}
          </OLButton>
        </>
      }
      level="info"
    />
  )
}
