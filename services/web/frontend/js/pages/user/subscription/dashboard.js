import './base'
import ReactDOM from 'react-dom'
import Root from '../../../features/subscription/components/dashboard/root'

const element = document.getElementById('subscription-dashboard-root')
if (element) {
  ReactDOM.render(<Root />, element)
}
