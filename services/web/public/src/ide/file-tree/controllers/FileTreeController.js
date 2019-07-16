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
define(['base'], function(App) {
  App.controller('FileTreeController', function(
    $scope,
    $modal,
    ide,
    $rootScope
  ) {
    $scope.openNewDocModal = () =>
      $modal.open({
        templateUrl: 'newFileModalTemplate',
        controller: 'NewFileModalController',
        size: 'lg',
        resolve: {
          parent_folder() {
            return ide.fileTreeManager.getCurrentFolder()
          },
          projectFeatures() {
            return ide.$scope.project.features
          },
          type() {
            return 'doc'
          },
          userFeatures() {
            return ide.$scope.user.features
          }
        }
      })

    $scope.openNewFolderModal = () =>
      $modal.open({
        templateUrl: 'newFolderModalTemplate',
        controller: 'NewFolderModalController',
        resolve: {
          parent_folder() {
            return ide.fileTreeManager.getCurrentFolder()
          }
        }
      })

    $scope.openUploadFileModal = () =>
      $modal.open({
        templateUrl: 'newFileModalTemplate',
        controller: 'NewFileModalController',
        size: 'lg',
        resolve: {
          projectFeatures() {
            return ide.$scope.project.features
          },
          parent_folder() {
            return ide.fileTreeManager.getCurrentFolder()
          },
          type() {
            return 'upload'
          },
          userFeatures() {
            return ide.$scope.user.features
          }
        }
      })

    $scope.orderByFoldersFirst = function(entity) {
      if ((entity != null ? entity.type : undefined) === 'folder') {
        return '0'
      }
      return '1'
    }

    $scope.startRenamingSelected = () => $scope.$broadcast('rename:selected')

    return ($scope.openDeleteModalForSelected = () =>
      $scope.$broadcast('delete:selected'))
  })

  App.controller('NewFolderModalController', function(
    $scope,
    ide,
    $modalInstance,
    $timeout,
    parent_folder
  ) {
    $scope.inputs = { name: 'name' }
    $scope.state = { inflight: false }

    $modalInstance.opened.then(() =>
      $timeout(() => $scope.$broadcast('open'), 200)
    )

    $scope.create = function() {
      const { name } = $scope.inputs
      if (name == null || name.length === 0) {
        return
      }
      $scope.state.inflight = true
      return ide.fileTreeManager
        .createFolder(name, $scope.parent_folder)
        .then(function() {
          $scope.state.inflight = false
          return $modalInstance.dismiss('done')
        })
        .catch(function(response) {
          const { data } = response
          $scope.error = data
          return ($scope.state.inflight = false)
        })
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  })

  App.controller('NewFileModalController', function(
    $scope,
    ide,
    type,
    parent_folder,
    $modalInstance,
    event_tracking,
    projectFeatures,
    userFeatures
  ) {
    $scope.type = type
    $scope.parent_folder = parent_folder
    $scope.state = {
      inflight: false,
      valid: true
    }
    $scope.cancel = () => $modalInstance.dismiss('cancel')
    $scope.create = () => $scope.$broadcast('create')

    const hasMendeleyFeature =
      (projectFeatures && projectFeatures.references) ||
      (projectFeatures && projectFeatures.mendeley) ||
      (userFeatures && userFeatures.references) ||
      (userFeatures && userFeatures.mendeley)

    const hasZoteroFeature =
      (projectFeatures && projectFeatures.references) ||
      (projectFeatures && projectFeatures.zotero) ||
      (userFeatures && userFeatures.references) ||
      (userFeatures && userFeatures.zotero)

    $scope.$watch('type', function() {
      if ($scope.type === 'mendeley' && !hasMendeleyFeature) {
        event_tracking.send(
          'subscription-funnel',
          'editor-click-feature',
          $scope.type
        )
      }
      if ($scope.type === 'zotero' && !hasZoteroFeature) {
        event_tracking.send(
          'subscription-funnel',
          'editor-click-feature',
          $scope.type
        )
      }
    })
    return $scope.$on('done', (e, opts = {}) => {
      isBibFile = opts.name && /^.*\.bib$/.test(opts.name)
      if (opts.shouldReindexReferences || isBibFile) {
        ide.$scope.$emit('references:should-reindex', {})
      }
      $modalInstance.dismiss('done')
    })
  })

  App.controller('NewDocModalController', function($scope, ide, $timeout) {
    $scope.inputs = { name: 'name.tex' }

    const validate = function() {
      const { name } = $scope.inputs
      $scope.state.valid = name != null && name.length > 0
    }
    $scope.$watch('inputs.name', validate)

    $timeout(() => $scope.$broadcast('open'), 200)

    return $scope.$on('create', function() {
      const { name } = $scope.inputs
      if (name == null || name.length === 0) {
        return
      }
      $scope.state.inflight = true
      return ide.fileTreeManager
        .createDoc(name, $scope.parent_folder)
        .then(function() {
          $scope.state.inflight = false
          return $scope.$emit('done')
        })
        .catch(function(response) {
          const { data } = response
          $scope.error = data
          $scope.state.inflight = false
        })
    })
  })

  App.controller('UploadFileModalController', function(
    $scope,
    $rootScope,
    ide,
    $timeout,
    $window
  ) {
    $scope.parent_folder_id =
      $scope.parent_folder != null ? $scope.parent_folder.id : undefined
    $scope.project_id = ide.project_id
    $scope.tooManyFiles = false
    $scope.rateLimitHit = false
    $scope.secondsToRedirect = 10
    $scope.notLoggedIn = false
    $scope.conflicts = []
    $scope.control = {}

    const needToLogBackIn = function() {
      $scope.notLoggedIn = true
      var decreseTimeout = () =>
        $timeout(function() {
          if ($scope.secondsToRedirect === 0) {
            return ($window.location.href = `/login?redir=/project/${
              ide.project_id
            }`)
          } else {
            decreseTimeout()
            return ($scope.secondsToRedirect = $scope.secondsToRedirect - 1)
          }
        }, 1000)

      return decreseTimeout()
    }

    $scope.max_files = 40
    $scope.onComplete = (error, name, response) =>
      $timeout(function() {
        uploadCount--
        if (response.success) {
          $rootScope.$broadcast('file:upload:complete', response)
        }
        if (uploadCount === 0 && response != null && response.success) {
          return $scope.$emit('done', { name: name })
        }
      }, 250)

    $scope.onValidateBatch = function(files) {
      if (files.length > $scope.max_files) {
        $timeout(() => ($scope.tooManyFiles = true), 1)
        return false
      } else {
        return true
      }
    }

    $scope.onError = function(id, name, reason) {
      console.log(id, name, reason)
      if (reason.indexOf('429') !== -1) {
        return ($scope.rateLimitHit = true)
      } else if (reason.indexOf('403') !== -1) {
        return needToLogBackIn()
      }
    }

    let _uploadTimer = null
    const uploadIfNoConflicts = function() {
      if ($scope.conflicts.length === 0) {
        return $scope.doUpload()
      }
    }

    var uploadCount = 0
    $scope.onSubmit = function(id, name) {
      uploadCount++
      if (ide.fileTreeManager.existsInFolder($scope.parent_folder_id, name)) {
        $scope.conflicts.push(name)
        $scope.$apply()
      }
      if (_uploadTimer == null) {
        _uploadTimer = setTimeout(function() {
          _uploadTimer = null
          return uploadIfNoConflicts()
        }, 0)
      }
      return true
    }

    $scope.onCancel = function(id, name) {
      uploadCount--
      const index = $scope.conflicts.indexOf(name)
      if (index > -1) {
        $scope.conflicts.splice(index, 1)
      }
      $scope.$apply()
      return uploadIfNoConflicts()
    }

    return ($scope.doUpload = () =>
      __guard__($scope.control != null ? $scope.control.q : undefined, x =>
        x.uploadStoredFiles()
      ))
  })

  App.controller('ProjectLinkedFileModalController', function(
    $scope,
    ide,
    $timeout
  ) {
    $scope.data = {
      projects: null, // or []
      selectedProjectId: null,
      projectEntities: null, // or []
      projectOutputFiles: null, // or []
      selectedProjectEntity: null,
      selectedProjectOutputFile: null,
      buildId: null,
      name: null
    }
    $scope.state.inFlight = {
      projects: false,
      entities: false,
      compile: false
    }
    $scope.state.isOutputFilesMode = false
    $scope.state.error = false

    $scope.$watch('data.selectedProjectId', function(newVal, oldVal) {
      if (!newVal) {
        return
      }
      $scope.data.selectedProjectEntity = null
      $scope.data.selectedProjectOutputFile = null
      if ($scope.state.isOutputFilesMode) {
        return $scope.compileProjectAndGetOutputFiles(
          $scope.data.selectedProjectId
        )
      } else {
        return $scope.getProjectEntities($scope.data.selectedProjectId)
      }
    })

    $scope.$watch('state.isOutputFilesMode', function(newVal, oldVal) {
      if (!newVal && !oldVal) {
        return
      }
      $scope.data.selectedProjectOutputFile = null
      if (newVal === true) {
        return $scope.compileProjectAndGetOutputFiles(
          $scope.data.selectedProjectId
        )
      } else {
        return $scope.getProjectEntities($scope.data.selectedProjectId)
      }
    })

    // auto-set filename based on selected file
    $scope.$watch('data.selectedProjectEntity', function(newVal, oldVal) {
      if (!newVal) {
        return
      }
      const fileName = newVal.split('/').reverse()[0]
      if (fileName) {
        $scope.data.name = fileName
      }
    })

    // auto-set filename based on selected file
    $scope.$watch('data.selectedProjectOutputFile', function(newVal, oldVal) {
      if (!newVal) {
        return
      }
      if (newVal === 'output.pdf') {
        const project = _.find(
          $scope.data.projects,
          p => p._id === $scope.data.selectedProjectId
        )
        $scope.data.name =
          (project != null ? project.name : undefined) != null
            ? `${project.name}.pdf`
            : 'output.pdf'
      } else {
        const fileName = newVal.split('/').reverse()[0]
        if (fileName) {
          $scope.data.name = fileName
        }
      }
    })

    const _setInFlight = type => ($scope.state.inFlight[type] = true)

    const _reset = function(opts) {
      const isError = opts.err === true
      const { inFlight } = $scope.state
      inFlight.projects = inFlight.entities = inFlight.compile = false
      $scope.state.inflight = false
      return ($scope.state.error = isError)
    }

    $scope.toggleOutputFilesMode = function() {
      if (!$scope.data.selectedProjectId) {
        return
      }
      return ($scope.state.isOutputFilesMode = !$scope.state.isOutputFilesMode)
    }

    $scope.shouldEnableProjectSelect = function() {
      const { state, data } = $scope
      return !state.inFlight.projects && data.projects
    }

    $scope.hasNoProjects = function() {
      const { state, data } = $scope
      return (
        !state.inFlight.projects &&
        (data.projects == null || data.projects.length === 0)
      )
    }

    $scope.shouldEnableProjectEntitySelect = function() {
      const { state, data } = $scope
      return (
        !state.inFlight.projects &&
        !state.inFlight.entities &&
        data.projects &&
        data.selectedProjectId
      )
    }

    $scope.shouldEnableProjectOutputFileSelect = function() {
      const { state, data } = $scope
      return (
        !state.inFlight.projects &&
        !state.inFlight.compile &&
        data.projects &&
        data.selectedProjectId
      )
    }

    const validate = function() {
      const { state } = $scope
      const { data } = $scope
      $scope.state.valid =
        !state.inFlight.projects &&
        !state.inFlight.entities &&
        data.projects &&
        data.selectedProjectId &&
        ((!$scope.state.isOutputFilesMode &&
          data.projectEntities &&
          data.selectedProjectEntity) ||
          ($scope.state.isOutputFilesMode &&
            data.projectOutputFiles &&
            data.selectedProjectOutputFile)) &&
        data.name
    }
    $scope.$watch('state', validate, true)
    $scope.$watch('data', validate, true)

    $scope.getUserProjects = function() {
      _setInFlight('projects')
      return ide.$http
        .get('/user/projects', {
          _csrf: window.csrfToken
        })
        .then(function(resp) {
          $scope.data.projectEntities = null
          $scope.data.projects = resp.data.projects.filter(
            p => p._id !== ide.project_id
          )
          return _reset({ err: false })
        })
        .catch(err => _reset({ err: true }))
    }

    $scope.getProjectEntities = project_id => {
      _setInFlight('entities')
      return ide.$http
        .get(`/project/${project_id}/entities`, {
          _csrf: window.csrfToken
        })
        .then(function(resp) {
          if ($scope.data.selectedProjectId === resp.data.project_id) {
            $scope.data.projectEntities = resp.data.entities
            return _reset({ err: false })
          }
        })
        .catch(err => _reset({ err: true }))
    }

    $scope.compileProjectAndGetOutputFiles = project_id => {
      _setInFlight('compile')
      return ide.$http
        .post(`/project/${project_id}/compile`, {
          check: 'silent',
          draft: false,
          incrementalCompilesEnabled: false,
          _csrf: window.csrfToken
        })
        .then(function(resp) {
          if (resp.data.status === 'success') {
            const filteredFiles = resp.data.outputFiles.filter(f =>
              f.path.match(/.*\.(pdf|png|jpeg|jpg|gif)/)
            )
            $scope.data.projectOutputFiles = filteredFiles
            $scope.data.buildId = __guard__(
              filteredFiles != null ? filteredFiles[0] : undefined,
              x => x.build
            )
            console.log('>> build_id', $scope.data.buildId)
            return _reset({ err: false })
          } else {
            $scope.data.projectOutputFiles = null
            return _reset({ err: true })
          }
        })
        .catch(function(err) {
          console.error(err)
          return _reset({ err: true })
        })
    }

    $scope.init = () => $scope.getUserProjects()
    $timeout($scope.init, 0)

    return $scope.$on('create', function() {
      let payload, provider
      const projectId = $scope.data.selectedProjectId
      const { name } = $scope.data
      if ($scope.state.isOutputFilesMode) {
        provider = 'project_output_file'
        payload = {
          source_project_id: projectId,
          source_output_file_path: $scope.data.selectedProjectOutputFile,
          build_id: $scope.data.buildId
        }
      } else {
        provider = 'project_file'
        payload = {
          source_project_id: projectId,
          source_entity_path: $scope.data.selectedProjectEntity
        }
      }
      _setInFlight('create')
      ide.fileTreeManager
        .createLinkedFile(name, $scope.parent_folder, provider, payload)
        .then(function() {
          _reset({ err: false })
          return $scope.$emit('done', { name: name })
        })
        .catch(function(response) {
          const { data } = response
          $scope.error = data
        })
    })
  })

  return App.controller('UrlLinkedFileModalController', function(
    $scope,
    ide,
    $timeout
  ) {
    $scope.inputs = {
      name: '',
      url: ''
    }
    $scope.nameChangedByUser = false

    $timeout(() => $scope.$broadcast('open'), 200)

    const validate = function() {
      const { name, url } = $scope.inputs
      if (name == null || name.length === 0) {
        return ($scope.state.valid = false)
      } else if (url == null || url.length === 0) {
        return ($scope.state.valid = false)
      } else {
        return ($scope.state.valid = true)
      }
    }
    $scope.$watch('inputs.name', validate)
    $scope.$watch('inputs.url', validate)

    $scope.$watch('inputs.url', function(url) {
      if (url != null && url !== '' && !$scope.nameChangedByUser) {
        url = url.replace('://', '') // Ignore http:// etc
        const parts = url.split('/').reverse()
        if (parts.length > 1) {
          // Wait for at one /
          return ($scope.inputs.name = parts[0])
        }
      }
    })

    return $scope.$on('create', function() {
      const { name, url } = $scope.inputs
      if (name == null || name.length === 0) {
        return
      }
      if (url == null || url.length === 0) {
        return
      }
      $scope.state.inflight = true
      return ide.fileTreeManager
        .createLinkedFile(name, $scope.parent_folder, 'url', { url })
        .then(function() {
          $scope.state.inflight = false
          return $scope.$emit('done', { name: name })
        })
        .catch(function(response) {
          const { data } = response
          $scope.error = data
          return ($scope.state.inflight = false)
        })
    })
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
