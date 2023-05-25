const _ = require('lodash')
const OError = require('@overleaf/o-error')
const crypto = require('crypto')
const async = require('async')
const logger = require('@overleaf/logger')
const { ObjectId } = require('mongodb')
const ProjectDeleter = require('./ProjectDeleter')
const ProjectDuplicator = require('./ProjectDuplicator')
const ProjectCreationHandler = require('./ProjectCreationHandler')
const EditorController = require('../Editor/EditorController')
const ProjectHelper = require('./ProjectHelper')
const metrics = require('@overleaf/metrics')
const { User } = require('../../models/User')
const SubscriptionLocator = require('../Subscription/SubscriptionLocator')
const LimitationsManager = require('../Subscription/LimitationsManager')
const Settings = require('@overleaf/settings')
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const InactiveProjectManager = require('../InactiveData/InactiveProjectManager')
const ProjectUpdateHandler = require('./ProjectUpdateHandler')
const ProjectGetter = require('./ProjectGetter')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const SessionManager = require('../Authentication/SessionManager')
const Sources = require('../Authorization/Sources')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')
const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
const ProjectEntityHandler = require('./ProjectEntityHandler')
const TpdsProjectFlusher = require('../ThirdPartyDataStore/TpdsProjectFlusher')
const UserGetter = require('../User/UserGetter')
const Features = require('../../infrastructure/Features')
const BrandVariationsHandler = require('../BrandVariations/BrandVariationsHandler')
const UserController = require('../User/UserController')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const SpellingHandler = require('../Spelling/SpellingHandler')
const { hasAdminAccess } = require('../Helpers/AdminAuthorizationHelper')
const InstitutionsFeatures = require('../Institutions/InstitutionsFeatures')
const ProjectAuditLogHandler = require('./ProjectAuditLogHandler')
const PublicAccessLevels = require('../Authorization/PublicAccessLevels')

const VISUAL_EDITOR_NAMING_SPLIT_TEST_MIN_SIGNUP_DATE = new Date('2023-04-17')

/**
 * @typedef {import("./types").GetProjectsRequest} GetProjectsRequest
 * @typedef {import("./types").GetProjectsResponse} GetProjectsResponse
 * @typedef {import("./types").Project} Project
 */

