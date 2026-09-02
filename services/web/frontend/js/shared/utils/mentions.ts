import {
  ProjectMember,
  ProjectOwner,
} from '@/shared/context/types/project-metadata'
import { debugConsole } from '@/utils/debugging'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { buildName } from '@/shared/utils/build-name'
import { MemberInfo } from '@/features/source-editor/extensions/project-members-info'

export const membersToIdMap = (
  members: ProjectMember[],
  owner: ProjectOwner | undefined
) => {
  const collaboratorIdToName = new Map<string, MemberInfo>()

  if (!owner) {
    debugConsole.error('no owner found for project')
    return collaboratorIdToName
  }

  collaboratorIdToName.set(owner._id, {
    name: buildName(owner),
    email: owner.email,
  })

  for (const member of members) {
    collaboratorIdToName.set(member._id, {
      name: buildName(member),
      email: member.email,
    })
  }
  return collaboratorIdToName
}

// Mention display (parsing @[id] tokens into names) is gated behind both split
// tests, so chat and the review panel render mentions consistently.
export const mentionsFeatureEnabled = () =>
  isSplitTestEnabled('email-notifications') &&
  isSplitTestEnabled('comment-mentions')
