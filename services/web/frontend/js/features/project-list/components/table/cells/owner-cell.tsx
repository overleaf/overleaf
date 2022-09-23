import { useTranslation } from 'react-i18next'
import Icon from '../../../../../shared/components/icon'
import Tooltip from '../../../../../shared/components/tooltip'
import { getOwnerName } from '../../../util/project'
import { Project } from '../../../../../../../types/project/dashboard/api'

type LinkSharingIconProps = {
  prependSpace: boolean
  project: Project
  className?: string
}

function LinkSharingIcon({
  project,
  prependSpace,
  className,
}: LinkSharingIconProps) {
  const { t } = useTranslation()
  return (
    <Tooltip
      key={`tooltip-link-sharing-${project.id}`}
      id={`tooltip-link-sharing-${project.id}`}
      description={t('link_sharing')}
      overlayProps={{ placement: 'right', trigger: ['hover', 'focus'] }}
    >
      {/* OverlayTrigger won't fire unless icon is wrapped in a span */}
      <span className={className}>
        {prependSpace ? ' ' : ''}
        <Icon
          type="link"
          className="small"
          accessibilityLabel={t('link_sharing')}
        />
      </span>
    </Tooltip>
  )
}

type OwnerCellProps = {
  project: Project
}

export default function OwnerCell({ project }: OwnerCellProps) {
  const ownerName = getOwnerName(project)

  return (
    <>
      {ownerName}
      {project.source === 'token' ? (
        <LinkSharingIcon
          className="hidden-xs"
          project={project}
          prependSpace={!!project.owner}
        />
      ) : (
        ''
      )}
    </>
  )
}
