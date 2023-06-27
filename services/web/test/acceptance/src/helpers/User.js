const request = require('./request')
const settings = require('@overleaf/settings')
const { db, ObjectId } = require('../../../../app/src/infrastructure/mongodb')
const UserModel = require('../../../../app/src/models/User').User
const UserUpdater = require('../../../../app/src/Features/User/UserUpdater')
const AuthenticationManager = require('../../../../app/src/Features/Authentication/AuthenticationManager')
const { promisify } = require('util')
const fs = require('fs')
const Path = require('path')

let count = settings.test.counterInit

class User {
  constructor(options) {
    if (options == null) {
      options = {}
    }
    this.emails = [
      {
        email: options.email || `acceptance-test-${count}@example.com`,
        createdAt: new Date(),
        confirmedAt: options.confirmedAt,
      },
    ]
    this.email = this.emails[0].email
    this.password = `a-terrible-secret-${count}`
    count++
    this.jar = request.jar()
    this.request = request.defaults({
      jar: this.jar,
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

  getAuditLog(callback) {
    this.get((error, user) => {
      if (error) return callback(error)
      if (!user) return callback(new Error('User not found'))

      db.userAuditLogEntries
        .find({ userId: ObjectId(this._id) })
        .toArray((error, auditLog) => {
          if (error) return callback(error)
          callback(null, auditLog || [])
        })
    })
  }

  getAuditLogWithoutNoise(callback) {
    this.getAuditLog((error, auditLog) => {
      if (error) return callback(error)
      callback(
        null,
        auditLog.filter(entry => {
          return entry.operation !== 'login'
        })
      )
    })
  }

  mongoUpdate(updateOp, callback) {
    db.users.updateOne({ _id: ObjectId(this._id) }, updateOp, callback)
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
          json: { email: this.email, password: this.password },
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
      this.loginWithEmailPassword(email, this.password, callback)
    })
  }

  loginNoUpdate(callback) {
    this.loginWithEmailPassword(this.email, this.password, callback)
  }

  loginWithEmailPassword(email, password, callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
        {
          url: settings.enableLegacyLogin ? '/login/legacy' : '/login',
          json: {
            email,
            password,
            'g-recaptcha-response': 'valid',
          },
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          // get new csrf token, then return result of login
          this.getCsrfToken(err => {
            if (err) {
              return callback(err)
            }
            callback(null, response, body)
          })
        }
      )
    })
  }

  ensureUserExists(callback) {
    const filter = { email: this.email }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }

    AuthenticationManager.hashPassword(
      this.password,
      (error, hashedPassword) => {
        if (error != null) {
          return callback(error)
        }

        UserModel.findOneAndUpdate(
          filter,
          { $set: { hashedPassword, emails: this.emails } },
          options,
          (error, user) => {
            if (error != null) {
              return callback(error)
            }

            this.setExtraAttributes(user)
            callback(null, this.password)
          }
        )
      }
    )
  }

  setFeatures(features, callback) {
    const update = {}
    for (const key in features) {
      const value = features[key]
      update[`features.${key}`] = value
    }
    UserModel.updateOne({ _id: this.id }, update, callback)
  }

  setFeaturesOverride(featuresOverride, callback) {
    const update = { $push: { featuresOverrides: featuresOverride } }
    UserModel.updateOne({ _id: this.id }, update, callback)
  }

  setOverleafId(overleafId, callback) {
    UserModel.updateOne(
      { _id: this.id },
      { 'overleaf.id': overleafId },
      callback
    )
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
            password: this.password,
          },
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
    UserUpdater.addEmailAddress(
      this.id,
      email,
      {},
      { initiatorId: this._id, ipAddress: '127:0:0:0' },
      callback
    )
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
    this.mongoUpdate({ $set: { isAdmin: true } }, callback)
  }

  ensureStaffAccess(flag, callback) {
    const update = { $set: {} }
    update.$set[`staffAccess.${flag}`] = true
    this.mongoUpdate(update, callback)
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
      trackChangesVisible: true,
    }
    this.mongoUpdate({ $set: { features } }, callback)
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
      trackChangesVisible: false,
    }
    this.mongoUpdate({ $set: { features } }, callback)
  }

  defaultFeatures(callback) {
    const features = settings.defaultFeatures
    this.mongoUpdate({ $set: { features } }, callback)
  }

  getFeatures(callback) {
    db.users.findOne(
      { _id: ObjectId(this.id) },
      { projection: { features: 1 } },
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
      db.projects.deleteMany({ owner_ref: ObjectId(userId) }, err => {
        if (err != null) {
          callback(err)
        }
        db.users.deleteOne({ _id: ObjectId(userId) }, callback)
      })
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
          json: { password: this.password },
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
    db.projects.updateOne({ _id: project._id }, { $set: project }, callback)
  }

  createProject(name, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    this.request.post(
      {
        url: '/project/new',
        json: Object.assign({ projectName: name }, options),
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
              response.headers.location,
              body,
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
        url: `/project/${projectId}`,
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        callback(null)
      }
    )
  }

  undeleteProject(projectId, callback) {
    this.request.post(
      {
        url: `/admin/project/${projectId}/undelete`,
      },
      (error, response) => {
        if (error) {
          return callback(error)
        }
        if (response.statusCode !== 204) {
          return callback(
            new Error(
              `Non-success response when undeleting project: ${response.statusCode}`
            )
          )
        }
        callback(null)
      }
    )
  }

  deleteProjects(callback) {
    db.projects.deleteMany({ owner_ref: ObjectId(this.id) }, callback)
  }

  openProject(projectId, callback) {
    this.request.get(
      {
        url: `/project/${projectId}`,
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
            parentFolderId,
          },
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

  uploadFileInProject(projectId, folderId, file, name, contentType, callback) {
    const imageFile = fs.createReadStream(
      Path.resolve(Path.join(__dirname, '..', '..', 'files', file))
    )

    this.request.post(
      {
        uri: `project/${projectId}/upload`,
        qs: {
          folder_id: String(folderId),
        },
        formData: {
          name,
          qqfile: {
            value: imageFile,
            options: {
              filename: name,
              contentType,
            },
          },
        },
      },
      (error, res, body) => {
        if (error) {
          return callback(error)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(new Error(`failed to upload file ${res.statusCode}`))
        }

        callback(null, JSON.parse(body).entity_id)
      }
    )
  }

  uploadExampleFileInProject(projectId, folderId, name, callback) {
    this.uploadFileInProject(
      projectId,
      folderId,
      '1pixel.png',
      name,
      'image/png',
      callback
    )
  }

  moveItemInProject(projectId, type, itemId, folderId, callback) {
    this.request.post(
      {
        uri: `project/${projectId}/${type}/${itemId}/move`,
        json: {
          folder_id: folderId,
        },
      },
      (error, res) => {
        if (error) {
          return callback(error)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(new Error(`failed to move ${type} ${res.statusCode}`))
        }

        callback()
      }
    )
  }

  renameItemInProject(projectId, type, itemId, name, callback) {
    this.request.post(
      {
        uri: `project/${projectId}/${type}/${itemId}/rename`,
        json: {
          name,
        },
      },
      (error, res) => {
        if (error) {
          return callback(error)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(
            new Error(`failed to rename ${type} ${res.statusCode}`)
          )
        }

        callback()
      }
    )
  }

  deleteItemInProject(projectId, type, itemId, callback) {
    this.request.delete(
      `project/${projectId}/${type}/${itemId}`,
      (error, res) => {
        if (error) {
          return callback(error)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(
            new Error(`failed to delete ${type} ${res.statusCode}`)
          )
        }
        callback()
      }
    )
  }

  joinProject(projectId, callback) {
    this.request.post(
      {
        url: `/project/${projectId}/join`,
        qs: { user_id: this._id },
        auth: {
          user: settings.apis.web.user,
          pass: settings.apis.web.pass,
          sendImmediately: true,
        },
        json: true,
        jar: false,
      },
      (error, res, body) => {
        if (error) {
          return callback(error)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(
            new Error(`failed to join project ${projectId} ${res.statusCode}`)
          )
        }
        callback(null, body)
      }
    )
  }

  addUserToProject(projectId, user, privileges, callback) {
    let updateOp
    if (privileges === 'readAndWrite') {
      updateOp = { $addToSet: { collaberator_refs: user._id } }
    } else if (privileges === 'readOnly') {
      updateOp = { $addToSet: { readOnly_refs: user._id } }
    }
    db.projects.updateOne({ _id: ObjectId(projectId) }, updateOp, callback)
  }

  makePublic(projectId, level, callback) {
    // A fudge, to get around the fact that `readOnly` and `readAndWrite` are now disallowed
    // via the API, but we still need to test the behaviour of projects with these values set.
    db.projects.updateOne(
      { _id: ObjectId(projectId) },
      // NOTE: Yes, there is a typo in the db schema.
      { $set: { publicAccesLevel: level } },
      callback
    )
  }

  makePrivate(projectId, callback) {
    this.request.post(
      {
        url: `/project/${projectId}/settings/admin`,
        json: {
          publicAccessLevel: 'private',
        },
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
          publicAccessLevel: 'tokenBased',
        },
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
        url: '/dev/csrf',
      },
      (err, response, body) => {
        if (err != null) {
          return callback(err)
        }
        this.csrfToken = body
        this.request = this.request.defaults({
          headers: {
            'x-csrf-token': this.csrfToken,
          },
        })
        callback()
      }
    )
  }

  changePassword(newPassword, callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
        {
          url: '/user/password/update',
          json: {
            currentPassword: this.password,
            newPassword1: newPassword,
            newPassword2: newPassword,
          },
        },
        err => {
          if (err) {
            return callback(err)
          }
          this.password = newPassword
          callback()
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
            email: userEmail,
          },
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
          url: '/user/settings',
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

  updateSettings(newSettings, callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
        {
          url: '/user/settings',
          json: newSettings,
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
          url: '/project',
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
            `unexpected status code from /user/personal_info: ${response.statusCode}`
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
            user_id: userId.toString(),
          },
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
    UserModel.updateOne(
      {
        _id: this._id,
      },
      {
        overleaf: {
          id: v1Id,
        },
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
          json: info,
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
