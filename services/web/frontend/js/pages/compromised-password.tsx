import '../marketing'

import { createRoot } from 'react-dom/client'
import { CompromisedPasswordCard } from '../features/compromised-password/components/compromised-password-root'

const compromisedPasswordContainer = document.getElementById(
  'compromised-password'
)

if (compromisedPasswordContainer) {
  const root = createRoot(compromisedPasswordContainer)
  root.render(<CompromisedPasswordCard />)
}
