const { expect } = require('chai')
const modulePath = '../../../app/js/PersistorManager.js'
const SandboxedModule = require('sandboxed-module')

describe('PersistorManager', function () {
  class FakePersistor {
    async sendStream() {
      return 'sent'
    }
  }

  describe('configured', function () {
    it('should return fake persistor', function () {
      const Settings = {
        docstore: {
          backend: 'gcs',
          bucket: 'wombat',
        },
      }
      const PersistorManger = SandboxedModule.require(modulePath, {
        requires: {
          '@overleaf/settings': Settings,
          '@overleaf/object-persistor': () => new FakePersistor(),
          '@overleaf/metrics': {},
        },
      })

      expect(PersistorManger).to.be.instanceof(FakePersistor)
      expect(PersistorManger.sendStream()).to.eventually.equal('sent')
    })
  })

  describe('not configured', function () {
    it('should return abstract persistor', async function () {
      const Settings = {
        docstore: {
          backend: undefined,
          bucket: 'wombat',
        },
      }
      const PersistorManger = SandboxedModule.require(modulePath, {
        requires: {
          '@overleaf/settings': Settings,
          '@overleaf/object-persistor': () => new FakePersistor(),
          '@overleaf/metrics': {},
        },
      })

      expect(PersistorManger.constructor.name).to.equal('AbstractPersistor')
      expect(PersistorManger.sendStream()).to.eventually.be.rejectedWith(
        /method not implemented in persistor/
      )
    })
  })
})
