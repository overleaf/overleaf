import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import getMeta from '@/utils/meta'
import InviteNotValid from '@/features/share-project/invite-not-valid'
import { User } from '@ol-types/user'

export default function InviteNotValidRoot() {
  const user = getMeta('ol-user') as User | undefined
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <InviteNotValid email={user?.email} />
}
