import { useTranslation } from 'react-i18next'
import { getProjectOpDoc } from '../../utils/history-details'
import { LoadedUpdate } from '../../services/types/update'

type ChangesProps = {
  pathnames: LoadedUpdate['pathnames']
  projectOps: LoadedUpdate['project_ops']
}

function Changes({ pathnames, projectOps }: ChangesProps) {
  const { t } = useTranslation()

  return (
    <ol className="history-version-changes">
      {pathnames.map(pathname => (
        <li key={pathname}>
          <div
            className="history-version-change-action"
            data-testid="history-version-change-action"
          >
            {t('file_action_edited')}
          </div>
          <div
            className="history-version-change-doc"
            data-testid="history-version-change-doc"
            translate="no"
          >
            {pathname}
          </div>
        </li>
      ))}
      {projectOps.map((op, index) => (
        <li key={index}>
          <div
            className="history-version-change-action"
            data-testid="history-version-change-action"
          >
            {op.rename && t('file_action_renamed')}
            {op.add && t('file_action_created')}
            {op.remove && t('file_action_deleted')}
          </div>
          <div
            className="history-version-change-doc"
            data-testid="history-version-change-doc"
            translate="no"
          >
            {getProjectOpDoc(op)}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default Changes
