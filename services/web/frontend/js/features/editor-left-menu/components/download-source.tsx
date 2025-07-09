import { useTranslation } from 'react-i18next'
import { useProjectContext } from '../../../shared/context/project-context'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { isSmallDevice } from '../../../infrastructure/event-tracking'
import MaterialIcon from '@/shared/components/material-icon'

export default function DownloadSource() {
  const { t } = useTranslation()
  const { projectId } = useProjectContext()

  function sendDownloadEvent() {
    eventTracking.sendMB('download-zip-button-click', {
      projectId,
      location: 'left-menu',
      isSmallDevice,
    })
  }

  return (
    <a
      href={`/project/${projectId}/download/zip`}
      target="_blank"
      rel="noreferrer"
      onClick={sendDownloadEvent}
    >
      <MaterialIcon type="folder_zip" size="2x" />
      <br />
      {t('source')}
    </a>
  )
}
