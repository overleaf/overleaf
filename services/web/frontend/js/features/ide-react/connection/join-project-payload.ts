import { Project } from '../../../../../types/project'
import { PermissionsLevel } from '../types/permissions-level'

export type JoinProjectPayloadProject = Pick<
  Project,
  Exclude<keyof Project, ['rootDocId', 'publicAccessLevel']>
> & { rootDoc_id?: string; publicAccesLevel?: string }

export type JoinProjectPayload = {
  permissionsLevel: PermissionsLevel
  project: JoinProjectPayloadProject
  protocolVersion: number
  publicId: string
}
