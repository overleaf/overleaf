import '../../marketing'

import { createRoot } from 'react-dom/client'
import ConfirmSecondaryEmailForm from '../../features/settings/components/emails/confirm-secondary-email-form'

const confirmEmailContainer = document.getElementById('confirm-secondary-email')

if (confirmEmailContainer) {
  const root = createRoot(confirmEmailContainer)
  root.render(<ConfirmSecondaryEmailForm />)
}
