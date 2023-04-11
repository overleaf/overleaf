import { useTranslation } from 'react-i18next'
import { getProjectOpDoc } from '../../utils/history-details'
import { LoadedUpdate } from '../../services/types/update'

type ChangesProps = {
  pathNames: LoadedUpdate['pathnames']
  projectOps: LoadedUpdate['project_ops']
}

function Changes({ pathNames, projectOps }: ChangesProps) {
  const { t } = useTranslation()

  return (
    <ol className="history-version-changes">
      {pathNames.map(pathName => (
        <li key={pathName}>
          <div className="history-version-change-action">
            {t('file_action_edited')}
          </div>
          <div className="history-version-change-doc">{pathName}</div>
        </li>
      ))}
      {projectOps.map((op, index) => (
        <li key={index}>
          <div className="history-version-change-action">
            {op.rename && t('file_action_renamed')}
            {op.add && t('file_action_created')}
            {op.remove && t('file_action_deleted')}
          </div>
          <div className="history-version-change-doc">
            {getProjectOpDoc(op)}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default Changes
