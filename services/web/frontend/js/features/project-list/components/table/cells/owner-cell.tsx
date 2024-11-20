import { useTranslation } from 'react-i18next'
import { getOwnerName } from '../../../util/project'
import { Project } from '../../../../../../../types/project/dashboard/api'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'

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
        <MaterialIcon
          type="link"
          className="align-text-bottom"
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
      {project.source === 'token' && (
        <LinkSharingIcon project={project} prependSpace={!!project.owner} />
      )}
    </>
  )
}
