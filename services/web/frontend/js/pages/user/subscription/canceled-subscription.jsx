import './base'
import ReactDOM from 'react-dom'
import Root from '../../../features/subscription/components/canceled-subscription/root'

const element = document.getElementById('subscription-canceled-root')
if (element) {
  ReactDOM.render(<Root />, element)
}
