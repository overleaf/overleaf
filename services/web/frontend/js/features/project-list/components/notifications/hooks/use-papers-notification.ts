import { useFeatureFlag } from '@/shared/context/split-test-context'
import getMeta from '@/utils/meta'

export const usePapersNotification = () => {
  const user = getMeta('ol-user')
  const inRollout = useFeatureFlag('papers-notification-banner')
  const shouldShow =
    inRollout &&
    user &&
    (user.features?.references || user.features?.papers) &&
    !user.refProviders?.mendeley &&
    !user.refProviders?.zotero &&
    !user.refProviders?.papers

  return { shouldShow }
}
