import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'

type DownloadProjectButtonProps = {
  project: Project
}

function DownloadProjectButton({ project }: DownloadProjectButtonProps) {
  const { t } = useTranslation()
  const text = t('download')

  const downloadProject = useCallback(() => {
    eventTracking.send(
      'project-list-page-interaction',
      'project action',
      'Download Zip'
    )
    window.location.assign(`/project/${project.id}/download/zip`)
  }, [project])

  return (
    <Tooltip
      key={`tooltip-download-project-${project.id}`}
      id={`tooltip-download-project-${project.id}`}
      description={text}
      overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
    >
      <button
        className="btn btn-link action-btn"
        aria-label={text}
        onClick={downloadProject}
      >
        <Icon type="cloud-download" />
      </button>
    </Tooltip>
  )
}

export default memo(DownloadProjectButton)
