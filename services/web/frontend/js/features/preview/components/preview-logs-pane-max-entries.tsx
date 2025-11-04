import { useCallback } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import MaterialIcon from '@/shared/components/material-icon'
import PdfLogEntry from '@/features/pdf-preview/components/pdf-log-entry'

function PreviewLogsPaneMaxEntries({
  totalEntries,
  entriesShown,
  hasErrors,
}: {
  totalEntries: number
  entriesShown: number
  hasErrors?: boolean
}) {
  const { t } = useTranslation()

  const title = t('log_entry_maximum_entries_title', {
    total: totalEntries,
    displayed: entriesShown,
  })

  return (
    <PdfLogEntry
      entryAriaLabel={t('log_entry_maximum_entries')}
      headerTitle={title}
      level="raw"
      formattedContent={
        <PreviewLogsPaneMaxEntriesContent hasErrors={hasErrors} />
      }
    />
  )
}

function PreviewLogsPaneMaxEntriesContent({
  hasErrors,
}: {
  hasErrors?: boolean
}) {
  const { t } = useTranslation()
  const { startCompile, stoppedOnFirstError, setAnimateCompileDropdownArrow } =
    useCompileContext()
  const { enableStopOnFirstError } = useStopOnFirstError({
    eventSource: 'too-many-logs',
  })

  const handleEnableStopOnFirstErrorClick = useCallback(() => {
    enableStopOnFirstError()
    startCompile({ stopOnFirstError: true })
    setAnimateCompileDropdownArrow(true)
  }, [enableStopOnFirstError, startCompile, setAnimateCompileDropdownArrow])

  if (hasErrors && !stoppedOnFirstError) {
    return (
      <>
        <p>
          <MaterialIcon type="lightbulb" className="align-middle" />
          &nbsp;
          <strong>{t('tip')}: </strong>
          <Trans
            i18nKey="log_entry_maximum_entries_enable_stop_on_first_error"
            components={[
              <OLButton
                variant="primary"
                size="sm"
                key="enable-stop-on-first-error"
                onClick={handleEnableStopOnFirstErrorClick}
              />,
              // eslint-disable-next-line jsx-a11y/anchor-has-content
              <a
                key="learn-more"
                href="https://www.overleaf.com/learn/latex/Questions/Tips_and_Tricks_for_Troubleshooting_LaTeX"
              />,
            ]}
          />{' '}
        </p>
        <p>{t('log_entry_maximum_entries_see_full_logs')}</p>
      </>
    )
  }

  return (
    <p>
      <MaterialIcon type="lightbulb" className="align-middle" />
      &nbsp;
      <strong>{t('tip')}: </strong>
      {t('log_entry_maximum_entries_see_full_logs')}
    </p>
  )
}

export default PreviewLogsPaneMaxEntries
