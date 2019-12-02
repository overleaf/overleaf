const request = require('./request')
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
    this.referal_id = user.referal_id
  }

  get(callback) {
    db.users.findOne({ _id: ObjectId(this._id) }, callback)
  }

  mongoUpdate(updateOp, callback) {
    db.users.update({ _id: ObjectId(this._id) }, updateOp, callback)
  }

  register(callback) {
    this.registerWithQuery('', callback)
  }

  registerWithQuery(query, callback) {
    if (this._id != null) {
      return callback(new Error('User already registered'))
    }
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
        {
          url: `/register${query}`,
          json: { email: this.email, password: this.password }
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          db.users.findOne({ email: this.email }, (error, user) => {
            if (error != null) {
              return callback(error)
            }
            this.setExtraAttributes(user)
            callback(null, user)
          })
        }
      )
    })
  }

  login(callback) {
    this.loginWith(this.email, callback)
  }

  loginWith(email, callback) {
    this.ensureUserExists(error => {
      if (error != null) {
        return callback(error)
      }
      this.getCsrfToken(error => {
        if (error != null) {
          return callback(error)
        }
        this.request.post(
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
    const filter = { email: this.email }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    UserModel.findOneAndUpdate(filter, {}, options, (error, user) => {
      if (error != null) {
        return callback(error)
      }
      AuthenticationManager.setUserPasswordInV2(
        user._id,
        this.password,
        error => {
          if (error != null) {
            return callback(error)
          }
          UserUpdater.updateUser(
            user._id,
            { $set: { emails: this.emails } },
            error => {
              if (error != null) {
                return callback(error)
              }
              this.setExtraAttributes(user)
              callback(null, this.password)
            }
          )
        }
      )
    })
  }

  setFeatures(features, callback) {
    const update = {}
    for (let key in features) {
      const value = features[key]
      update[`features.${key}`] = value
    }
    UserModel.update({ _id: this.id }, update, callback)
  }

  setFeaturesOverride(featuresOverride, callback) {
    const update = { $push: { featuresOverrides: featuresOverride } }
    UserModel.update({ _id: this.id }, update, callback)
  }

  setOverleafId(overleafId, callback) {
    UserModel.update({ _id: this.id }, { 'overleaf.id': overleafId }, callback)
  }

  logout(callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
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
          db.users.findOne({ email: this.email }, (error, user) => {
            if (error != null) {
              return callback(error)
            }
            if (user == null) {
              return callback()
            }
            this.id = user._id.toString()
            this._id = user._id.toString()
            callback()
          })
        }
      )
    })
  }

  addEmail(email, callback) {
    this.emails.push({ email, createdAt: new Date() })
    UserUpdater.addEmailAddress(this.id, email, callback)
  }

  confirmEmail(email, callback) {
    for (let idx = 0; idx < this.emails.length; idx++) {
      const emailData = this.emails[idx]
      if (emailData.email === email) {
        this.emails[idx].confirmedAt = new Date()
      }
    }
    UserUpdater.confirmEmail(this.id, email, callback)
  }

  ensureAdmin(callback) {
    db.users.update(
      { _id: ObjectId(this.id) },
      { $set: { isAdmin: true } },
      callback
    )
  }

  ensureStaffAccess(flag, callback) {
    const update = { $set: {} }
    update.$set[`staffAccess.${flag}`] = true
    db.users.update({ _id: ObjectId(this.id) }, update, callback)
  }

  upgradeFeatures(callback) {
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
    db.users.update(
      { _id: ObjectId(this.id) },
      { $set: { features } },
      callback
    )
  }

  downgradeFeatures(callback) {
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
    db.users.update(
      { _id: ObjectId(this.id) },
      { $set: { features } },
      callback
    )
  }

  defaultFeatures(callback) {
    const features = settings.defaultFeatures
    db.users.update(
      { _id: ObjectId(this.id) },
      { $set: { features } },
      callback
    )
  }

  getFeatures(callback) {
    db.users.findOne(
      { _id: ObjectId(this.id) },
      { features: 1 },
      (error, user) => callback(error, user && user.features)
    )
  }

  fullDeleteUser(email, callback) {
    db.users.findOne({ email }, (error, user) => {
      if (error != null) {
        return callback(error)
      }
      if (user == null) {
        return callback()
      }
      const userId = user._id
      db.projects.remove(
        { owner_ref: ObjectId(userId) },
        { multi: true },
        err => {
          if (err != null) {
            callback(err)
          }
          db.users.remove({ _id: ObjectId(userId) }, callback)
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

  getProject(projectId, callback) {
    db.projects.findOne({ _id: ObjectId(projectId.toString()) }, callback)
  }

  saveProject(project, callback) {
    db.projects.update({ _id: project._id }, project, callback)
  }

  createProject(name, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    this.request.post(
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
          callback(error)
        } else {
          callback(null, body.project_id)
        }
      }
    )
  }

  deleteProject(projectId, callback) {
    this.request.delete(
      {
        url: `/project/${projectId}?forever=true`
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        callback(null)
      }
    )
  }

  deleteProjects(callback) {
    db.projects.remove({ owner_ref: ObjectId(this.id) }, { multi: true }, err =>
      callback(err)
    )
  }

  openProject(projectId, callback) {
    this.request.get(
      {
        url: `/project/${projectId}`
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
        callback(null)
      }
    )
  }

  createDocInProject(projectId, parentFolderId, name, callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
        {
          url: `/project/${projectId}/doc`,
          json: {
            name,
            parentFolderId
          }
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          callback(null, body._id)
        }
      )
    })
  }

  addUserToProject(projectId, user, privileges, callback) {
    let updateOp
    if (privileges === 'readAndWrite') {
      updateOp = { $addToSet: { collaberator_refs: user._id } }
    } else if (privileges === 'readOnly') {
      updateOp = { $addToSet: { readOnly_refs: user._id } }
    }
    db.projects.update({ _id: db.ObjectId(projectId) }, updateOp, err =>
      callback(err)
    )
  }

  makePublic(projectId, level, callback) {
    this.request.post(
      {
        url: `/project/${projectId}/settings/admin`,
        json: {
          publicAccessLevel: level
        }
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        callback(null)
      }
    )
  }

  makePrivate(projectId, callback) {
    this.request.post(
      {
        url: `/project/${projectId}/settings/admin`,
        json: {
          publicAccessLevel: 'private'
        }
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        callback(null)
      }
    )
  }

  makeTokenBased(projectId, callback) {
    this.request.post(
      {
        url: `/project/${projectId}/settings/admin`,
        json: {
          publicAccessLevel: 'tokenBased'
        }
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        callback(null)
      }
    )
  }

  getCsrfToken(callback) {
    this.request.get(
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
        callback()
      }
    )
  }

  changePassword(callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
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
          db.users.findOne({ email: this.email }, (error, user) => {
            if (error != null) {
              return callback(error)
            }
            callback()
          })
        }
      )
    })
  }

  reconfirmAccountRequest(userEmail, callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
        {
          url: '/user/reconfirm',
          json: {
            email: userEmail
          }
        },
        (error, response, body) => {
          callback(error, response)
        }
      )
    })
  }

  getUserSettingsPage(callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.get(
        {
          url: '/user/settings'
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          callback(null, response.statusCode)
        }
      )
    })
  }

  activateSudoMode(callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
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
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
        {
          url: '/user/settings',
          json: newSettings
        },
        callback
      )
    })
  }

  getProjectListPage(callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.get(
        {
          url: '/project'
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          callback(null, response.statusCode)
        }
      )
    })
  }

  isLoggedIn(callback) {
    this.request.get('/user/personal_info', (error, response, body) => {
      if (error != null) {
        return callback(error)
      }
      if (response.statusCode === 200) {
        callback(null, true)
      } else if (response.statusCode === 302) {
        callback(null, false)
      } else {
        callback(
          new Error(
            `unexpected status code from /user/personal_info: ${
              response.statusCode
            }`
          )
        )
      }
    })
  }

  transferProjectOwnership(projectId, userId, callback) {
    this.getCsrfToken(err => {
      if (err != null) {
        return callback(err)
      }
      this.request.post(
        {
          url: `/project/${projectId.toString()}/transfer-ownership`,
          json: {
            user_id: userId.toString()
          }
        },
        (err, response) => {
          if (err != null) {
            return callback(err)
          }
          if (response.statusCode !== 204) {
            return callback(
              new Error(`Unexpected status code: ${response.statusCode}`)
            )
          }
          callback()
        }
      )
    })
  }

  setV1Id(v1Id, callback) {
    UserModel.update(
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

  setCollaboratorInfo(projectId, userId, info, callback) {
    this.getCsrfToken(err => {
      if (err != null) {
        return callback(err)
      }
      this.request.put(
        {
          url: `/project/${projectId.toString()}/users/${userId.toString()}`,
          json: info
        },
        (err, response) => {
          if (err != null) {
            return callback(err)
          }
          if (response.statusCode !== 204) {
            return callback(
              new Error(`Unexpected status code: ${response.statusCode}`)
            )
          }
          callback()
        }
      )
    })
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
