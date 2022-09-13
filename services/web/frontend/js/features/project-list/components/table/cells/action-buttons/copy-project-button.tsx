import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'

type CopyButtonProps = {
  project: Project
}

function CopyProjectButton({ project }: CopyButtonProps) {
  const { t } = useTranslation()
  const text = t('copy')

  if (project.archived || project.trashed) return null

  return (
    <Tooltip
      key={`tooltip-copy-project-${project.id}`}
      id={`tooltip-copy-project-${project.id}`}
      description={text}
      overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
    >
      <button className="btn btn-link action-btn" aria-label={text}>
        <Icon type="files-o" />
      </button>
    </Tooltip>
  )
}

export default memo(CopyProjectButton)
