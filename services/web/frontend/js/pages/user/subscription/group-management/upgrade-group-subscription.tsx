import '../base'
import ReactDOM from 'react-dom'
import UpgradeSubscription from '@/features/group-management/components/upgrade-subscription/upgrade-subscription'

const element = document.getElementById('upgrade-group-subscription-root')
if (element) {
  ReactDOM.render(<UpgradeSubscription />, element)
}
