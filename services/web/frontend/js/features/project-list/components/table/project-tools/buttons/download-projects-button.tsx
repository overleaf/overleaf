import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useProjectListContext } from '../../../../context/project-list-context'
import { useLocation } from '../../../../../../shared/hooks/use-location'
import { isSmallDevice } from '../../../../../../infrastructure/event-tracking'

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
      isSmallDevice,
    })

    location.assign(`/project/download/zip?project_ids=${projectIds.join(',')}`)

    const selected = false
    selectOrUnselectAllProjects(selected)
  }, [projectIds, selectOrUnselectAllProjects, location])

  return (
    <OLTooltip
      id="tooltip-download-projects"
      description={text}
      overlayProps={{ placement: 'bottom', trigger: ['hover', 'focus'] }}
    >
      <OLIconButton
        onClick={handleDownloadProjects}
        variant="secondary"
        accessibilityLabel={text}
        icon="download"
      />
    </OLTooltip>
  )
}

export default memo(DownloadProjectsButton)
