import '@/marketing'

import { createRoot } from 'react-dom/client'
import UserActivateRegister from '../components/user-activate-register'

const container = document.getElementById('user-activate-register-container')
if (container) {
  const root = createRoot(container)
  root.render(<UserActivateRegister />)
}
