const chai = require('chai')
chai.use(require('chai-as-promised'))
chai.use(require('chaid'))

// Crash the process on an unhandled promise rejection
process.on('unhandledRejection', err => {
  console.error('Unhandled promise rejection:', err)
  process.exit(1)
})
