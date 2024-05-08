import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import GroupInvite from './group-invite/group-invite'

export default function InviteRoot() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }
  return <GroupInvite />
}
