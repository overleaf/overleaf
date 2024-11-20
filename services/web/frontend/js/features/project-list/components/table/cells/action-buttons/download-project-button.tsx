import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useLocation } from '../../../../../../shared/hooks/use-location'
import { isSmallDevice } from '../../../../../../infrastructure/event-tracking'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'

type DownloadProjectButtonProps = {
  project: Project
  children: (text: string, downloadProject: () => void) => React.ReactElement
}

function DownloadProjectButton({
  project,
  children,
}: DownloadProjectButtonProps) {
  const { t } = useTranslation()
  const text = t('download_zip_file')
  const location = useLocation()

  const downloadProject = useCallback(() => {
    eventTracking.sendMB('project-list-page-interaction', {
      action: 'downloadZip',
      projectId: project.id,
      isSmallDevice,
    })
    location.assign(`/project/${project.id}/download/zip`)
  }, [project, location])

  return children(text, downloadProject)
}

const DownloadProjectButtonTooltip = memo(
  function DownloadProjectButtonTooltip({
    project,
  }: Pick<DownloadProjectButtonProps, 'project'>) {
    return (
      <DownloadProjectButton project={project}>
        {(text, downloadProject) => (
          <OLTooltip
            key={`tooltip-download-project-${project.id}`}
            id={`download-project-${project.id}`}
            description={text}
            overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
          >
            <span>
              <OLIconButton
                onClick={downloadProject}
                variant="link"
                accessibilityLabel={text}
                className="action-btn"
                icon="download"
              />
            </span>
          </OLTooltip>
        )}
      </DownloadProjectButton>
    )
  }
)

export default memo(DownloadProjectButton)
export { DownloadProjectButtonTooltip }
