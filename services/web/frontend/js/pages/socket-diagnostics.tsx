import '../marketing'

import ReactDOM from 'react-dom'
import { SocketDiagnostics } from '@/features/socket-diagnostics/components/socket-diagnostics'

const socketDiagnosticsContainer = document.getElementById('socket-diagnostics')

if (socketDiagnosticsContainer) {
  ReactDOM.render(<SocketDiagnostics />, socketDiagnosticsContainer)
}
