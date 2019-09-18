/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-path-concat,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let generateThemeList, ProjectController
const async = require('async')
const logger = require('logger-sharelatex')
const projectDeleter = require('./ProjectDeleter')
const projectDuplicator = require('./ProjectDuplicator')
const projectCreationHandler = require('./ProjectCreationHandler')
const editorController = require('../Editor/EditorController')
const ProjectHelper = require('./ProjectHelper')
const metrics = require('metrics-sharelatex')
const { User } = require('../../models/User')
const TagsHandler = require('../Tags/TagsHandler')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const NotificationsHandler = require('../Notifications/NotificationsHandler')
const LimitationsManager = require('../Subscription/LimitationsManager')
const underscore = require('underscore')
const Settings = require('settings-sharelatex')
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const fs = require('fs')
const InactiveProjectManager = require('../InactiveData/InactiveProjectManager')
const ProjectUpdateHandler = require('./ProjectUpdateHandler')
const ProjectGetter = require('./ProjectGetter')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const AuthenticationController = require('../Authentication/AuthenticationController')
const PackageVersions = require('../../infrastructure/PackageVersions')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const Sources = require('../Authorization/Sources')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const Modules = require('../../infrastructure/Modules')
const ProjectEntityHandler = require('./ProjectEntityHandler')
const UserGetter = require('../User/UserGetter')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const crypto = require('crypto')
const { V1ConnectionError } = require('../Errors/Errors')
const Features = require('../../infrastructure/Features')
const BrandVariationsHandler = require('../BrandVariations/BrandVariationsHandler')
const { getUserAffiliations } = require('../Institutions/InstitutionsAPI')
const V1Handler = require('../V1/V1Handler')

