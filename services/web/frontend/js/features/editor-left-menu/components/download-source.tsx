import { useTranslation } from 'react-i18next'
import { useProjectContext } from '../../../shared/context/project-context'
import Icon from '../../../shared/components/icon'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { isSmallDevice } from '../../../infrastructure/event-tracking'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'

export default function DownloadSource() {
  const { t } = useTranslation()
  const { _id: projectId } = useProjectContext()

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
      <BootstrapVersionSwitcher
        bs3={<Icon type="file-archive-o" modifier="2x" />}
        bs5={<MaterialIcon type="folder_zip" size="2x" />}
      />
      <br />
      {t('source')}
    </a>
  )
}
