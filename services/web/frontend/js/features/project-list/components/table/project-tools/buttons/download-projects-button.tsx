import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useProjectListContext } from '../../../../context/project-list-context'
import { useLocation } from '../../../../../../shared/hooks/use-location'

function DownloadProjectsButton() {
  const { selectedProjects, selectOrUnselectAllProjects } =
    useProjectListContext()
  const { t } = useTranslation()
  const text = t('download')
  const location = useLocation()

  const projectIds = selectedProjects.map(p => p.id)

  const handleDownloadProjects = useCallback(() => {
    eventTracking.sendMB('project-list-page-interaction', {
      action: 'downloadZips',
    })

    location.assign(`/project/download/zip?project_ids=${projectIds.join(',')}`)

    const selected = false
    selectOrUnselectAllProjects(selected)
  }, [projectIds, selectOrUnselectAllProjects, location])

  return (
    <Tooltip
      id="tooltip-download-projects"
      description={text}
      overlayProps={{ placement: 'bottom', trigger: ['hover', 'focus'] }}
    >
      <button
        className="btn btn-secondary"
        aria-label={text}
        onClick={handleDownloadProjects}
      >
        <Icon type="cloud-download" />
      </button>
    </Tooltip>
  )
}

export default memo(DownloadProjectsButton)
