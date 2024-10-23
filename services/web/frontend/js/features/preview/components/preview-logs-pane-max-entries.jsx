import { useCallback } from 'react'
import PropTypes from 'prop-types'
import { Trans, useTranslation } from 'react-i18next'
import OLButton from '@/features/ui/components/ol/ol-button'
import PreviewLogEntryHeader from './preview-log-entry-header'
import Icon from '../../../shared/components/icon'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function PreviewLogsPaneMaxEntries({ totalEntries, entriesShown, hasErrors }) {
  const { t } = useTranslation()
  const { startCompile, stoppedOnFirstError, setAnimateCompileDropdownArrow } =
    useCompileContext()
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
    setAnimateCompileDropdownArrow(true)
  }, [enableStopOnFirstError, startCompile, setAnimateCompileDropdownArrow])

  return (
    <div className="log-entry" aria-label={t('log_entry_maximum_entries')}>
      <PreviewLogEntryHeader level="raw" headerTitle={title} />
      <div className="log-entry-content">
        <div className="log-entry-formatted-content">
          {hasErrors && !stoppedOnFirstError ? (
            <>
              <p>
                <BootstrapVersionSwitcher
                  bs3={<Icon type="lightbulb-o" />}
                  bs5={
                    <MaterialIcon type="lightbulb" className="align-middle" />
                  }
                />
                &nbsp;
                <strong>{t('tip')}: </strong>
                <Trans
                  i18nKey="log_entry_maximum_entries_enable_stop_on_first_error"
                  components={[
                    <OLButton
                      variant="info"
                      size="sm"
                      key="enable-stop-on-first-error"
                      bs3Props={{ bsSize: 'xsmall' }}
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
          ) : (
            <p>
              <BootstrapVersionSwitcher
                bs3={<Icon type="lightbulb-o" />}
                bs5={<MaterialIcon type="lightbulb" className="align-middle" />}
              />
              &nbsp;
              <strong>{t('tip')}: </strong>
              {t('log_entry_maximum_entries_see_full_logs')}
            </p>
          )}
        </div>
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
