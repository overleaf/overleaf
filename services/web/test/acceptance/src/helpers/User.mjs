import OError from '@overleaf/o-error'
import request from './request.js'
import settings from '@overleaf/settings'
import { db, ObjectId } from '../../../../app/src/infrastructure/mongodb.mjs'
import { User as UserModel } from '../../../../app/src/models/User.mjs'
import UserUpdater from '../../../../app/src/Features/User/UserUpdater.mjs'
import AuthenticationManager from '../../../../app/src/Features/Authentication/AuthenticationManager.mjs'
import { promisifyClass } from '@overleaf/promise-utils'
import fs from 'node:fs'
import Path from 'node:path'
import { Cookie } from 'tough-cookie'

const COOKIE_DOMAIN = settings.cookieDomain
// The cookie domain has a leading '.' but the cookie jar stores it without.
const DEFAULT_COOKIE_URL = `https://${COOKIE_DOMAIN.replace(/^\./, '')}/`

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
    this.signUpDate = options.signUpDate ?? new Date()
    this.labsProgram = options.labsProgram || false
  }

  getSession(options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    this.request.get(
      {
        url: '/dev/session',
        qs: options.set,
      },
      (err, response, body) => {
        if (err != null) {
          return callback(err)
        }
        if (response.statusCode !== 200) {
          return callback(
            new Error(
              `get session failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
        }

        const session = JSON.parse(response.body)
        callback(null, session)
      }
    )
  }

  setInSession(params, callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
        {
          url: '/dev/set_in_session',
          json: params,
        },
        (err, response, body) => {
          if (err != null) {
            return callback(err)
          }
          if (response.statusCode !== 200) {
            return callback(
              new Error(
                `post set in session failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`
              )
            )
          }
          callback(null)
        }
      )
    })
  }

  getSplitTestAssignment(splitTestName, query, callback) {
    if (!callback) {
      callback = query
    }
    const params = new URLSearchParams({
      splitTestName,
      ...query,
    }).toString()
    this.request.get(
      {
        url: `/dev/split_test/get_assignment?${params}`,
      },
      (err, response, body) => {
        if (err != null) {
          return callback(err)
        }
        if (response.statusCode !== 200) {
          return callback(
            new Error(
              `get split test assignment failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
        }
        const assignment = JSON.parse(response.body)
        callback(null, assignment)
      }
    )
  }

  doSessionMaintenance(callback) {
    this.request.post(
      {
        url: `/dev/split_test/session_maintenance`,
      },
      (err, response, body) => {
        if (err != null) {
          return callback(err)
        }
        if (response.statusCode !== 200) {
          return callback(
            new Error(
              `post session maintenance failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
        }
        callback(null)
      }
    )
  }

  optIntoBeta(callback) {
    this.request.post(
      {
        url: '/beta/opt-in',
      },
      (err, response, body) => {
        if (err != null) {
          return callback(err)
        }
        if (response.statusCode !== 302) {
          return callback(
            new Error(
              `post beta opt-in failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
        }
        callback(null)
      }
    )
  }

  optOutOfBeta(callback) {
    this.request.post(
      {
        url: '/beta/opt-out',
      },
      (err, response, body) => {
        if (err != null) {
          return callback(err)
        }
        if (response.statusCode !== 302) {
          return callback(
            new Error(
              `post beta opt-out failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
        }
        callback(null)
      }
    )
  }

  /* Return the session cookie, url decoded. Use the option {raw:true} to get the original undecoded value */

  sessionCookie(options) {
    const cookie = Cookie.parse(this.jar.getCookieString(DEFAULT_COOKIE_URL))
    if (cookie?.value && !options?.raw) {
      cookie.value = decodeURIComponent(cookie.value)
    }
    return cookie
  }

  /* Set the session cookie from a string and store it in the cookie jar, so that it will be used
     for subsequent requests. */

  setSessionCookie(cookie) {
    const sessionCookie = request.cookie(
      `${settings.cookieName}=${cookie}; Domain=${COOKIE_DOMAIN}; Max-age=3600; Path=/; SameSite=Lax`
    )
    this.jar.setCookie(sessionCookie, DEFAULT_COOKIE_URL)
  }

  getEmailConfirmationCode(callback) {
    this.getSession((err, session) => {
      if (err != null) {
        return callback(err)
      }

      const code = session.pendingUserRegistration?.confirmCode
      if (!code) {
        return callback(new Error('No confirmation code found in session'))
      }

      callback(null, code)
    })
  }

  resetCookies() {
    this.jar = request.jar()
    this.request = request.defaults({
      jar: this.jar,
    })
  }

  setExtraAttributes(user) {
    if (!user?._id) {
      throw new Error('User does not exist')
    }
    this.id = user._id.toString()
    this._id = user._id.toString()
    this.first_name = user.first_name
    this.referal_id = user.referal_id
    this.enrollment = user.enrollment
  }

  get(callback) {
    db.users.findOne({ _id: new ObjectId(this._id) }, callback)
  }

  getAuditLog(callback) {
    this.get((error, user) => {
      if (error) {
        return callback(error)
      }
      if (!user) {
        return callback(new Error('User not found'))
      }

      db.userAuditLogEntries
        .find({ userId: new ObjectId(this._id) })
        // Explicitly sort in ascending chronological order
        .sort({ timestamp: 1 })
        .toArray((error, auditLog) => {
          if (error) {
            return callback(error)
          }
          callback(null, auditLog || [])
        })
    })
  }

  getAuditLogWithoutNoise(callback) {
    this.getAuditLog((error, auditLog) => {
      if (error) {
        return callback(error)
      }
      callback(
        null,
        auditLog.filter(entry => {
          return entry.operation !== 'login'
        })
      )
    })
  }

  mongoUpdate(updateOp, callback) {
    db.users.updateOne({ _id: new ObjectId(this._id) }, updateOp, callback)
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
          if (response.statusCode !== 200) {
            return callback(
              new Error(
                `register failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`
              )
            )
          }

          this.getEmailConfirmationCode((error, code) => {
            if (error != null) {
              return callback(error)
            }

            this.request.post(
              {
                url: '/registration/confirm-email',
                json: { code },
              },
              (error, response, body) => {
                if (error != null) {
                  return callback(error)
                }
                if (response.statusCode !== 200) {
                  return callback(
                    new Error(
                      `email confirmation failed: status=${
                        response.statusCode
                      } body=${JSON.stringify(body)}`
                    )
                  )
                }

                db.users.findOne({ email: this.email }, (error, user) => {
                  if (error != null) {
                    return callback(error)
                  }
                  this.setExtraAttributes(user)
                  callback(null, user, response)
                })
              }
            )
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
          if (response.statusCode !== 200) {
            return callback(
              new OError(
                `login failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`,
                { response, body }
              )
            )
          }
          // get new csrf token, then return result of login
          this.getCsrfToken(err => {
            if (err) {
              return callback(OError.tag(err, 'after login'))
            }
            callback(null, response, body)
          })
        }
      )
    })
  }

  ensureUserExists(callback) {
    if (this._id) {
      return callback()
    } // already exists
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
          {
            $set: {
              hashedPassword,
              emails: this.emails,
              signUpDate: this.signUpDate,
              labsProgram: this.labsProgram,
            },
          },
          options
        )
          .then(user => {
            this.setExtraAttributes(user)
            callback(null, this.password)
          })
          .catch(callback)
      }
    )
  }

  // Update and persist feature upgrade. Downgrades will be flaky!
  upgradeFeatures(features, callback) {
    this.setFeatures(features, err => {
      if (err) {
        return callback(err)
      }
      // Persist the feature update, otherwise the next feature refresh will reset them.
      this.setFeaturesOverride(
        {
          createdAt: new Date(),
          note: 'Some note',
          features,
        },
        callback
      )
    })
  }

  // Low-level. Temporary feature change. A feature refresh might reset them, e.g. "some time" after logging in.
  setFeatures(features, callback) {
    const update = {}
    for (const key in features) {
      const value = features[key]
      update[`features.${key}`] = value
    }
    UserModel.updateOne({ _id: this.id }, update)
      .then((...args) => callback(null, ...args))
      .catch(callback)
  }

  // Low-level. Permanent feature change. Feature overrides are not applied right away. A feature refresh might populate them "some time" after login/changing subscriptions.
  setFeaturesOverride(featuresOverride, callback) {
    if (!featuresOverride?.features) {
      throw new Error('bad featuresOverride schema')
    }
    const update = { $push: { featuresOverrides: featuresOverride } }
    UserModel.updateOne({ _id: this.id }, update)
      .then((...args) => callback(null, ...args))
      .catch(callback)
  }

  setOverleafId(overleafId, callback) {
    UserModel.updateOne({ _id: this.id }, { 'overleaf.id': overleafId })
      .then((...args) => callback(null, ...args))
      .catch(callback)
  }

  setEmails(emails, callback) {
    UserModel.updateOne({ _id: this.id }, { emails })
      .then((...args) => callback(null, ...args))
      .catch(callback)
  }

  setSuspended(suspended, callback) {
    UserModel.updateOne({ _id: this.id }, { suspended })
      .then((...args) => callback(null, ...args))
      .catch(callback)
  }

  logout(callback) {
    this.getCsrfToken(error => {
      if (error != null) {
        return callback(error)
      }
      this.request.post(
        {
          url: '/logout',
        },
        (error, response, body) => {
          if (error != null) {
            return callback(error)
          }
          if (response.statusCode >= 400) {
            return callback(
              new Error(
                `logout failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`
              )
            )
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

  ensureAdminRole(role, callback) {
    this.mongoUpdate({ $addToSet: { adminRoles: role } }, callback)
  }

  upgradeSomeFeatures(callback) {
    const features = {
      collaborators: -1, // Infinite
      versioning: true,
      dropbox: true,
      compileTimeout: 60,
      compileGroup: 'priority',
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
      { _id: new ObjectId(this.id) },
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
      db.projects.deleteMany({ owner_ref: new ObjectId(userId) }, err => {
        if (err != null) {
          callback(err)
        }
        db.users.deleteOne({ _id: new ObjectId(userId) }, callback)
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
        (err, response, body) => {
          if (err) {
            return callback(err)
          }
          if (response.statusCode !== 200) {
            return callback(
              new Error(
                `user deletion failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`
              )
            )
          }
          callback()
        }
      )
    })
  }

  getProject(projectId, callback) {
    db.projects.findOne({ _id: new ObjectId(projectId.toString()) }, callback)
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
        if (response.statusCode !== 200) {
          return callback(
            new Error(
              `project creation failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
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
        if (response.statusCode !== 200) {
          return callback(
            new Error(
              `project deletion failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
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
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        if (response.statusCode !== 204) {
          return callback(
            new Error(
              `project un-deletion failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
        }
        callback(null)
      }
    )
  }

  deleteProjects(callback) {
    db.projects.deleteMany({ owner_ref: new ObjectId(this.id) }, callback)
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
          return callback(
            new Error(
              `opening project failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
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
          if (response.statusCode !== 200) {
            return callback(
              new Error(
                `doc creation in project failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`
              )
            )
          }
          callback(null, body._id)
        }
      )
    })
  }

  uploadFileInProject(projectId, folderId, file, name, contentType, callback) {
    this.uploadFileInProjectFull(
      projectId,
      folderId,
      file,
      name,
      contentType,
      (err, body) => callback(err, body?.entity_id)
    )
  }

  uploadFileInProjectFull(
    projectId,
    folderId,
    file,
    name,
    contentType,
    callback
  ) {
    const fileStream = fs.createReadStream(
      Path.resolve(Path.join(import.meta.dirname, '..', '..', 'files', file))
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
            value: fileStream,
            options: {
              filename: name,
              contentType,
            },
          },
        },
      },
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        if (response.statusCode !== 200) {
          return callback(
            new Error(
              `uploading file failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
        }

        callback(null, JSON.parse(body))
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
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        if (response.statusCode !== 200) {
          return callback(
            new Error(
              `move item in project failed: type=${type} status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
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
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        if (response.statusCode !== 204) {
          return callback(
            new Error(
              `rename item in project failed: type=${type} status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
        }

        callback()
      }
    )
  }

  deleteItemInProject(projectId, type, itemId, callback) {
    this.request.delete(
      `project/${projectId}/${type}/${itemId}`,
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        if (response.statusCode !== 204) {
          return callback(
            new Error(
              `delete item in project failed: type=${type} status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
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
        auth: {
          user: settings.apis.web.user,
          pass: settings.apis.web.pass,
          sendImmediately: true,
        },
        json: { userId: this._id },
        jar: false,
      },
      (error, response, body) => {
        if (error) {
          return callback(error)
        }
        if (response.statusCode !== 200) {
          return callback(
            new Error(
              `join project failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
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
    } else if (privileges === 'pendingEditor') {
      updateOp = {
        $addToSet: { readOnly_refs: user._id, pendingEditor_refs: user._id },
      }
    } else if (privileges === 'pendingReviewer') {
      updateOp = {
        $addToSet: { readOnly_refs: user._id, pendingReviewer_refs: user._id },
      }
    } else if (privileges === 'review') {
      updateOp = {
        $addToSet: { reviewer_refs: user._id },
      }
    }
    db.projects.updateOne({ _id: new ObjectId(projectId) }, updateOp, callback)
  }

  makePublic(projectId, level, callback) {
    // A fudge, to get around the fact that `readOnly` and `readAndWrite` are now disallowed
    // via the API, but we still need to test the behaviour of projects with these values set.
    db.projects.updateOne(
      { _id: new ObjectId(projectId) },
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
        if (response.statusCode !== 204) {
          return callback(
            new Error(
              `disable link sharing failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
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
        if (response.statusCode !== 204) {
          return callback(
            new Error(
              `enable link sharing failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
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
        if (response.statusCode !== 200) {
          return callback(
            new Error(
              `get csrf token failed: status=${
                response.statusCode
              } body=${JSON.stringify(body)}`
            )
          )
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
        (err, response, body) => {
          if (err) {
            return callback(err)
          }
          if (response.statusCode !== 200) {
            return callback(
              new Error(
                `change password failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`
              )
            )
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
        (error, response) => {
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
          if (response.statusCode !== 200) {
            return callback(
              new Error(
                `open settings page failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`
              )
            )
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
        (err, response, body) => {
          if (err) {
            return callback(err)
          }
          if (response.statusCode !== 200) {
            return callback(
              new Error(
                `update settings failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`
              )
            )
          }
          callback()
        }
      )
    })
  }

  getProjectListPage(callback) {
    this.request.get('/project', (error, response) => {
      if (error != null) {
        return callback(error)
      }
      callback(null, response.statusCode)
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
            `unexpected status code from /user/personal_info: status=${response.statusCode} body=${body}`
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
        (err, response, body) => {
          if (err != null) {
            return callback(err)
          }
          if (response.statusCode !== 204) {
            return callback(
              new Error(
                `transfer project ownership failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`
              )
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
      }
    )
      .then((...args) => callback(null, ...args))
      .catch(callback)
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
        (err, response, body) => {
          if (err != null) {
            return callback(err)
          }
          if (response.statusCode !== 204) {
            return callback(
              new Error(
                `update collaborator access failed: status=${
                  response.statusCode
                } body=${JSON.stringify(body)}`
              )
            )
          }
          callback()
        }
      )
    })
  }
}

User.promises = promisifyClass(User, {
  without: ['setExtraAttributes', 'sessionCookie', 'setSessionCookie'],
})

User.promises.prototype.doRequest = async function (method, params) {
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

export default User
