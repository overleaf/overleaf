import '../../marketing'

import ReactDOM from 'react-dom'
import ConfirmSecondaryEmailForm from '../../features/settings/components/emails/confirm-secondary-email-form'

const confirmEmailContainer = document.getElementById('confirm-secondary-email')

if (confirmEmailContainer) {
  ReactDOM.render(<ConfirmSecondaryEmailForm />, confirmEmailContainer)
}
