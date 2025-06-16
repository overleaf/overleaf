import { useTranslation } from 'react-i18next'
import PdfLogEntryRawContent from './pdf-log-entry-raw-content'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { LogEntry } from '../util/types'
import { ElementType } from 'react'
import classNames from 'classnames'

const pdfLogEntryComponents = importOverleafModules(
  'pdfLogEntryComponents'
) as {
  import: { default: ElementType }
  path: string
}[]

export default function PdfLogEntryContent({
  rawContent,
  formattedContent,
  extraInfoURL,
  index,
  logEntry,
  alwaysExpandRawContent = false,
  className,
}: {
  rawContent?: string
  formattedContent?: React.ReactNode
  extraInfoURL?: string | null
  index?: number
  logEntry?: LogEntry
  alwaysExpandRawContent?: boolean
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <div className={classNames('log-entry-content', className)}>
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

      {logEntry &&
        pdfLogEntryComponents.map(
          ({ import: { default: Component }, path }) => (
            <Component key={path} index={index} logEntry={logEntry} />
          )
        )}

      {rawContent && (
        <PdfLogEntryRawContent
          rawContent={rawContent}
          collapsedSize={150}
          alwaysExpanded={alwaysExpandRawContent}
        />
      )}
    </div>
  )
}
