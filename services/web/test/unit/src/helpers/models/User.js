const mockModel = require('../MockModel')

module.exports = mockModel('User', {
  './Project': require('./Project')
})
