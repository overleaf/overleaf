import MaterialIcon from '@/shared/components/material-icon'
import { Project } from '../../../../../../types/project/dashboard/api'

type ProjectSharingBadgeProps = {
  project: Project
}

export default function ProjectSharingBadge({
  project,
}: ProjectSharingBadgeProps) {
  const info = project.sharingInfo
  if (!info) return null

  if (project.accessLevel === 'owner') {
    const hasEnterprise = info.scope && info.scope !== 'private'
    const collabCount = info.collaboratorCount || 0
    if (!hasEnterprise && collabCount === 0) return null

    const parts: string[] = []
    if (hasEnterprise) {
      parts.push(info.networkOnly ? 'Network' : 'Workspace')
    }
    if (collabCount > 0) {
      parts.push(`Shared (${collabCount})`)
    }

    return (
      <span className="ol-project-sharing-meta">
        <MaterialIcon type={hasEnterprise ? 'public' : 'group'} />
        <span>{parts.join(', ')}</span>
      </span>
    )
  }

  const permLabel =
    info.permissionMode === 'edit'
      ? 'Can edit'
      : info.permissionMode === 'view_only'
        ? 'View only'
        : 'View & copy'

  const originLabel =
    info.source === 'enterprise'
      ? info.networkOnly
        ? 'Network'
        : 'Workspace'
      : null

  return (
    <span className="ol-project-sharing-meta">
      <MaterialIcon
        type={info.source === 'enterprise' ? 'domain' : 'group'}
      />
      <span>
        {originLabel ? `${originLabel}, ${permLabel}` : permLabel}
      </span>
    </span>
  )
}