const ProjectController = {
  _isInPercentageRollout(rolloutName, objectId, percentage) {
    if (Settings.bypassPercentageRollouts === true) {
      return true
    }
    const data = `${rolloutName}:${objectId.toString()}`
    const md5hash = crypto.createHash('md5').update(data).digest('hex')
    const counter = parseInt(md5hash.slice(26, 32), 16)
    return counter % 100 < percentage
  },

  updateProjectSettings(req, res, next) {
    const projectId = req.params.Project_id

    const jobs = []

    if (req.body.compiler != null) {
      jobs.push(callback =>
        EditorController.setCompiler(projectId, req.body.compiler, callback)
      )
    }

    if (req.body.imageName != null) {
      jobs.push(callback =>
        EditorController.setImageName(projectId, req.body.imageName, callback)
      )
    }

    if (req.body.name != null) {
      jobs.push(callback =>
        EditorController.renameProject(projectId, req.body.name, callback)
      )
    }

    if (req.body.spellCheckLanguage != null) {
      jobs.push(callback =>
        EditorController.setSpellCheckLanguage(
          projectId,
          req.body.spellCheckLanguage,
          callback
        )
      )
    }

    if (req.body.rootDocId != null) {
      jobs.push(callback =>
        EditorController.setRootDoc(projectId, req.body.rootDocId, callback)
      )
    }

    async.series(jobs, error => {
      if (error != null) {
        return next(error)
      }
      res.sendStatus(204)
    })
  },

  updateProjectAdminSettings(req, res, next) {
    const projectId = req.params.Project_id
    const user = SessionManager.getSessionUser(req.session)
    const publicAccessLevel = req.body.publicAccessLevel
    const publicAccessLevels = [
      PublicAccessLevels.READ_ONLY,
      PublicAccessLevels.READ_AND_WRITE,
      PublicAccessLevels.PRIVATE,
      PublicAccessLevels.TOKEN_BASED,
    ]

    if (
      req.body.publicAccessLevel != null &&
      publicAccessLevels.includes(publicAccessLevel)
    ) {
      const jobs = []

      jobs.push(callback =>
        EditorController.setPublicAccessLevel(
          projectId,
          req.body.publicAccessLevel,
          callback
        )
      )

      jobs.push(callback =>
        ProjectAuditLogHandler.addEntry(
          projectId,
          'toggle-access-level',
          user._id,
          { publicAccessLevel: req.body.publicAccessLevel, status: 'OK' },
          callback
        )
      )

      async.series(jobs, error => {
        if (error != null) {
          return next(error)
        }
        res.sendStatus(204)
      })
    } else {
      res.sendStatus(500)
    }
  },

  deleteProject(req, res) {
    const projectId = req.params.Project_id
    const user = SessionManager.getSessionUser(req.session)
    const cb = err => {
      if (err != null) {
        res.sendStatus(500)
      } else {
        res.sendStatus(200)
      }
    }
    ProjectDeleter.deleteProject(
      projectId,
      { deleterUser: user, ipAddress: req.ip },
      cb
    )
  },

  archiveProject(req, res, next) {
    const projectId = req.params.Project_id
    const userId = SessionManager.getLoggedInUserId(req.session)

    ProjectDeleter.archiveProject(projectId, userId, function (err) {
      if (err != null) {
        next(err)
      } else {
        res.sendStatus(200)
      }
    })
  },

  unarchiveProject(req, res, next) {
    const projectId = req.params.Project_id
    const userId = SessionManager.getLoggedInUserId(req.session)

    ProjectDeleter.unarchiveProject(projectId, userId, function (err) {
      if (err != null) {
        next(err)
      } else {
        res.sendStatus(200)
      }
    })
  },

  trashProject(req, res, next) {
    const projectId = req.params.project_id
    const userId = SessionManager.getLoggedInUserId(req.session)

    ProjectDeleter.trashProject(projectId, userId, function (err) {
      if (err != null) {
        next(err)
      } else {
        res.sendStatus(200)
      }
    })
  },

  untrashProject(req, res, next) {
    const projectId = req.params.project_id
    const userId = SessionManager.getLoggedInUserId(req.session)

    ProjectDeleter.untrashProject(projectId, userId, function (err) {
      if (err != null) {
        next(err)
      } else {
        res.sendStatus(200)
      }
    })
  },

  expireDeletedProjectsAfterDuration(req, res) {
    ProjectDeleter.expireDeletedProjectsAfterDuration(err => {
      if (err != null) {
        res.sendStatus(500)
      } else {
        res.sendStatus(200)
      }
    })
  },

  expireDeletedProject(req, res, next) {
    const { projectId } = req.params
    ProjectDeleter.expireDeletedProject(projectId, err => {
      if (err != null) {
        next(err)
      } else {
        res.sendStatus(200)
      }
    })
  },

  restoreProject(req, res) {
    const projectId = req.params.Project_id
    ProjectDeleter.restoreProject(projectId, err => {
      if (err != null) {
        res.sendStatus(500)
      } else {
        res.sendStatus(200)
      }
    })
  },

  cloneProject(req, res, next) {
    res.setTimeout(5 * 60 * 1000) // allow extra time for the copy to complete
    metrics.inc('cloned-project')
    const projectId = req.params.Project_id
    const { projectName } = req.body
    logger.debug({ projectId, projectName }, 'cloning project')
    if (!SessionManager.isUserLoggedIn(req.session)) {
      return res.json({ redir: '/register' })
    }
    const currentUser = SessionManager.getSessionUser(req.session)
    const { first_name: firstName, last_name: lastName, email } = currentUser
    ProjectDuplicator.duplicate(
      currentUser,
      projectId,
      projectName,
      (err, project) => {
        if (err != null) {
          OError.tag(err, 'error cloning project', {
            projectId,
            userId: currentUser._id,
          })
          return next(err)
        }
        res.json({
          name: project.name,
          lastUpdated: project.lastUpdated,
          project_id: project._id,
          owner_ref: project.owner_ref,
          owner: {
            first_name: firstName,
            last_name: lastName,
            email,
            _id: currentUser._id,
          },
        })
      }
    )
  },

  newProject(req, res, next) {
    const currentUser = SessionManager.getSessionUser(req.session)
    const {
      first_name: firstName,
      last_name: lastName,
      email,
      _id: userId,
    } = currentUser
    const projectName =
      req.body.projectName != null ? req.body.projectName.trim() : undefined
    const { template } = req.body

    async.waterfall(
      [
        cb => {
          if (template === 'example') {
            ProjectCreationHandler.createExampleProject(userId, projectName, cb)
          } else {
            ProjectCreationHandler.createBasicProject(userId, projectName, cb)
          }
        },
      ],
      (err, project) => {
        if (err != null) {
          return next(err)
        }
        res.json({
          project_id: project._id,
          owner_ref: project.owner_ref,
          owner: {
            first_name: firstName,
            last_name: lastName,
            email,
            _id: userId,
          },
        })
      }
    )
  },

  renameProject(req, res, next) {
    const projectId = req.params.Project_id
    const newName = req.body.newProjectName
    EditorController.renameProject(projectId, newName, err => {
      if (err != null) {
        return next(err)
      }
      res.sendStatus(200)
    })
  },

  userProjectsJson(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    ProjectGetter.findAllUsersProjects(
      userId,
      'name lastUpdated publicAccesLevel archived trashed owner_ref tokens',
      (err, projects) => {
        if (err != null) {
          return next(err)
        }

        // _buildProjectList already converts archived/trashed to booleans so isArchivedOrTrashed should not be used here
        projects = ProjectController._buildProjectList(projects, userId)
          .filter(p => !(p.archived || p.trashed))
          .map(p => ({ _id: p.id, name: p.name, accessLevel: p.accessLevel }))

        res.json({ projects })
      }
    )
  },

  projectEntitiesJson(req, res, next) {
    const projectId = req.params.Project_id
    ProjectGetter.getProject(projectId, (err, project) => {
      if (err != null) {
        return next(err)
      }
      let docs, files
      try {
        ;({ docs, files } =
          ProjectEntityHandler.getAllEntitiesFromProject(project))
      } catch (err) {
        return next(err)
      }
      const entities = docs
        .concat(files)
        // Sort by path ascending
        .sort((a, b) => (a.path > b.path ? 1 : a.path < b.path ? -1 : 0))
        .map(e => ({
          path: e.path,
          type: e.doc != null ? 'doc' : 'file',
        }))
      res.json({ project_id: projectId, entities })
    })
  },

  loadEditor(req, res, next) {
    const timer = new metrics.Timer('load-editor')
    if (!Settings.editorIsOpen) {
      return res.render('general/closed', { title: 'updating_site' })
    }

    let anonymous, userId, sessionUser
    if (SessionManager.isUserLoggedIn(req.session)) {
      sessionUser = SessionManager.getSessionUser(req.session)
      userId = SessionManager.getLoggedInUserId(req.session)
      anonymous = false
    } else {
      sessionUser = null
      anonymous = true
      userId = null
    }

    const projectId = req.params.Project_id

    async.auto(
      {
        project(cb) {
          ProjectGetter.getProject(
            projectId,
            {
              name: 1,
              lastUpdated: 1,
              track_changes: 1,
              owner_ref: 1,
              brandVariationId: 1,
              overleaf: 1,
              tokens: 1,
            },
            (err, project) => {
              if (err != null) {
                return cb(err)
              }
              cb(null, project)
            }
          )
        },
        user(cb) {
          if (userId == null) {
            cb(null, defaultSettingsForAnonymousUser(userId))
          } else {
            User.updateOne(
              { _id: ObjectId(userId) },
              { $set: { lastActive: new Date() } },
              {},
              () => {}
            )
            User.findById(
              userId,
              'email first_name last_name referal_id signUpDate featureSwitches features featuresEpoch refProviders alphaProgram betaProgram isAdmin ace labsProgram labsProgramGalileo',
              (err, user) => {
                // Handle case of deleted user
                if (user == null) {
                  UserController.logout(req, res, next)
                  return
                }
                if (err) {
                  return cb(err)
                }
                logger.debug({ projectId, userId }, 'got user')
                if (FeaturesUpdater.featuresEpochIsCurrent(user)) {
                  return cb(null, user)
                }
                ProjectController._refreshFeatures(req, user, cb)
              }
            )
          }
        },
        userHasInstitutionLicence(cb) {
          if (!userId) {
            return cb(null, false)
          }
          InstitutionsFeatures.hasLicence(userId, (error, hasLicence) => {
            if (error) {
              // Don't fail if we can't get affiliation licences
              return cb(null, false)
            }
            cb(null, hasLicence)
          })
        },
        learnedWords(cb) {
          if (!userId) {
            return cb(null, [])
          }
          SpellingHandler.getUserDictionary(userId, cb)
        },
        subscription(cb) {
          if (userId == null) {
            return cb()
          }
          SubscriptionLocator.getUsersSubscription(userId, cb)
        },
        userIsMemberOfGroupSubscription(cb) {
          if (sessionUser == null) {
            return cb(null, false)
          }
          LimitationsManager.userIsMemberOfGroupSubscription(
            sessionUser,
            (error, isMember) => {
              cb(error, isMember)
            }
          )
        },
        activate(cb) {
          InactiveProjectManager.reactivateProjectIfRequired(projectId, cb)
        },
        markAsOpened(cb) {
          // don't need to wait for this to complete
          ProjectUpdateHandler.markAsOpened(projectId, () => {})
          cb()
        },
        isTokenMember(cb) {
          if (userId == null) {
            return cb()
          }
          CollaboratorsGetter.userIsTokenMember(userId, projectId, cb)
        },
        isInvitedMember(cb) {
          CollaboratorsGetter.isUserInvitedMemberOfProject(
            userId,
            projectId,
            cb
          )
        },
        brandVariation: [
          'project',
          (results, cb) => {
            if (
              (results.project != null
                ? results.project.brandVariationId
                : undefined) == null
            ) {
              return cb()
            }
            BrandVariationsHandler.getBrandVariationById(
              results.project.brandVariationId,
              (error, brandVariationDetails) => cb(error, brandVariationDetails)
            )
          },
        ],
        flushToTpds: cb => {
          TpdsProjectFlusher.flushProjectToTpdsIfNeeded(projectId, cb)
        },
        sharingModalSplitTest(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'project-share-modal-paywall',
            {},
            () => {
              // do not fail editor load if assignment fails
              cb()
            }
          )
        },
        sharingModalNullTest(cb) {
          // null test targeting logged in users, for front-end side
          SplitTestHandler.getAssignment(
            req,
            res,
            'null-test-share-modal',
            {},
            () => {
              // do not fail editor load if assignment fails
              cb()
            }
          )
        },
        participatingInVisualEditorNamingTest: [
          'user',
          (results, cb) => {
            const isNewUser =
              results.user.signUpDate >=
              VISUAL_EDITOR_NAMING_SPLIT_TEST_MIN_SIGNUP_DATE
            cb(null, isNewUser)
          },
        ],
        visualEditorNameAssignment: [
          'participatingInVisualEditorNamingTest',
          (results, cb) => {
            if (!results.participatingInVisualEditorNamingTest) {
              cb(null, { variant: 'default' })
            } else {
              SplitTestHandler.getAssignment(
                req,
                res,
                'visual-editor-name',
                (error, assignment) => {
                  if (error) {
                    cb(null, { variant: 'default' })
                  } else {
                    cb(null, assignment)
                  }
                }
              )
            }
          },
        ],
        legacySourceEditorAssignment: [
          'participatingInVisualEditorNamingTest',
          'visualEditorNameAssignment',
          (results, cb) => {
            // Hide Ace for people in the Rich Text naming test
            if (results.participatingInVisualEditorNamingTest) {
              cb(null, { variant: 'true' })
            } else {
              SplitTestHandler.getAssignment(
                req,
                res,
                'source-editor-legacy',
                (error, assignment) => {
                  // do not fail editor load if assignment fails
                  if (error) {
                    cb(null, { variant: 'default' })
                  } else {
                    cb(null, assignment)
                  }
                }
              )
            }
          },
        ],
        pdfjsAssignment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'pdfjs-36',
            {},
            (error, assignment) => {
              // do not fail editor load if assignment fails
              if (error) {
                cb(null, { variant: 'default' })
              } else {
                cb(null, assignment)
              }
            }
          )
        },
        latexLogParserAssignment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'latex-log-parser',
            (error, assignment) => {
              // do not fail editor load if assignment fails
              if (error) {
                cb(null, { variant: 'default' })
              } else {
                cb(null, assignment)
              }
            }
          )
        },
        trackPdfDownloadAssignment(cb) {
          SplitTestHandler.getAssignment(req, res, 'track-pdf-download', () => {
            // We'll pick up the assignment from the res.locals assignment.
            cb()
          })
        },
        pdfCachingModeAssignment(cb) {
          SplitTestHandler.getAssignment(req, res, 'pdf-caching-mode', () => {
            // We'll pick up the assignment from the res.locals assignment.
            cb()
          })
        },
        pdfCachingPrefetchingAssignment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'pdf-caching-prefetching',
            () => {
              // We'll pick up the assignment from the res.locals assignment.
              cb()
            }
          )
        },
        pdfCachingPrefetchLargeAssignment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'pdf-caching-prefetch-large',
            () => {
              // We'll pick up the assignment from the res.locals assignment.
              cb()
            }
          )
        },
        pdfCachingCachedUrlLookupAssignment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'pdf-caching-cached-url-lookup',
            () => {
              // We'll pick up the assignment from the res.locals assignment.
              cb()
            }
          )
        },
        editorLeftMenuAssignment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'editor-left-menu',
            (error, assignment) => {
              // do not fail editor load if assignment fails
              if (error) {
                cb(null, { variant: 'default' })
              } else {
                cb(null, assignment)
              }
            }
          )
        },
        editorDocumentationButton(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'documentation-on-editor',
            (error, assignment) => {
              // do not fail editor load if assignment fails
              if (error) {
                cb(null, { variant: 'default' })
              } else {
                cb(null, assignment)
              }
            }
          )
        },
        richTextAssignment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'rich-text',
            (error, assignment) => {
              // do not fail editor load if assignment fails
              if (error) {
                cb(null, { variant: 'default' })
              } else {
                cb(null, assignment)
              }
            }
          )
        },
        figureModalAssignment(cb) {
          SplitTestHandler.getAssignment(req, res, 'figure-modal', () => {
            // We'll pick up the assignment from the res.locals assignment.
            cb()
          })
        },
        onboardingVideoTourAssignment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'onboarding-video-tour',
            (error, assignment) => {
              // do not fail editor load if assignment fails
              if (error) {
                cb(null, { variant: 'default' })
              } else {
                cb(null, assignment)
              }
            }
          )
        },
        historyViewAssignment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'history-view',
            (error, assignment) => {
              // do not fail editor load if assignment fails
              if (error) {
                cb(null, { variant: 'default' })
              } else {
                cb(null, assignment)
              }
            }
          )
        },
        accessCheckForOldCompileDomainAssigment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'access-check-for-old-compile-domain',
            () => {
              // We'll pick up the assignment from the res.locals assignment.
              cb()
            }
          )
        },
        forceNewDomainAssignment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'force-new-compile-domain',
            () => {
              // We'll pick up the assignment from the res.locals assignment.
              cb()
            }
          )
        },
        userContentDomainAccessCheckAssigment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'user-content-domain-access-check',
            () => {
              // We'll pick up the assignment from the res.locals assignment.
              cb()
            }
          )
        },
        userContentDomainAccessCheckDelayAssigment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'user-content-domain-access-check-delay',
            () => {
              // We'll pick up the assignment from the res.locals assignment.
              cb()
            }
          )
        },
        userContentDomainAccessCheckMaxChecksAssigment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'user-content-domain-access-check-max-checks',
            () => {
              // We'll pick up the assignment from the res.locals assignment.
              cb()
            }
          )
        },
        reportUserContentDomainAccessCheckErrorAssigment(cb) {
          SplitTestHandler.getAssignment(
            req,
            res,
            'report-user-content-domain-access-check-error',
            () => {
              // We'll pick up the assignment from the res.locals assignment.
              cb()
            }
          )
        },
      },
      (
        err,
        {
          project,
          user,
          userHasInstitutionLicence,
          learnedWords,
          subscription,
          userIsMemberOfGroupSubscription,
          isTokenMember,
          isInvitedMember,
          brandVariation,
          visualEditorNameAssignment,
          participatingInVisualEditorNamingTest,
          legacySourceEditorAssignment,
          pdfjsAssignment,
          editorLeftMenuAssignment,
          richTextAssignment,
          onboardingVideoTourAssignment,
          historyViewAssignment,
        }
      ) => {
        if (err != null) {
          OError.tag(err, 'error getting details for project page')
          return next(err)
        }
        const anonRequestToken = TokenAccessHandler.getRequestToken(
          req,
          projectId
        )
        const allowedImageNames = ProjectHelper.getAllowedImagesForUser(user)

        AuthorizationManager.getPrivilegeLevelForProject(
          userId,
          projectId,
          anonRequestToken,
          (error, privilegeLevel) => {
            let allowedFreeTrial = true
            if (error != null) {
              return next(error)
            }
            if (
              privilegeLevel == null ||
              privilegeLevel === PrivilegeLevels.NONE
            ) {
              return res.sendStatus(401)
            }

            if (subscription != null) {
              allowedFreeTrial = false
            }

            let wsUrl = Settings.wsUrl
            let metricName = 'load-editor-ws'
            if (user.betaProgram && Settings.wsUrlBeta !== undefined) {
              wsUrl = Settings.wsUrlBeta
              metricName += '-beta'
            } else if (
              Settings.wsUrlV2 &&
              Settings.wsUrlV2Percentage > 0 &&
              (ObjectId(projectId).getTimestamp() / 1000) % 100 <
                Settings.wsUrlV2Percentage
            ) {
              wsUrl = Settings.wsUrlV2
              metricName += '-v2'
            }
            if (req.query && req.query.ws === 'fallback') {
              // `?ws=fallback` will connect to the bare origin, and ignore
              //   the custom wsUrl. Hence it must load the client side
              //   javascript from there too.
              // Not resetting it here would possibly load a socket.io v2
              //  client and connect to a v0 endpoint.
              wsUrl = undefined
              metricName += '-fallback'
            }
            metrics.inc(metricName)

            if (userId) {
              AnalyticsManager.recordEventForUser(userId, 'project-opened', {
                projectId: project._id,
              })
            }

            // should not be used in place of split tests query param overrides (?my-split-test-name=my-variant)
            function shouldDisplayFeature(name, variantFlag) {
              if (req.query && req.query[name]) {
                return req.query[name] === 'true'
              } else {
                return variantFlag === true
              }
            }

            const isAdminOrTemplateOwner =
              hasAdminAccess(user) || Settings.templates?.user_id === userId
            const showTemplatesServerPro =
              Features.hasFeature('templates-server-pro') &&
              isAdminOrTemplateOwner

            const debugPdfDetach = shouldDisplayFeature('debug_pdf_detach')

            const detachRole = req.params.detachRole

            const showLegacySourceEditor =
              !Features.hasFeature('saas') ||
              // Allow override via legacy_source_editor=true in query string
              shouldDisplayFeature('legacy_source_editor') ||
              // Hide Ace for beta users
              (!user.betaProgram &&
                legacySourceEditorAssignment.variant === 'default')

            const editorLeftMenuReact =
              editorLeftMenuAssignment?.variant === 'react'

            const showSymbolPalette =
              !Features.hasFeature('saas') ||
              (user.features && user.features.symbolPalette)

            // It would be nice if this could go in the Galileo module but
            // nothing else does that
            const galileoEnabled = req.query?.galileo || ''
            const galileoFeatures =
              req.query && 'galileoFeatures' in req.query
                ? req.query.galileoFeatures.split(',').map(f => f.trim())
                : ['all']
            const galileoPromptWords = req.query?.galileoPromptWords || ''

            // Persistent upgrade prompts
            // in header & in share project modal
            const showUpgradePrompt =
              Features.hasFeature('saas') &&
              userId &&
              !subscription &&
              !userIsMemberOfGroupSubscription &&
              !userHasInstitutionLicence

            const showOnboardingVideoTour =
              Features.hasFeature('saas') &&
              userId &&
              onboardingVideoTourAssignment.variant === 'active' &&
              req.session.justRegistered

            const showPersonalAccessToken =
              !Features.hasFeature('saas') ||
              req.query?.personal_access_token === 'true'

            const template =
              detachRole === 'detached'
                ? 'project/editor_detached'
                : 'project/editor'

            const isParticipatingInVisualEditorNamingTest =
              Features.hasFeature('saas') &&
              participatingInVisualEditorNamingTest

            let richTextVariant
            if (!Features.hasFeature('saas')) {
              richTextVariant = 'cm6'
            } else {
              richTextVariant = richTextAssignment.variant
            }

            res.render(template, {
              title: project.name,
              priority_title: true,
              bodyClasses: ['editor'],
              project_id: project._id,
              projectName: project.name,
              editorLeftMenuReact,
              user: {
                id: userId,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                referal_id: user.referal_id,
                signUpDate: user.signUpDate,
                allowedFreeTrial,
                featureSwitches: user.featureSwitches,
                features: user.features,
                refProviders: _.mapValues(user.refProviders, Boolean),
                alphaProgram: user.alphaProgram,
                betaProgram: user.betaProgram,
                labsProgram: user.labsProgram,
                labsProgramGalileo: user.labsProgramGalileo,
                isAdmin: hasAdminAccess(user),
              },
              userSettings: {
                mode: user.ace.mode,
                editorTheme: user.ace.theme,
                fontSize: user.ace.fontSize,
                autoComplete: user.ace.autoComplete,
                autoPairDelimiters: user.ace.autoPairDelimiters,
                pdfViewer: user.ace.pdfViewer,
                syntaxValidation: user.ace.syntaxValidation,
                fontFamily: user.ace.fontFamily || 'lucida',
                lineHeight: user.ace.lineHeight || 'normal',
                overallTheme: user.ace.overallTheme,
              },
              privilegeLevel,
              anonymous,
              anonymousAccessToken: anonymous ? anonRequestToken : null,
              isTokenMember,
              isRestrictedTokenMember: AuthorizationManager.isRestrictedUser(
                userId,
                privilegeLevel,
                isTokenMember,
                isInvitedMember
              ),
              languages: Settings.languages,
              learnedWords,
              editorThemes: THEME_LIST,
              legacyEditorThemes: LEGACY_THEME_LIST,
              maxDocLength: Settings.max_doc_length,
              useV2History:
                project.overleaf &&
                project.overleaf.history &&
                Boolean(project.overleaf.history.display),
              brandVariation,
              allowedImageNames,
              gitBridgePublicBaseUrl: Settings.gitBridgePublicBaseUrl,
              wsUrl,
              showSupport: Features.hasFeature('support'),
              showTemplatesServerPro,
              pdfjsVariant: pdfjsAssignment.variant,
              debugPdfDetach,
              isParticipatingInVisualEditorNamingTest,
              visualEditorNameVariant: visualEditorNameAssignment.variant,
              showLegacySourceEditor,
              showSymbolPalette,
              galileoEnabled,
              galileoFeatures,
              galileoPromptWords,
              detachRole,
              metadata: { viewport: false },
              showUpgradePrompt,
              fixedSizeDocument: true,
              useOpenTelemetry: Settings.useOpenTelemetryClient,
              showCM6SwitchAwaySurvey: Settings.showCM6SwitchAwaySurvey,
              richTextVariant,
              showOnboardingVideoTour,
              historyViewReact: historyViewAssignment.variant === 'react',
              showPersonalAccessToken,
            })
            timer.done()
          }
        )
      }
    )
  },

  _refreshFeatures(req, user, callback) {
    // If the feature refresh has failed in this session, don't retry
    // it - require the user to log in again.
    if (req.session.feature_refresh_failed) {
      metrics.inc('features-refresh', 1, {
        path: 'load-editor',
        status: 'skipped',
      })
      return callback(null, user)
    }
    // If the refresh takes too long then return the current
    // features. Note that the user.features property may still be
    // updated in the background after the callback is called.
    callback = _.once(callback)
    const refreshTimeoutHandler = setTimeout(() => {
      req.session.feature_refresh_failed = { reason: 'timeout', at: new Date() }
      metrics.inc('features-refresh', 1, {
        path: 'load-editor',
        status: 'timeout',
      })
      callback(null, user)
    }, 5000)
    // try to refresh user features now
    const timer = new metrics.Timer('features-refresh-on-load-editor')
    FeaturesUpdater.refreshFeatures(
      user._id,
      'load-editor',
      (err, features) => {
        clearTimeout(refreshTimeoutHandler)
        timer.done()
        if (err) {
          // keep a record to prevent unneceary retries and leave
          // the original features unmodified if the refresh failed
          req.session.feature_refresh_failed = {
            reason: 'error',
            at: new Date(),
          }
          metrics.inc('features-refresh', 1, {
            path: 'load-editor',
            status: 'error',
          })
        } else {
          user.features = features
          metrics.inc('features-refresh', 1, {
            path: 'load-editor',
            status: 'success',
          })
        }
        callback(null, user)
      }
    )
  },

  _buildProjectList(allProjects, userId) {
    let project
    const { owned, readAndWrite, readOnly, tokenReadAndWrite, tokenReadOnly } =
      allProjects
    const projects = []
    for (project of owned) {
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
    for (project of readAndWrite) {
      projects.push(
        ProjectController._buildProjectViewModel(
          project,
          'readWrite',
          Sources.INVITE,
          userId
        )
      )
    }
    for (project of readOnly) {
      projects.push(
        ProjectController._buildProjectViewModel(
          project,
          'readOnly',
          Sources.INVITE,
          userId
        )
      )
    }
    // Token-access
    //   Only add these projects if they're not already present, this gives us cascading access
    //   from 'owner' => 'token-read-only'
    for (project of tokenReadAndWrite) {
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
    for (project of tokenReadOnly) {
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
    const archived = ProjectHelper.isArchived(project, userId)
    // If a project is simultaneously trashed and archived, we will consider it archived but not trashed.
    const trashed = ProjectHelper.isTrashed(project, userId) && !archived

    TokenAccessHandler.protectTokens(project, accessLevel)
    const model = {
      id: project._id,
      name: project.name,
      lastUpdated: project.lastUpdated,
      lastUpdatedBy: project.lastUpdatedBy,
      publicAccessLevel: project.publicAccesLevel,
      accessLevel,
      source,
      archived,
      trashed,
      owner_ref: project.owner_ref,
      isV1Project: false,
    }
    if (accessLevel === PrivilegeLevels.READ_ONLY && source === Sources.TOKEN) {
      model.owner_ref = null
      model.lastUpdatedBy = null
    }
    return model
  },

  _injectProjectUsers(projects, callback) {
    const users = {}
    for (const project of projects) {
      if (project.owner_ref != null) {
        users[project.owner_ref.toString()] = true
      }
      if (project.lastUpdatedBy != null) {
        users[project.lastUpdatedBy.toString()] = true
      }
    }

    const userIds = Object.keys(users)
    async.eachSeries(
      userIds,
      (userId, cb) => {
        UserGetter.getUser(
          userId,
          { first_name: 1, last_name: 1, email: 1 },
          (error, user) => {
            if (error != null) {
              return cb(error)
            }
            users[userId] = user
            cb()
          }
        )
      },
      error => {
        if (error != null) {
          return callback(error)
        }
        for (const project of projects) {
          if (project.owner_ref != null) {
            project.owner = users[project.owner_ref.toString()]
          }
          if (project.lastUpdatedBy != null) {
            project.lastUpdatedBy =
              users[project.lastUpdatedBy.toString()] || null
          }
        }
        callback(null, projects)
      }
    )
  },

  _buildPortalTemplatesList(affiliations) {
    if (affiliations == null) {
      affiliations = []
    }
    const portalTemplates = []
    for (const aff of affiliations) {
      if (
        aff.portal &&
        aff.portal.slug &&
        aff.portal.templates_count &&
        aff.portal.templates_count > 0
      ) {
        const portalPath = aff.institution.isUniversity ? '/edu/' : '/org/'
        portalTemplates.push({
          name: aff.institution.name,
          url: Settings.siteUrl + portalPath + aff.portal.slug,
        })
      }
    }
    return portalTemplates
  },
}

const defaultSettingsForAnonymousUser = userId => ({
  id: userId,
  ace: {
    mode: 'none',
    theme: 'textmate',
    fontSize: '12',
    autoComplete: true,
    spellCheckLanguage: '',
    pdfViewer: '',
    syntaxValidation: true,
  },
  subscription: {
    freeTrial: {
      allowed: true,
    },
  },
  featureSwitches: {
    github: false,
  },
  alphaProgram: false,
  betaProgram: false,
})

const THEME_LIST = [
  'cobalt',
  'dracula',
  'eclipse',
  'monokai',
  'overleaf',
  'textmate',
]

const LEGACY_THEME_LIST = [
  'ambiance',
  'chaos',
  'chrome',
  'clouds',
  'clouds_midnight',
  'crimson_editor',
  'dawn',
  'dreamweaver',
  'github',
  'gob',
  'gruvbox',
  'idle_fingers',
  'iplastic',
  'katzenmilch',
  'kr_theme',
  'kuroir',
  'merbivore',
  'merbivore_soft',
  'mono_industrial',
  'nord_dark',
  'pastel_on_dark',
  'solarized_dark',
  'solarized_light',
  'sqlserver',
  'terminal',
  'tomorrow',
  'tomorrow_night',
  'tomorrow_night_blue',
  'tomorrow_night_bright',
  'tomorrow_night_eighties',
  'twilight',
  'vibrant_ink',
  'xcode',
]

module.exports = ProjectController
