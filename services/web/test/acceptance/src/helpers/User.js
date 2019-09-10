/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const request = require('./request')
const _ = require('underscore')
const settings = require('settings-sharelatex')
const { db, ObjectId } = require('../../../../app/src/infrastructure/mongojs')
const UserModel = require('../../../../app/src/models/User').User
const UserUpdater = require('../../../../app/src/Features/User/UserUpdater')
const AuthenticationManager = require('../../../../app/src/Features/Authentication/AuthenticationManager')
const { promisify } = require('util')

let count = 0

class User {
  constructor(options) {
    if (options == null) {
      options = {}
    }
    this.emails = [
      {
        email: options.email || `acceptance-test-${count}@example.com`,
        createdAt: new Date()
      }
    ]
    this.email = this.emails[0].email
    this.password = `acceptance-test-${count}-password`
    count++
    this.jar = request.jar()
    this.request = request.defaults({
      jar: this.jar
    })
  }

  setExtraAttributes(user) {
    if ((user != null ? user._id : undefined) == null) {
      throw new Error('User does not exist')
    }
    this.id = user._id.toString()
    this._id = user._id.toString()
    this.first_name = user.first_name
    return (this.referal_id = user.referal_id)
  }

  get(callback) {
    if (callback == null) {
      callback = function(error, user) {}
    }
    return db.users.findOne({ _id: ObjectId(this._id) }, callback)
  }

  mongoUpdate(updateOp, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return db.users.update({ _id: ObjectId(this._id) }, updateOp, callback)
  }

  register(callback) {
    if (callback == null) {
      callback = function(error, user) {}
    }
    return this.registerWithQuery('', callback)
  }

