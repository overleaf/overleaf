import { expressify } from '@overleaf/promise-utils'

const index = async (req, res) => {
  res.render('project/editor/socket_diagnostics')
}

const SocketDiagnostics = {
  index: expressify(index),
}

export default SocketDiagnostics
