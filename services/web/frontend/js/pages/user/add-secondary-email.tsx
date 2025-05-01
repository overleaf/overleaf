import '../../marketing'

import { createRoot } from 'react-dom/client'
import { AddSecondaryEmailPrompt } from '../../features/settings/components/emails/add-secondary-email-prompt'

const addSecondaryEmailContainer = document.getElementById(
  'add-secondary-email'
)

if (addSecondaryEmailContainer) {
  const root = createRoot(addSecondaryEmailContainer)
  root.render(<AddSecondaryEmailPrompt />)
}
