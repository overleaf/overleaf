import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import PreviewLogsPaneEntry from '../../preview/components/preview-logs-pane-entry'

PdfValidationIssue.propTypes = {
  name: PropTypes.string.isRequired,
  issue: PropTypes.any,
}

function PdfValidationIssue({ issue, name }) {
  const { t } = useTranslation()

  switch (name) {
    case 'sizeCheck':
      return (
        <PreviewLogsPaneEntry
          headerTitle={t('project_too_large')}
          formattedContent={
            <>
              <div>{t('project_too_large_please_reduce')}</div>
              <ul className="list-no-margin-bottom">
                {issue.resources.map(resource => (
                  <li key={resource.path}>
                    {resource.path} &mdash; {resource.kbSize}
                    kb
                  </li>
                ))}
              </ul>
            </>
          }
          entryAriaLabel={t('validation_issue_entry_description')}
          level="error"
        />
      )

    case 'conflictedPaths':
      return (
        <PreviewLogsPaneEntry
          headerTitle={t('conflicting_paths_found')}
          formattedContent={
            <>
              <div>{t('following_paths_conflict')}</div>
              <ul className="list-no-margin-bottom">
                {issue.map(detail => (
                  <li key={detail.path}>/{detail.path}</li>
                ))}
              </ul>
            </>
          }
          entryAriaLabel={t('validation_issue_entry_description')}
          level="error"
        />
      )

    case 'mainFile':
      return (
        <PreviewLogsPaneEntry
          headerTitle={t('main_file_not_found')}
          formattedContent={t('please_set_main_file')}
          entryAriaLabel={t('validation_issue_entry_description')}
          level="error"
        />
      )

    default:
      return null
  }
}

export default memo(PdfValidationIssue)
