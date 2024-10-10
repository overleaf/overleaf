import { Button } from 'react-bootstrap'
import { postJSON } from '@/infrastructure/fetch-json'
import { useSubscriptionDashboardContext } from '@/features/subscription/context/subscription-dashboard-context'
import { RecurlySubscription } from '../../../../../../../../../../types/subscription/dashboard/subscription'

const AI_ADDON_CODE = 'assistant'

export function BuyAiAddOnButton() {
  const { personalSubscription } = useSubscriptionDashboardContext()
  const recurlySub = personalSubscription as RecurlySubscription

  const hasSub = recurlySub?.recurly?.addOns?.some(
    addOn => addOn.add_on_code === AI_ADDON_CODE
  )

  const paths = {
    purchaseAddon: `/user/subscription/addon/${AI_ADDON_CODE}/add`,
    removeAddon: `/user/subscription/addon/${AI_ADDON_CODE}/remove`,
  }

  const addAiAddon = async () => {
    await postJSON(paths.purchaseAddon)
    location.reload()
  }

  // gotta change here to change the time to next billing cycle
  const removeAiAddon = async () => {
    await postJSON(paths.removeAddon)
    location.reload()
  }

  return hasSub ? (
    <Button onClick={removeAiAddon}>Cancel AI subscription</Button>
  ) : (
    <Button onClick={addAiAddon}>Purchase AI subscription </Button>
  )
}
