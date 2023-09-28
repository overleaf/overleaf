import './base'
import ReactDOM from 'react-dom'
import Root from '../../../features/subscription/components/successful-subscription/root'

const element = document.getElementById('subscription-success-root')
if (element) {
  ReactDOM.render(<Root />, element)
}
