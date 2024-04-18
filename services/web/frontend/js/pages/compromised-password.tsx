import '../marketing'

import ReactDOM from 'react-dom'
import { CompromisedPasswordCard } from '../features/compromised-password/components/compromised-password-root'

const compromisedPasswordContainer = document.getElementById(
  'compromised-password'
)

if (compromisedPasswordContainer) {
  ReactDOM.render(<CompromisedPasswordCard />, compromisedPasswordContainer)
}
