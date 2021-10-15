import { useTranslation } from 'react-i18next'
import PdfLogEntryRawContent from './pdf-log-entry-raw-content'
import PropTypes from 'prop-types'

export default function PdfLogEntryContent({
  rawContent,
  formattedContent,
  extraInfoURL,
}) {
  const { t } = useTranslation()

  return (
    <div className="log-entry-content">
      {formattedContent && (
        <div className="log-entry-formatted-content">{formattedContent}</div>
      )}

      {extraInfoURL && (
        <div className="log-entry-content-link">
          <a href={extraInfoURL} target="_blank" rel="noopener">
            {t('log_hint_extra_info')}
          </a>
        </div>
      )}

      {rawContent && (
        <PdfLogEntryRawContent rawContent={rawContent} collapsedSize={150} />
      )}
    </div>
  )
}

PdfLogEntryContent.propTypes = {
  rawContent: PropTypes.string,
  formattedContent: PropTypes.node,
  extraInfoURL: PropTypes.string,
}
