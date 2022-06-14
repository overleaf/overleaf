import { useCallback, useMemo } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Button } from 'react-bootstrap'
import PdfLogEntry from './pdf-log-entry'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import BetaBadge from '../../../shared/components/beta-badge'

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

  const betaBadgeTooltip = useMemo(
    () => ({
      id: 'stop-on-first-error-tooltip',
      placement: 'right',
      className: 'tooltip-wide',
      text: (
        <>
          We are beta testing the “Stop on first error” compilation mode.
          <br />
          Click to give feedback
        </>
      ),
    }),
    []
  )

  return (
    <PdfLogEntry
      headerTitle={t('stop_on_first_error_enabled_title')}
      headerIcon={
        <BetaBadge
          tooltip={betaBadgeTooltip}
          url="https://forms.gle/7M8821o5RDZrFKoF6"
        />
      }
      formattedContent={
        <>
          <Trans
            i18nKey="stop_on_first_error_enabled_description"
            // eslint-disable-next-line react/jsx-key
            components={[<strong />]}
          />{' '}
          <Button bsSize="xs" bsStyle="info" onClick={handleDisableButtonClick}>
            {t('disable_stop_on_first_error')}
          </Button>
        </>
      }
      level="info"
    />
  )
}
