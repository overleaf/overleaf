import '../base'
import ReactDOM from 'react-dom'
import Root from '@/features/group-management/components/upgrade-subscription/root'

const element = document.getElementById('upgrade-group-subscription-root')
if (element) {
  ReactDOM.render(<Root />, element)
}
