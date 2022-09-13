import { useTranslation } from 'react-i18next'
import { memo, useMemo } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'

type DeleteProjectButtonProps = {
  project: Project
}

function DeleteProjectButton({ project }: DeleteProjectButtonProps) {
  const { t } = useTranslation()
  const text = t('delete')
  const isOwner = useMemo(() => {
    return project.owner && window.user_id === project.owner.id
  }, [project])

  if (!project.trashed || !isOwner) return null

  return (
    <Tooltip
      key={`tooltip-delete-project-${project.id}`}
      id={`tooltip-delete-project-${project.id}`}
      description={text}
      overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
    >
      <button className="btn btn-link action-btn" aria-label={text}>
        <Icon type="ban" />
      </button>
    </Tooltip>
  )
}

export default memo(DeleteProjectButton)
