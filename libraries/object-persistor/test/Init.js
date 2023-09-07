const SandboxedModule = require('sandboxed-module')
const chai = require('chai')

chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

SandboxedModule.configure({
  globals: { Buffer, Math, console, process, URL },
})
