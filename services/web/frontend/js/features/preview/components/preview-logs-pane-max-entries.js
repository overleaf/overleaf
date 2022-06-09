import PropTypes from 'prop-types'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import PreviewLogEntryHeader from './preview-log-entry-header'
import Icon from '../../../shared/components/icon'
import getMeta from '../../../utils/meta'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

function PreviewLogsPaneMaxEntries({ totalEntries, entriesShown, hasErrors }) {
  const { t } = useTranslation()
  const showStopOnFirstError = getMeta('ol-showStopOnFirstError')
  const { startCompile, setStopOnFirstError, stoppedOnFirstError } =
    useCompileContext()

  const title = t('log_entry_maximum_entries_title', {
    total: totalEntries,
    displayed: entriesShown,
  })

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
                        onClick={() => {
                          startCompile({ stopOnFirstError: true })
                          setStopOnFirstError(true)
                        }}
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
