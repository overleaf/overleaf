import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import getMeta from '@/utils/meta'
import Invite from '@/features/share-project/invite'
import useAsync from '@/shared/hooks/use-async'
import { postJSON } from '@/infrastructure/fetch-json'
import { useLocation } from '@/shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'

export default function InviteRoot() {
  const user = getMeta('ol-user')
  const projectName = getMeta('ol-projectName')
  const projectId = getMeta('ol-project_id')
  const token = getMeta('ol-inviteToken')
  const location = useLocation()
  const { isLoading, runAsync } = useAsync()
  const { isReady } = useWaitForI18n()

  const handleSubmit = () => {
    runAsync(postJSON(`/project/${projectId}/invite/token/${token}/accept`))
      .then(() => location.assign(`/project/${projectId}`))
      .catch(debugConsole.error)
  }

  if (!isReady) {
    return null
  }

  return (
    <Invite
      projectName={projectName}
      email={user.email}
      submitHandler={handleSubmit}
      isLoading={isLoading}
    />
  )
}
