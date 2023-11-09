import useWaitForI18n from '../../../../shared/hooks/use-wait-for-i18n'
import GroupInvites from './group-invites'

function GroupInvitesRoot() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <GroupInvites />
}

export default GroupInvitesRoot
