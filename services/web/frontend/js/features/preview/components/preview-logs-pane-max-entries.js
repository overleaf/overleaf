import PropTypes from 'prop-types'
import { Trans, useTranslation } from 'react-i18next'
import PreviewLogEntryHeader from './preview-log-entry-header'
import Icon from '../../../shared/components/icon'

function PreviewLogsPaneMaxEntries({ totalEntries, entriesShown }) {
  const { t } = useTranslation()

  const title = t('log_entry_maximum_entries_title', {
    total: totalEntries,
    displayed: entriesShown,
  })

  return (
    <div className="log-entry" aria-label={t('log_entry_maximum_entries')}>
      <PreviewLogEntryHeader level="raw" headerTitle={title} />
      <div className="log-entry-content">
        <Icon type="lightbulb-o" />{' '}
        <Trans
          i18nKey="log_entry_maximum_entries_message"
          components={[<b key="bold-1" />]}
        />
      </div>
    </div>
  )
}

PreviewLogsPaneMaxEntries.propTypes = {
  totalEntries: PropTypes.number,
  entriesShown: PropTypes.number,
}

export default PreviewLogsPaneMaxEntries
