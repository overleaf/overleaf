import { useTranslation, Trans } from 'react-i18next'
import { Button } from 'react-bootstrap'
import PdfLogEntry from './pdf-log-entry'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

export default function StopOnFirstErrorPrompt() {
  const { t } = useTranslation()
  const { setStopOnFirstError, startCompile } = useCompileContext()
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
          <Button
            bsSize="xs"
            bsStyle="info"
            onClick={() => {
              startCompile({ stopOnFirstError: false })
              setStopOnFirstError(false)
            }}
          >
            {t('disable_stop_on_first_error')}
          </Button>
        </>
      }
      level="info"
    />
  )
}
