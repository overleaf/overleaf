import ReactDOM from 'react-dom'
import Root from '../../../features/membership/components/groups-root'

const element = document.getElementById('subscription-manage-groups-root')
if (element) {
  ReactDOM.render(<Root />, element)
}
