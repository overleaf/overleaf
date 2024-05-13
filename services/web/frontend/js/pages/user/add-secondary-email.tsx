import '../../marketing'

import ReactDOM from 'react-dom'
import { AddSecondaryEmailPrompt } from '../../features/settings/components/emails/add-secondary-email-prompt'

const addSecondaryEmailContainer = document.getElementById(
  'add-secondary-email'
)

if (addSecondaryEmailContainer) {
  ReactDOM.render(<AddSecondaryEmailPrompt />, addSecondaryEmailContainer)
}
