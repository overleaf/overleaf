import { useCallback } from 'react'
import PropTypes from 'prop-types'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import PreviewLogEntryHeader from './preview-log-entry-header'
import Icon from '../../../shared/components/icon'
import getMeta from '../../../utils/meta'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'

function PreviewLogsPaneMaxEntries({ totalEntries, entriesShown, hasErrors }) {
  const { t } = useTranslation()
  const showStopOnFirstError = getMeta('ol-showStopOnFirstError')
  const { startCompile, stoppedOnFirstError } = useCompileContext()
  const { enableStopOnFirstError } = useStopOnFirstError({
    eventSource: 'too-many-logs',
  })

  const title = t('log_entry_maximum_entries_title', {
    total: totalEntries,
    displayed: entriesShown,
  })

  const handleEnableStopOnFirstErrorClick = useCallback(() => {
    enableStopOnFirstError()
    startCompile({ stopOnFirstError: true })
  }, [enableStopOnFirstError, startCompile])

  return (
    <div className="log-entry" aria-label={t('log_entry_maximum_entries')}>
      <PreviewLogEntryHeader level="raw" headerTitle={title} />
      <div className="log-entry-content">
        {showStopOnFirstError ? (
          hasErrors && !stoppedOnFirstError ? (
            <>
              <p>
                <Icon type="lightbulb-o" />
                &nbsp;
                <strong>{t('tip')}: </strong>
                <Trans
                  i18nKey="log_entry_maximum_entries_enable_stop_on_first_error"
                  components={{
                    button: (
                      <Button
                        bsSize="xs"
                        bsStyle="info"
                        onClick={handleEnableStopOnFirstErrorClick}
                      />
                    ),
                    'learn-more-link': (
                      // eslint-disable-next-line jsx-a11y/anchor-has-content
                      <a href="https://www.overleaf.com/learn/latex/Questions/Tips_and_Tricks_for_Troubleshooting_LaTeX" />
                    ),
                  }}
                />
              </p>
              <p>{t('log_entry_maximum_entries_see_full_logs')}</p>
            </>
          ) : (
            <p>
              <Icon type="lightbulb-o" />
              &nbsp;
              <strong>{t('tip')}: </strong>
              {t('log_entry_maximum_entries_see_full_logs')}
            </p>
          )
        ) : (
          <>
            <Icon type="lightbulb-o" />
            &nbsp;
            {hasErrors ? (
              <Trans
                i18nKey="log_entry_maximum_entries_message"
                components={[<b />, <p />]} // eslint-disable-line react/jsx-key
              />
            ) : (
              <Trans
                i18nKey="log_entry_maximum_entries_message_no_errors"
                components={[<b />]} // eslint-disable-line react/jsx-key
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

PreviewLogsPaneMaxEntries.propTypes = {
  totalEntries: PropTypes.number,
  entriesShown: PropTypes.number,
  hasErrors: PropTypes.bool,
}

export default PreviewLogsPaneMaxEntries
