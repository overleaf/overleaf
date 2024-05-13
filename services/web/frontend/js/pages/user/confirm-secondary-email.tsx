import '../../marketing'

import ReactDOM from 'react-dom'
import { ConfirmEmailForm } from '../../features/settings/components/emails/confirm-email'

const confirmEmailContainer = document.getElementById('confirm-secondary-email')

if (confirmEmailContainer) {
  ReactDOM.render(
    <ConfirmEmailForm isRegistrationForm={false} />,
    confirmEmailContainer
  )
}