  registerWithQuery(query, callback) {
    if (callback == null) {
      callback = function(error, user) {}
    }
    if (this._id != null) {
      return callback(new Error('User already registered'))
    }
    return this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      return this.request.post(
        {
          url: `/register${query}`,
          json: { email: this.email, password: this.password }
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          return db.users.findOne({ email: this.email }, (error, user) => {
            if (error != null) {
              return callback(error)
            }
            this.setExtraAttributes(user)
            return callback(null, user)
          })
        }
      )
    })
  }

  login(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return this.loginWith(this.email, callback)
  }

  loginWith(email, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return this.ensureUserExists(error => {
      if (error != null) {
        return callback(error)
      }
      return this.getCsrfToken(error => {
        if (error != null) {
          return callback(error)
        }
        return this.request.post(
          {
            url: settings.enableLegacyLogin ? '/login/legacy' : '/login',
            json: { email, password: this.password }
          },
          callback
        )
      })
    })
  }

  ensureUserExists(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const filter = { email: this.email }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    return UserModel.findOneAndUpdate(filter, {}, options, (error, user) => {
      if (error != null) {
        return callback(error)
      }
      return AuthenticationManager.setUserPasswordInV2(
        user._id,
        this.password,
        error => {
          if (error != null) {
            return callback(error)
          }
          return UserUpdater.updateUser(
            user._id,
            { $set: { emails: this.emails } },
            error => {
              if (error != null) {
                return callback(error)
              }
              this.setExtraAttributes(user)
              return callback(null, this.password)
            }
          )
        }
      )
    })
  }

  setFeatures(features, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const update = {}
    for (let key in features) {
      const value = features[key]
      update[`features.${key}`] = value
    }
    return UserModel.update({ _id: this.id }, update, callback)
  }

  setOverleafId(overleaf_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return UserModel.update(
      { _id: this.id },
      { 'overleaf.id': overleaf_id },
      callback
    )
  }

  logout(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      return this.request.post(
        {
          url: '/logout',
          json: {
            email: this.email,
            password: this.password
          }
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          return db.users.findOne({ email: this.email }, (error, user) => {
            if (error != null) {
              return callback(error)
            }
            this.id = __guard__(user != null ? user._id : undefined, x =>
              x.toString()
            )
            this._id = __guard__(user != null ? user._id : undefined, x1 =>
              x1.toString()
            )
            return callback()
          })
        }
      )
    })
  }

  addEmail(email, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    this.emails.push({ email, createdAt: new Date() })
    return UserUpdater.addEmailAddress(this.id, email, callback)
  }

  confirmEmail(email, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    for (let idx = 0; idx < this.emails.length; idx++) {
      const emailData = this.emails[idx]
      if (emailData.email === email) {
        this.emails[idx].confirmedAt = new Date()
      }
    }
    return UserUpdater.confirmEmail(this.id, email, callback)
  }

  ensure_admin(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return db.users.update(
      { _id: ObjectId(this.id) },
      { $set: { isAdmin: true } },
      callback
    )
  }

  ensureStaffAccess(flag, callback) {
    const update = { $set: {} }
    update.$set[`staffAccess.${flag}`] = true
    return db.users.update({ _id: ObjectId(this.id) }, update, callback)
  }

  upgradeFeatures(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const features = {
      collaborators: -1, // Infinite
      versioning: true,
      dropbox: true,
      compileTimeout: 60,
      compileGroup: 'priority',
      templates: true,
      references: true,
      trackChanges: true,
      trackChangesVisible: true
    }
    return db.users.update(
      { _id: ObjectId(this.id) },
      { $set: { features } },
      callback
    )
  }

  downgradeFeatures(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const features = {
      collaborators: 1,
      versioning: false,
      dropbox: false,
      compileTimeout: 60,
      compileGroup: 'standard',
      templates: false,
      references: false,
      trackChanges: false,
      trackChangesVisible: false
    }
    return db.users.update(
      { _id: ObjectId(this.id) },
      { $set: { features } },
      callback
    )
  }

  defaultFeatures(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const features = settings.defaultFeatures
    return db.users.update(
      { _id: ObjectId(this.id) },
      { $set: { features } },
      callback
    )
  }

  getFeatures(callback) {
    const features = settings.defaultFeatures
    return db.users.findOne(
      { _id: ObjectId(this.id) },
      { features: 1 },
      (error, user) => callback(error, user && user.features)
    )
  }

  full_delete_user(email, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return db.users.findOne({ email }, (error, user) => {
      if (user == null) {
        return callback()
      }
      const user_id = user._id
      return db.projects.remove(
        { owner_ref: ObjectId(user_id) },
        { multi: true },
        err => {
          if (err != null) {
            callback(err)
          }
          return db.users.remove({ _id: ObjectId(user_id) }, callback)
        }
      )
    })
  }

  deleteUser(callback) {
    this.getCsrfToken(error => {
      if (error) {
        return callback(error)
      }
      this.request.post(
        {
          url: '/user/delete',
          json: { password: this.password }
        },
        (err, res) => {
          if (err) {
            return callback(err)
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return callback(
              new Error('Error received from API: ' + res.statusCode)
            )
          }

          callback()
        }
      )
    })
  }

  getProject(project_id, callback) {
    if (callback == null) {
      callback = function(error, project) {}
    }
    return db.projects.findOne(
      { _id: ObjectId(project_id.toString()) },
      callback
    )
  }

  saveProject(project, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return db.projects.update({ _id: project._id }, project, callback)
  }

  createProject(name, options, callback) {
    if (callback == null) {
      callback = function(error, oroject_id) {}
    }
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    return this.request.post(
      {
        url: '/project/new',
        json: Object.assign({ projectName: name }, options)
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        if ((body != null ? body.project_id : undefined) == null) {
          error = new Error(
            JSON.stringify([
              'SOMETHING WENT WRONG CREATING PROJECT',
              name,
              options,
              response.statusCode,
              response.headers['location'],
              body
            ])
          )
          return callback(error)
        } else {
          return callback(null, body.project_id)
        }
      }
    )
  }

  deleteProject(project_id, callback) {
    if (callback == null) {
      callback = error
    }
    return this.request.delete(
      {
        url: `/project/${project_id}?forever=true`
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return callback(null)
      }
    )
  }

  deleteProjects(callback) {
    if (callback == null) {
      callback = error
    }
    return db.projects.remove(
      { owner_ref: ObjectId(this.id) },
      { multi: true },
      err => callback(err)
    )
  }

  openProject(project_id, callback) {
    if (callback == null) {
      callback = error
    }
    return this.request.get(
      {
        url: `/project/${project_id}`
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        if (response.statusCode !== 200) {
          const err = new Error(
            `Non-success response when opening project: ${response.statusCode}`
          )
          return callback(err)
        }
        return callback(null)
      }
    )
  }

  createDocInProject(project_id, parent_folder_id, name, callback) {
    if (callback == null) {
      callback = function(error, doc_id) {}
    }
    return this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      return this.request.post(
        {
          url: `/project/${project_id}/doc`,
          json: {
            name,
            parent_folder_id
          }
        },
        (error, response, body) => {
          return callback(null, body._id)
        }
      )
    })
  }

  addUserToProject(project_id, user, privileges, callback) {
    let updateOp
    if (callback == null) {
      callback = function(error, user) {}
    }
    if (privileges === 'readAndWrite') {
      updateOp = { $addToSet: { collaberator_refs: user._id.toString() } }
    } else if (privileges === 'readOnly') {
      updateOp = { $addToSet: { readOnly_refs: user._id.toString() } }
    }
    return db.projects.update({ _id: db.ObjectId(project_id) }, updateOp, err =>
      callback(err)
    )
  }

  makePublic(project_id, level, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return this.request.post(
      {
        url: `/project/${project_id}/settings/admin`,
        json: {
          publicAccessLevel: level
        }
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return callback(null)
      }
    )
  }

  makePrivate(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return this.request.post(
      {
        url: `/project/${project_id}/settings/admin`,
        json: {
          publicAccessLevel: 'private'
        }
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return callback(null)
      }
    )
  }

  makeTokenBased(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return this.request.post(
      {
        url: `/project/${project_id}/settings/admin`,
        json: {
          publicAccessLevel: 'tokenBased'
        }
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        return callback(null)
      }
    )
  }

  getCsrfToken(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return this.request.get(
      {
        url: '/dev/csrf'
      },
      (err, response, body) => {
        if (err != null) {
          return callback(err)
        }
        this.csrfToken = body
        this.request = this.request.defaults({
          headers: {
            'x-csrf-token': this.csrfToken
          }
        })
        return callback()
      }
    )
  }

  changePassword(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      return this.request.post(
        {
          url: '/user/password/update',
          json: {
            currentPassword: this.password,
            newPassword1: this.password,
            newPassword2: this.password
          }
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          return db.users.findOne({ email: this.email }, (error, user) => {
            if (error != null) {
              return callback(error)
            }
            return callback()
          })
        }
      )
    })
  }

  reconfirmAccountRequest(user_email, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      return this.request.post(
        {
          url: '/user/reconfirm',
          json: {
            email: user_email
          }
        },
        (error, response, body) => {
          return callback(error, response)
        }
      )
    })
  }

  getUserSettingsPage(callback) {
    if (callback == null) {
      callback = function(error, statusCode) {}
    }
    return this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      return this.request.get(
        {
          url: '/user/settings'
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          return callback(null, response.statusCode)
        }
      )
    })
  }

  activateSudoMode(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      return this.request.post(
        {
          uri: '/confirm-password',
          json: {
            password: this.password
          }
        },
        callback
      )
    })
  }

  updateSettings(newSettings, callback) {
    if (callback == null) {
      callback = function(error, response, body) {}
    }
    return this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      return this.request.post(
        {
          url: '/user/settings',
          json: newSettings
        },
        callback
      )
    })
  }

  getProjectListPage(callback) {
    if (callback == null) {
      callback = function(error, statusCode) {}
    }
    return this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      return this.request.get(
        {
          url: '/project'
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          return callback(null, response.statusCode)
        }
      )
    })
  }

  isLoggedIn(callback) {
    if (callback == null) {
      callback = function(error, loggedIn) {}
    }
    return this.request.get('/user/personal_info', (error, response, body) => {
      if (error != null) {
        return callback(error)
      }
      if (response.statusCode === 200) {
        return callback(null, true)
      } else if (response.statusCode === 302) {
        return callback(null, false)
      } else {
        return callback(
          new Error(
            `unexpected status code from /user/personal_info: ${
              response.statusCode
            }`
          )
        )
      }
    })
  }

  setV1Id(v1Id, callback) {
    return UserModel.update(
      {
        _id: this._id
      },
      {
        overleaf: {
          id: v1Id
        }
      },
      callback
    )
  }
}

User.promises = class extends User {
  doRequest(method, params) {
    return new Promise((resolve, reject) => {
      this.request[method.toLowerCase()](params, (err, response, body) => {
        if (err) {
          reject(err)
        } else {
          resolve({ response, body })
        }
      })
    })
  }
}

// promisify User class methods - works for methods with 0-1 output parameters,
// otherwise we will need to implement the method manually instead
const nonPromiseMethods = ['constructor', 'setExtraAttributes']
Object.getOwnPropertyNames(User.prototype).forEach(methodName => {
  const method = User.prototype[methodName]
  if (typeof method === 'function' && !nonPromiseMethods.includes(methodName)) {
    User.promises.prototype[methodName] = promisify(method)
  }
})

module.exports = User

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
