import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useLocation } from '../../../../../../shared/hooks/use-location'

type DownloadProjectButtonProps = {
  project: Project
  children: (text: string, downloadProject: () => void) => React.ReactElement
}

function DownloadProjectButton({
  project,
  children,
}: DownloadProjectButtonProps) {
  const { t } = useTranslation()
  const text = t('download')
  const location = useLocation()

  const downloadProject = useCallback(() => {
    eventTracking.sendMB('project-list-page-interaction', {
      action: 'downloadZip',
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
          <Tooltip
            key={`tooltip-download-project-${project.id}`}
            id={`download-project-${project.id}`}
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
        )}
      </DownloadProjectButton>
    )
  }
)

export default memo(DownloadProjectButton)
export { DownloadProjectButtonTooltip }
