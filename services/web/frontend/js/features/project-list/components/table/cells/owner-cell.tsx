import { useTranslation } from 'react-i18next'
import Icon from '../../../../../shared/components/icon'
import { getOwnerName } from '../../../util/project'
import { Project } from '../../../../../../../types/project/dashboard/api'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'

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
    <OLTooltip
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
    </OLTooltip>
  )
}

type OwnerCellProps = {
  project: Project
}

export default function OwnerCell({ project }: OwnerCellProps) {
  const { t } = useTranslation()

  const ownerName = getOwnerName(project)

  return (
    <>
      {ownerName === 'You' ? t('you') : ownerName}
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
