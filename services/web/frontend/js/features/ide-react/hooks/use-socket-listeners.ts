import { useTranslation } from 'react-i18next'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import {
  listProjectInvites,
  listProjectMembers,
} from '@/features/share-project-modal/utils/api'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { debugConsole } from '@/utils/debugging'

function useSocketListeners() {
  const { t } = useTranslation()
  const { socket } = useConnectionContext()
  const { projectId } = useIdeReactContext()
  const { showGenericMessageModal } = useModalsContext()
  const [, setPublicAccessLevel] = useScopeValue('project.publicAccesLevel')
  const [, setProjectMembers] = useScopeValue('project.members')
  const [, setProjectInvites] = useScopeValue('project.invites')

  useSocketListener(socket, 'project:access:revoked', () => {
    showGenericMessageModal(
      t('removed_from_project'),
      t(
        'you_have_been_removed_from_this_project_and_will_be_redirected_to_project_dashboard'
      )
    )
  })

  useSocketListener(socket, 'project:publicAccessLevel:changed', data => {
    if (data.newAccessLevel) {
      setPublicAccessLevel(data.newAccessLevel)
    }
  })

  useSocketListener(socket, 'project:membership:changed', data => {
    if (data.members) {
      listProjectMembers(projectId)
        .then(({ members }) => {
          if (members) {
            setProjectMembers(members)
          }
        })
        .catch(err => {
          debugConsole.error('Error fetching members for project', err)
        })
    }

    if (data.invites) {
      listProjectInvites(projectId)
        .then(({ invites }) => {
          if (invites) {
            setProjectInvites(invites)
          }
        })
        .catch(err => {
          debugConsole.error('Error fetching invites for project', err)
        })
    }
  })
}

export default useSocketListeners
