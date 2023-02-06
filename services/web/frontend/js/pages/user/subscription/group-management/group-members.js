import '../base'
import ReactDOM from 'react-dom'
import Members from '../../../../features/group-management/components/group-members'

const element = document.getElementById('subscription-manage-group-root')
if (element) {
  ReactDOM.render(<Members />, element)
}
