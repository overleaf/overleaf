const mockModel = require('../MockModel')

module.exports = mockModel('DeletedUser', {
  './User': require('./User')
})
