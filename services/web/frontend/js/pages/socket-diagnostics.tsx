import '../marketing'

import { createRoot } from 'react-dom/client'
import { SocketDiagnostics } from '@/features/socket-diagnostics/components/socket-diagnostics'

const socketDiagnosticsContainer = document.getElementById('socket-diagnostics')

if (socketDiagnosticsContainer) {
  const root = createRoot(socketDiagnosticsContainer)
  root.render(<SocketDiagnostics />)
}
