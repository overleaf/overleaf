const SandboxedModule = require('sandboxed-module')
const mongoose = require('mongoose')

/**
 * Imports a model as we would usually do with e.g. `require('models/User')`
 * an returns a model an schema, but without connecting to Mongo. This allows
 * us to use model classes in tests, and to use them with `sinon-mongoose`
 *
 * @param  modelName the name of the model - e.g. 'User'
 * @param  requires  additional `requires` to be passed to SanboxedModule in
 *                   the event that these also need to be stubbed. For example,
 *                   additional dependent models to be included
 *
 * @return model and schema pair - e.g. { User, UserSchema }
 */

module.exports = (modelName, requires = {}) => {
  let model = {}

  requires.mongoose = {
    createConnection: () => {
      return {
        model: () => {}
      }
    },
    model: (modelName, schema) => {
      model[modelName + 'Schema'] = schema
      model[modelName] = mongoose.model(modelName, schema)
    },
    Schema: mongoose.Schema,
    Types: mongoose.Types
  }

  SandboxedModule.require('../../../../app/src/models/' + modelName, {
    requires: requires
  })

  return model
}