module.exports = ProjectController = {
  _isInPercentageRollout(rolloutName, objectId, percentage) {
    if (Settings.bypassPercentageRollouts === true) {
      return true
    }
    const data = `${rolloutName}:${objectId.toString()}`
    const md5hash = crypto
      .createHash('md5')
      .update(data)
      .digest('hex')
    const counter = parseInt(md5hash.slice(26, 32), 16)
    return counter % 100 < percentage
  },

  updateProjectSettings(req, res, next) {
    const project_id = req.params.Project_id

    const jobs = []

    if (req.body.compiler != null) {
      jobs.push(callback =>
        editorController.setCompiler(project_id, req.body.compiler, callback)
      )
    }

    if (req.body.imageName != null) {
      jobs.push(callback =>
        editorController.setImageName(project_id, req.body.imageName, callback)
      )
    }

    if (req.body.name != null) {
      jobs.push(callback =>
        editorController.renameProject(project_id, req.body.name, callback)
      )
    }

    if (req.body.spellCheckLanguage != null) {
      jobs.push(callback =>
        editorController.setSpellCheckLanguage(
          project_id,
          req.body.spellCheckLanguage,
          callback
        )
      )
    }

    if (req.body.rootDocId != null) {
      jobs.push(callback =>
        editorController.setRootDoc(project_id, req.body.rootDocId, callback)
      )
    }

    return async.series(jobs, function(error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  },

  updateProjectAdminSettings(req, res, next) {
    const project_id = req.params.Project_id

    const jobs = []
    if (req.body.publicAccessLevel != null) {
      jobs.push(callback =>
        editorController.setPublicAccessLevel(
          project_id,
          req.body.publicAccessLevel,
          callback
        )
      )
    }

    return async.series(jobs, function(error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  },

  deleteProject(req, res) {
    const project_id = req.params.Project_id
    const forever = (req.query != null ? req.query.forever : undefined) != null
    logger.log({ project_id, forever }, 'received request to archive project')
    const user = AuthenticationController.getSessionUser(req)
    const cb = function(err) {
      if (err != null) {
        return res.sendStatus(500)
      } else {
        return res.sendStatus(200)
      }
    }

    if (forever) {
      return projectDeleter.deleteProject(
        project_id,
        { deleterUser: user, ipAddress: req.ip },
        cb
      )
    } else {
      return projectDeleter.archiveProject(project_id, cb)
    }
  },

  expireDeletedProjectsAfterDuration(req, res) {
    logger.log(
      'received request to look for old deleted projects and expire them'
    )
    projectDeleter.expireDeletedProjectsAfterDuration(function(err) {
      if (err != null) {
        return res.sendStatus(500)
      } else {
        return res.sendStatus(200)
      }
    })
  },

  expireDeletedProject(req, res, next) {
    const { projectId } = req.params
    logger.log('received request to expire deleted project', { projectId })
    projectDeleter.expireDeletedProject(projectId, function(err) {
      if (err != null) {
        return next(err)
      } else {
        return res.sendStatus(200)
      }
    })
  },

  restoreProject(req, res) {
    const project_id = req.params.Project_id
    logger.log({ project_id }, 'received request to restore project')
    return projectDeleter.restoreProject(project_id, function(err) {
      if (err != null) {
        return res.sendStatus(500)
      } else {
        return res.sendStatus(200)
      }
    })
  },

  cloneProject(req, res, next) {
    res.setTimeout(5 * 60 * 1000) // allow extra time for the copy to complete
    metrics.inc('cloned-project')
    const project_id = req.params.Project_id
    const { projectName } = req.body
    logger.log({ project_id, projectName }, 'cloning project')
    if (!AuthenticationController.isUserLoggedIn(req)) {
      return res.send({ redir: '/register' })
    }
    const currentUser = AuthenticationController.getSessionUser(req)
    return projectDuplicator.duplicate(
      currentUser,
      project_id,
      projectName,
      function(err, project) {
        if (err != null) {
          logger.warn(
            { err, project_id, user_id: currentUser._id },
            'error cloning project'
          )
          return next(err)
        }
        return res.send({
          name: project.name,
          project_id: project._id,
          owner_ref: project.owner_ref
        })
      }
    )
  },

  newProject(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    const projectName =
      req.body.projectName != null ? req.body.projectName.trim() : undefined
    const { template } = req.body
    logger.log(
      { user: user_id, projectType: template, name: projectName },
      'creating project'
    )
    return async.waterfall(
      [
        function(cb) {
          if (template === 'example') {
            return projectCreationHandler.createExampleProject(
              user_id,
              projectName,
              cb
            )
          } else {
            return projectCreationHandler.createBasicProject(
              user_id,
              projectName,
              cb
            )
          }
        }
      ],
      function(err, project) {
        if (err != null) {
          return next(err)
        }
        logger.log(
          { project, user: user_id, name: projectName, templateType: template },
          'created project'
        )
        return res.send({ project_id: project._id })
      }
    )
  },

  renameProject(req, res, next) {
    const project_id = req.params.Project_id
    const newName = req.body.newProjectName
    return editorController.renameProject(project_id, newName, function(err) {
      if (err != null) {
        return next(err)
      }
      return res.sendStatus(200)
    })
  },

  userProjectsJson(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return ProjectGetter.findAllUsersProjects(
      user_id,
      'name lastUpdated publicAccesLevel archived trashed owner_ref tokens',
      function(err, projects) {
        if (err != null) {
          return next(err)
        }
        projects = ProjectController._buildProjectList(projects, user_id)
          .filter(p => !ProjectHelper.isArchivedOrTrashed(p, user_id))
          .filter(p => !p.isV1Project)
          .map(p => ({ _id: p.id, name: p.name, accessLevel: p.accessLevel }))

        return res.json({ projects })
      }
    )
  },

  projectEntitiesJson(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    const project_id = req.params.Project_id
    return ProjectGetter.getProject(project_id, function(err, project) {
      if (err != null) {
        return next(err)
      }
      return ProjectEntityHandler.getAllEntitiesFromProject(project, function(
        err,
        docs,
        files
      ) {
        if (err != null) {
          return next(err)
        }
        const entities = docs
          .concat(files)
          .sort((a, b) => a.path > b.path) // Sort by path ascending
          .map(e => ({
            path: e.path,
            type: e.doc != null ? 'doc' : 'file'
          }))
        return res.json({ project_id, entities })
      })
    })
  },

  projectListPage(req, res, next) {
    const timer = new metrics.Timer('project-list')
    const user_id = AuthenticationController.getLoggedInUserId(req)
    const currentUser = AuthenticationController.getSessionUser(req)
    return async.parallel(
      {
        tags(cb) {
          return TagsHandler.getAllTags(user_id, cb)
        },
        notifications(cb) {
          return NotificationsHandler.getUserNotifications(user_id, cb)
        },
        projects(cb) {
          return ProjectGetter.findAllUsersProjects(
            user_id,
            'name lastUpdated lastUpdatedBy publicAccesLevel archived owner_ref tokens',
            cb
          )
        },
        v1Projects(cb) {
          if (!Features.hasFeature('overleaf-integration')) {
            return cb(null, null)
          }

          return Modules.hooks.fire('findAllV1Projects', user_id, function(
            error,
            projects
          ) {
            if (projects == null) {
              projects = []
            }
            if (error != null && error instanceof V1ConnectionError) {
              return cb(null, { projects: [], tags: [], noConnection: true })
            }
            return cb(error, projects[0])
          })
        }, // hooks.fire returns an array of results, only need first
        hasSubscription(cb) {
          return LimitationsManager.hasPaidSubscription(currentUser, function(
            error,
            hasPaidSubscription
          ) {
            if (error != null && error instanceof V1ConnectionError) {
              return cb(null, true)
            }
            return cb(error, hasPaidSubscription)
          })
        },
        user(cb) {
          return User.findById(
            user_id,
            'featureSwitches overleaf awareOfV2 features',
            cb
          )
        },
        userAffiliations(cb) {
          if (!Features.hasFeature('affiliations')) {
            return cb(null, null)
          }
          return getUserAffiliations(user_id, cb)
        }
      },
      function(err, results) {
        if (err != null) {
          logger.warn({ err }, 'error getting data for project list page')
          return next(err)
        }
        const v1Tags =
          (results.v1Projects != null ? results.v1Projects.tags : undefined) ||
          []
        const tags = results.tags.concat(v1Tags)
        const notifications = require('underscore').map(
          results.notifications,
          function(notification) {
            notification.html = req.i18n.translate(
              notification.templateKey,
              notification.messageOpts
            )
            return notification
          }
        )
        const portalTemplates = ProjectController._buildPortalTemplatesList(
          results.userAffiliations
        )
        const projects = ProjectController._buildProjectList(
          results.projects,
          user_id,
          results.v1Projects != null ? results.v1Projects.projects : undefined
        )
        const { user } = results
        const { userAffiliations } = results
        const warnings = ProjectController._buildWarningsList(
          results.v1Projects
        )

        // in v2 add notifications for matching university IPs
        if (Settings.overleaf != null) {
          UserGetter.getUser(user_id, { lastLoginIp: 1 }, function(
            error,
            user
          ) {
            if (req.ip !== user.lastLoginIp) {
              return NotificationsBuilder.ipMatcherAffiliation(user._id).create(
                req.ip
              )
            }
          })
        }

        return ProjectController._injectProjectUsers(projects, function(
          error,
          projects
        ) {
          if (error != null) {
            return next(error)
          }
          const viewModel = {
            title: 'your_projects',
            priority_title: true,
            projects,
            tags,
            notifications: notifications || [],
            portalTemplates,
            user,
            userAffiliations,
            hasSubscription: results.hasSubscription,
            isShowingV1Projects: results.v1Projects != null,
            warnings,
            zipFileSizeLimit: Settings.maxUploadSize
          }

          if (
            Settings.algolia &&
            Settings.algolia.app_id &&
            Settings.algolia.read_only_api_key
          ) {
            viewModel.showUserDetailsArea = true
            viewModel.algolia_api_key = Settings.algolia.read_only_api_key
            viewModel.algolia_app_id = Settings.algolia.app_id
          } else {
            viewModel.showUserDetailsArea = false
          }

          const paidUser =
            (user.features != null ? user.features.github : undefined) &&
            (user.features != null ? user.features.dropbox : undefined) // use a heuristic for paid account
          const freeUserProportion = 0.1
          const sampleFreeUser =
            parseInt(user._id.toString().slice(-2), 16) <
            freeUserProportion * 255
          const showFrontWidget = paidUser || sampleFreeUser
          logger.log(
            { paidUser, sampleFreeUser, showFrontWidget },
            'deciding whether to show front widget'
          )
          if (showFrontWidget) {
            viewModel.frontChatWidgetRoomId =
              Settings.overleaf != null
                ? Settings.overleaf.front_chat_widget_room_id
                : undefined
          }

          res.render('project/list', viewModel)
          return timer.done()
        })
      }
    )
  },

  loadEditor(req, res, next) {
    let anonymous, user_id
    const timer = new metrics.Timer('load-editor')
    if (!Settings.editorIsOpen) {
      return res.render('general/closed', { title: 'updating_site' })
    }

    if (AuthenticationController.isUserLoggedIn(req)) {
      user_id = AuthenticationController.getLoggedInUserId(req)
      anonymous = false
    } else {
      anonymous = true
      user_id = null
    }

    const project_id = req.params.Project_id
    logger.log({ project_id, anonymous, user_id }, 'loading editor')

    // record failures to load the custom websocket
    if ((req.query != null ? req.query.ws : undefined) === 'fallback') {
      metrics.inc('load-editor-ws-fallback')
    }

    return async.auto(
      {
        project(cb) {
          return ProjectGetter.getProject(
            project_id,
            {
              name: 1,
              lastUpdated: 1,
              track_changes: 1,
              owner_ref: 1,
              brandVariationId: 1,
              overleaf: 1,
              tokens: 1
            },
            function(err, project) {
              if (err != null) {
                return cb(err)
              }
              if (
                (project.overleaf != null ? project.overleaf.id : undefined) ==
                  null ||
                (project.tokens != null
                  ? project.tokens.readAndWrite
                  : undefined) == null ||
                Settings.projectImportingCheckMaxCreateDelta == null
              ) {
                return cb(null, project)
              }
              const createDelta =
                (new Date().getTime() -
                  new Date(project._id.getTimestamp()).getTime()) /
                1000
              if (
                !(createDelta < Settings.projectImportingCheckMaxCreateDelta)
              ) {
                return cb(null, project)
              }
              return V1Handler.getDocExported(
                project.tokens.readAndWrite,
                function(err, doc_exported) {
                  if (err != null) {
                    return next(err)
                  }
                  project.exporting = doc_exported.exporting
                  return cb(null, project)
                }
              )
            }
          )
        },
        user(cb) {
          if (user_id == null) {
            return cb(null, defaultSettingsForAnonymousUser(user_id))
          } else {
            return User.findById(user_id, function(err, user) {
              logger.log({ project_id, user_id }, 'got user')
              return cb(err, user)
            })
          }
        },
        subscription(cb) {
          if (user_id == null) {
            return cb()
          }
          return SubscriptionLocator.getUsersSubscription(user_id, cb)
        },
        activate(cb) {
          return InactiveProjectManager.reactivateProjectIfRequired(
            project_id,
            cb
          )
        },
        markAsOpened(cb) {
          // don't need to wait for this to complete
          ProjectUpdateHandler.markAsOpened(project_id, function() {})
          return cb()
        },
        isTokenMember(cb) {
          cb = underscore.once(cb)
          if (user_id == null) {
            return cb()
          }
          return CollaboratorsHandler.userIsTokenMember(user_id, project_id, cb)
        },
        brandVariation: [
          'project',
          function(cb, results) {
            if (
              (results.project != null
                ? results.project.brandVariationId
                : undefined) == null
            ) {
              return cb()
            }
            return BrandVariationsHandler.getBrandVariationById(
              results.project.brandVariationId,
              (error, brandVariationDetails) => cb(error, brandVariationDetails)
            )
          }
        ]
      },
      function(err, results) {
        if (err != null) {
          logger.warn({ err }, 'error getting details for project page')
          return next(err)
        }
        const { project } = results
        const { user } = results
        const { subscription } = results
        const { brandVariation } = results

        const daysSinceLastUpdated =
          (new Date() - project.lastUpdated) / 86400000
        logger.log(
          { project_id, daysSinceLastUpdated },
          'got db results for loading editor'
        )

        const token = TokenAccessHandler.getRequestToken(req, project_id)
        const { isTokenMember } = results
        return AuthorizationManager.getPrivilegeLevelForProject(
          user_id,
          project_id,
          token,
          function(error, privilegeLevel) {
            let allowedFreeTrial
            if (error != null) {
              return next(error)
            }
            if (
              privilegeLevel == null ||
              privilegeLevel === PrivilegeLevels.NONE
            ) {
              return res.sendStatus(401)
            }

            if (project.exporting) {
              res.render('project/importing', { bodyClasses: ['editor'] })
              return
            }

            if (
              subscription != null &&
              subscription.freeTrial != null &&
              subscription.freeTrial.expiresAt != null
            ) {
              allowedFreeTrial = !!subscription.freeTrial.allowed || true
            }

            logger.log({ project_id }, 'rendering editor page')
            res.render('project/editor', {
              title: project.name,
              priority_title: true,
              bodyClasses: ['editor'],
              project_id: project._id,
              user: {
                id: user_id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                referal_id: user.referal_id,
                signUpDate: user.signUpDate,
                subscription: {
                  freeTrial: { allowed: allowedFreeTrial }
                },
                featureSwitches: user.featureSwitches,
                features: user.features,
                refProviders: user.refProviders,
                betaProgram: user.betaProgram,
                isAdmin: user.isAdmin
              },
              userSettings: {
                mode: user.ace.mode,
                editorTheme: user.ace.theme,
                fontSize: user.ace.fontSize,
                autoComplete: user.ace.autoComplete,
                autoPairDelimiters: user.ace.autoPairDelimiters,
                pdfViewer: user.ace.pdfViewer,
                syntaxValidation: user.ace.syntaxValidation,
                fontFamily: user.ace.fontFamily,
                lineHeight: user.ace.lineHeight,
                overallTheme: user.ace.overallTheme
              },
              trackChangesState: project.track_changes,
              privilegeLevel,
              chatUrl: Settings.apis.chat.url,
              anonymous,
              anonymousAccessToken: req._anonymousAccessToken,
              isTokenMember,
              isRestrictedTokenMember:
                isTokenMember === true && privilegeLevel === 'readOnly',
              languages: Settings.languages,
              editorThemes: THEME_LIST,
              maxDocLength: Settings.max_doc_length,
              useV2History: !!__guard__(
                project.overleaf != null ? project.overleaf.history : undefined,
                x => x.display
              ),
              showTestControls:
                (req.query != null ? req.query.tc : undefined) === 'true' ||
                user.isAdmin,
              brandVariation,
              allowedImageNames: Settings.allowedImageNames || [],
              gitBridgePublicBaseUrl: Settings.gitBridgePublicBaseUrl
            })
            return timer.done()
          }
        )
      }
    )
  },

  _buildProjectList(allProjects, userId, v1Projects) {
    let project
    if (v1Projects == null) {
      v1Projects = []
    }
    const {
      owned,
      readAndWrite,
      readOnly,
      tokenReadAndWrite,
      tokenReadOnly
    } = allProjects
    const projects = []
    for (project of Array.from(owned)) {
      projects.push(
        ProjectController._buildProjectViewModel(
          project,
          'owner',
          Sources.OWNER,
          userId
        )
      )
    }
    // Invite-access
    for (project of Array.from(readAndWrite)) {
      projects.push(
        ProjectController._buildProjectViewModel(
          project,
          'readWrite',
          Sources.INVITE,
          userId
        )
      )
    }
    for (project of Array.from(readOnly)) {
      projects.push(
        ProjectController._buildProjectViewModel(
          project,
          'readOnly',
          Sources.INVITE,
          userId
        )
      )
    }
    for (project of Array.from(v1Projects)) {
      projects.push(ProjectController._buildV1ProjectViewModel(project))
    }
    // Token-access
    //   Only add these projects if they're not already present, this gives us cascading access
    //   from 'owner' => 'token-read-only'
    for (project of Array.from(tokenReadAndWrite)) {
      if (
        projects.filter(p => p.id.toString() === project._id.toString())
          .length === 0
      ) {
        projects.push(
          ProjectController._buildProjectViewModel(
            project,
            'readAndWrite',
            Sources.TOKEN,
            userId
          )
        )
      }
    }
    for (project of Array.from(tokenReadOnly)) {
      if (
        projects.filter(p => p.id.toString() === project._id.toString())
          .length === 0
      ) {
        projects.push(
          ProjectController._buildProjectViewModel(
            project,
            'readOnly',
            Sources.TOKEN,
            userId
          )
        )
      }
    }

    return projects
  },

  _buildProjectViewModel(project, accessLevel, source, userId) {
    TokenAccessHandler.protectTokens(project, accessLevel)
    const model = {
      id: project._id,
      name: project.name,
      lastUpdated: project.lastUpdated,
      lastUpdatedBy: project.lastUpdatedBy,
      publicAccessLevel: project.publicAccesLevel,
      accessLevel,
      source,
      archived: ProjectHelper.isArchived(project, userId),
      owner_ref: project.owner_ref,
      tokens: project.tokens,
      isV1Project: false
    }
    if (accessLevel === PrivilegeLevels.READ_ONLY && source === Sources.TOKEN) {
      model.owner_ref = null
      model.lastUpdatedBy = null
    }
    return model
  },

  _buildV1ProjectViewModel(project) {
    const projectViewModel = {
      id: project.id,
      name: project.title,
      lastUpdated: new Date(project.updated_at * 1000), // Convert from epoch
      archived: project.removed || project.archived,
      isV1Project: true
    }
    if (
      (project.owner != null && project.owner.user_is_owner) ||
      (project.creator != null && project.creator.user_is_creator)
    ) {
      projectViewModel.accessLevel = 'owner'
    } else {
      projectViewModel.accessLevel = 'readOnly'
    }
    if (project.owner != null) {
      projectViewModel.owner = {
        first_name: project.owner.name
      }
    } else if (project.creator != null) {
      projectViewModel.owner = {
        first_name: project.creator.name
      }
    }
    return projectViewModel
  },

  _injectProjectUsers(projects, callback) {
    let project
    if (callback == null) {
      callback = function(error, projects) {}
    }
    const users = {}
    for (project of Array.from(projects)) {
      if (project.owner_ref != null) {
        users[project.owner_ref.toString()] = true
      }
      if (project.lastUpdatedBy != null) {
        users[project.lastUpdatedBy.toString()] = true
      }
    }

    const jobs = []
    for (let user_id in users) {
      const _ = users[user_id]
      ;(user_id =>
        jobs.push(callback =>
          UserGetter.getUserOrUserStubById(
            user_id,
            { first_name: 1, last_name: 1, email: 1 },
            function(error, user) {
              if (error != null) {
                return callback(error)
              }
              users[user_id] = user
              return callback()
            }
          )
        ))(user_id)
    }

    return async.series(jobs, function(error) {
      for (project of Array.from(projects)) {
        if (project.owner_ref != null) {
          project.owner = users[project.owner_ref.toString()]
        }
        if (project.lastUpdatedBy != null) {
          project.lastUpdatedBy =
            users[project.lastUpdatedBy.toString()] || null
        }
      }
      return callback(null, projects)
    })
  },

  _buildWarningsList(v1ProjectData) {
    if (v1ProjectData == null) {
      v1ProjectData = {}
    }
    const warnings = []
    if (v1ProjectData.noConnection && Settings.overleaf) {
      warnings.push('No V1 Connection')
    }
    if (v1ProjectData.hasHiddenV1Projects) {
      warnings.push(
        "Looks like you've got a lot of V1 projects! Some of them may be hidden on V2. To view them all, use the V1 dashboard."
      )
    }
    return warnings
  },

  _buildPortalTemplatesList(affiliations) {
    if (affiliations == null) {
      affiliations = []
    }
    const portalTemplates = []
    for (let aff of Array.from(affiliations)) {
      if (
        aff.portal &&
        aff.portal.slug &&
        aff.portal.templates_count &&
        aff.portal.templates_count > 0
      ) {
        const portalPath = aff.institution.isUniversity ? '/edu/' : '/org/'
        portalTemplates.push({
          name: aff.institution.name,
          url: Settings.siteUrl + portalPath + aff.portal.slug
        })
      }
    }
    return portalTemplates
  }
}

var defaultSettingsForAnonymousUser = user_id => ({
  id: user_id,
  ace: {
    mode: 'none',
    theme: 'textmate',
    fontSize: '12',
    autoComplete: true,
    spellCheckLanguage: '',
    pdfViewer: '',
    syntaxValidation: true
  },
  subscription: {
    freeTrial: {
      allowed: true
    }
  },
  featureSwitches: {
    github: false
  }
})

var THEME_LIST = []
;(generateThemeList = function() {
  const files = fs.readdirSync(
    __dirname + '/../../../../public/js/' + PackageVersions.lib('ace')
  )
  return (() => {
    const result = []
    for (let file of Array.from(files)) {
      if (file.slice(-2) === 'js' && /^theme-/.test(file)) {
        const cleanName = file.slice(0, -3).slice(6)
        result.push(THEME_LIST.push(cleanName))
      } else {
        result.push(undefined)
      }
    }
    return result
  })()
})()

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
