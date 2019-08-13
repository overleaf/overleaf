/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['ide/history/HistoryV2Manager'], HistoryV2Manager =>
  describe('HistoryV2Manager', function() {
    beforeEach(function(done) {
      this.defaultHistoryScope = {
        isV2: true,
        updates: [],
        viewMode: 'point_in_time',
        nextBeforeTimestamp: null,
        atEnd: false,
        userHasFullFeature: undefined,
        freeHistoryLimitHit: false,
        selection: {
          docs: {},
          pathname: null,
          range: {
            fromV: null,
            toV: null
          },
          hoveredRange: {
            fromV: null,
            toV: null
          },
          diff: null,
          files: [],
          file: null
        },
        error: null,
        showOnlyLabels: false,
        labels: null,
        loadingFileTree: true
      }

      this.sampleUpdates = [
        {
          fromV: 4,
          toV: 5,
          meta: {
            users: [
              {
                first_name: 'john.doe',
                last_name: '',
                email: 'john.doe@domain.tld',
                id: '5b57299087712202fb599ab4',
                hue: 200
              }
            ],
            start_ts: 1544021278346,
            end_ts: 1544021278346
          },
          labels: [
            {
              id: '5c07e822042e67003b448f18',
              comment: 'My first label',
              version: 5,
              user_id: '5b57299087712202fb599ab4',
              created_at: '2018-12-05T15:00:50.688Z'
            }
          ],
          pathnames: [],
          project_ops: [
            {
              add: {
                pathname: 'chapters/chapter1.tex'
              },
              atV: 4
            }
          ]
        },
        {
          fromV: 3,
          toV: 4,
          meta: {
            users: [
              {
                first_name: 'john.doe',
                last_name: '',
                email: 'john.doe@domain.tld',
                id: '5b57299087712202fb599ab4',
                hue: 200
              }
            ],
            start_ts: 1544021262622,
            end_ts: 1544021262622
          },
          labels: [],
          pathnames: ['main.tex'],
          project_ops: []
        },
        {
          fromV: 0,
          toV: 3,
          meta: {
            users: [
              {
                first_name: 'john.doe',
                last_name: '',
                email: 'john.doe@domain.tld',
                id: '5b57299087712202fb599ab4',
                hue: 200
              }
            ],
            start_ts: 1544021213540,
            end_ts: 1544021213618
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              add: {
                pathname: 'universe.jpg'
              },
              atV: 2
            },
            {
              add: {
                pathname: 'references.bib'
              },
              atV: 1
            },
            {
              add: {
                pathname: 'main.tex'
              },
              atV: 0
            }
          ]
        }
      ]

      inject(($q, $http, $rootScope) => {
        this.$scope = $rootScope.$new()
        this.$scope.project = {
          features: {
            versioning: true
          }
        }
        this.$scope.user = {
          isAdmin: false
        }
        this.ide = {
          $q: $q,
          $http: $http
        }
        this.localStorage = sinon.stub().returns(null)
        this.historyManager = new HistoryV2Manager(
          this.ide,
          this.$scope,
          this.localStorage
        )
        done()
      })
    })

    it('should setup the history scope on initialization', function() {
      expect(this.$scope.history).to.deep.equal(this.defaultHistoryScope)
    })

    it('should keep history updates after performing a soft reset', function() {
      let historyScopeWithUpdates = Object.assign(
        {},
        this.defaultHistoryScope,
        {
          updates: this.sampleUpdates
        }
      )
      this.$scope.history.updates = this.sampleUpdates
      this.historyManager.softReset()
      expect(this.$scope.history).to.deep.equal(historyScopeWithUpdates)
    })

    it('should discard history updates after performing a hard reset', function() {
      this.$scope.history.updates = this.sampleUpdates
      this.historyManager.hardReset()
      expect(this.$scope.history).to.deep.equal(this.defaultHistoryScope)
    })

    it('should setup history with full access to the feature if the project has versioning', function() {
      this.$scope.$digest()
      expect(this.$scope.history.userHasFullFeature).to.equal(true)
    })

    it('should setup history without full access to the feature if the project does not have versioning', function() {
      this.$scope.project.features.versioning = false
      this.historyManager = new HistoryV2Manager(
        this.ide,
        this.$scope,
        this.localStorage
      )
      this.$scope.$digest()
      expect(this.$scope.history.userHasFullFeature).to.equal(false)
    })

    it('should setup history with full access to the feature for admin users even if the project does not have versioning', function() {
      this.$scope.project.features.versioning = false
      this.$scope.user.isAdmin = true
      this.historyManager = new HistoryV2Manager(
        this.ide,
        this.$scope,
        this.localStorage
      )
      this.$scope.$digest()
      expect(this.$scope.history.userHasFullFeature).to.equal(true)
    })

    describe('autoSelectFile', function() {
      describe('for compare mode', function() {
        beforeEach(function() {
          this.mockedFilesList = [
            {
              pathname: 'main.tex'
            },
            {
              pathname: 'references.bib'
            },
            {
              pathname: 'universe.jpg'
            },
            {
              pathname: 'chapters/chapter2.tex'
            },
            {
              pathname: 'chapters/draft.tex',
              operation: 'removed',
              deletedAtV: 47
            },
            {
              pathname: 'chapters/chapter3.tex',
              operation: 'added'
            },
            {
              pathname: 'chapters/chapter1.tex',
              operation: 'edited'
            },
            {
              pathname: 'chapters/foo.tex',
              oldPathname: 'chapters/bar.tex',
              operation: 'renamed'
            }
          ]
          this.mockedMainTex = this.mockedFilesList[0]
          this.mockedReferencesFile = this.mockedFilesList[1]
          this.mockedRemovedFile = this.mockedFilesList[4]
          this.mockedAddedFile = this.mockedFilesList[5]
          this.mockedEditedFile = this.mockedFilesList[6]
          this.mockedRenamedFile = this.mockedFilesList[7]

          this.$scope.history.viewMode = 'compare'
          this.$scope.history.selection.files = this.mockedFilesList
        })

        describe('with a previously selected file', function() {
          it('should prefer the previously selected file if it is available and has operations', function() {
            this.historyManager._previouslySelectedPathname = this.mockedAddedFile.pathname
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file).to.deep.equal(
              this.mockedAddedFile
            )
          })

          it('should prefer a file with ops if the previously selected file is available but has no operations', function() {
            this.historyManager._previouslySelectedPathname = this.mockedReferencesFile.pathname
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file.operation).to.exist
          })

          it('should ignore the previously selected file if it is not available', function() {
            this.historyManager._previouslySelectedPathname =
              'non/existent.file'
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file.pathname).to.not.equal(
              'non/existent.file'
            )
          })
        })

        describe('without a previously selected file, with a list of files containing operations', function() {
          it('should prefer edited files', function() {
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file).to.deep.equal(
              this.mockedEditedFile
            )
          })

          it('should prefer added files if no edited files are present', function() {
            const indexOfEditedFile = this.$scope.history.selection.files.indexOf(
              this.mockedEditedFile
            )
            this.$scope.history.selection.files.splice(indexOfEditedFile, 1)
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file).to.deep.equal(
              this.mockedAddedFile
            )
          })

          it('should prefer renamed files if no edited or added files are present', function() {
            const indexOfEditedFile = this.$scope.history.selection.files.indexOf(
              this.mockedEditedFile
            )
            this.$scope.history.selection.files.splice(indexOfEditedFile, 1)
            const indexOfAddedFile = this.$scope.history.selection.files.indexOf(
              this.mockedAddedFile
            )
            this.$scope.history.selection.files.splice(indexOfAddedFile, 1)
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file).to.deep.equal(
              this.mockedRenamedFile
            )
          })

          it('should prefer removed files if no edited, added or renamed files are present', function() {
            const indexOfEditedFile = this.$scope.history.selection.files.indexOf(
              this.mockedEditedFile
            )
            this.$scope.history.selection.files.splice(indexOfEditedFile, 1)
            const indexOfAddedFile = this.$scope.history.selection.files.indexOf(
              this.mockedAddedFile
            )
            this.$scope.history.selection.files.splice(indexOfAddedFile, 1)
            const indexOfRenamedFile = this.$scope.history.selection.files.indexOf(
              this.mockedRenamedFile
            )
            this.$scope.history.selection.files.splice(indexOfRenamedFile, 1)
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file).to.deep.equal(
              this.mockedRemovedFile
            )
          })
        })

        describe('without a previously selected file, with a list of files without operations', function() {
          beforeEach(function() {
            this.mockedFilesListWithNoOps = [
              {
                pathname: 'main.tex'
              },
              {
                pathname: 'references.bib'
              },
              {
                pathname: 'other.tex'
              },
              {
                pathname: 'universe.jpg'
              }
            ]
            this.mockedMainTex = this.mockedFilesListWithNoOps[0]
            this.mockedReferencesFile = this.mockedFilesListWithNoOps[1]
            this.mockedOtherTexFile = this.mockedFilesListWithNoOps[2]

            this.$scope.history.selection.files = this.mockedFilesListWithNoOps
          })

          it('should prefer main.tex if it exists', function() {
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file).to.deep.equal(
              this.mockedMainTex
            )
          })

          it('should prefer another tex file if main.tex does not exist', function() {
            const indexOfMainTex = this.$scope.history.selection.files.indexOf(
              this.mockedMainTex
            )
            this.$scope.history.selection.files.splice(indexOfMainTex, 1)
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file).to.deep.equal(
              this.mockedOtherTexFile
            )
          })

          it('should pick the first available file if no tex files are available', function() {
            const indexOfMainTex = this.$scope.history.selection.files.indexOf(
              this.mockedMainTex
            )
            this.$scope.history.selection.files.splice(indexOfMainTex, 1)
            const indexOfOtherTexFile = this.$scope.history.selection.files.indexOf(
              this.mockedOtherTexFile
            )
            this.$scope.history.selection.files.splice(indexOfOtherTexFile, 1)
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file).to.deep.equal(
              this.mockedReferencesFile
            )
          })
        })
      })

      describe('for point-in-time mode', function() {
        beforeEach(function() {
          this.$scope.history.viewMode = 'point_in_time'
          this.sampleUpdates[0] = {
            fromV: 4,
            toV: 5,
            meta: {
              users: [
                {
                  first_name: 'john.doe',
                  last_name: '',
                  email: 'john.doe@domain.tld',
                  id: '5b57299087712202fb599ab4',
                  hue: 200
                }
              ],
              start_ts: 1544021278346,
              end_ts: 1544021278346
            },
            pathnames: ['main.tex'],
            project_ops: [
              {
                add: {
                  pathname: 'chapters/chapter1.tex'
                },
                atV: 4
              },
              {
                rename: {
                  pathname: 'foo.tex',
                  newPathname: 'bar.tex'
                }
              }
            ]
          }
          this.sampleUpdateEditedFile = this.sampleUpdates[0].pathnames[0]
          this.sampleUpdateAddedFile = this.sampleUpdates[0].project_ops[0].add.pathname
          this.sampleUpdateRenamedFile = this.sampleUpdates[0].project_ops[1].rename.newPathname
          this.$scope.history.updates = this.sampleUpdates
          this.$scope.history.selection.range = {
            fromV: this.sampleUpdates[0].toV,
            toV: this.sampleUpdates[0].toV
          }
          this.mockedFilesList = [
            {
              pathname: 'main.tex'
            },
            {
              pathname: 'references.bib'
            },
            {
              pathname: 'universe.jpg'
            },
            {
              pathname: 'chapters/chapter2.tex'
            },
            {
              pathname: 'chapters/draft.tex'
            },
            {
              pathname: 'chapters/chapter3.tex'
            },
            {
              pathname: 'chapters/chapter1.tex'
            },
            {
              pathname: 'bar.tex'
            }
          ]
          this.$scope.history.selection.files = this.mockedFilesList
        })

        describe('with a previously selected file', function() {
          it('should prefer the previously selected file if it is available and has operations', function() {
            this.historyManager._previouslySelectedPathname = 'main.tex'
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file.pathname).to.equal(
              this.sampleUpdateEditedFile
            )
          })

          it('should prefer a file with ops if the previously selected file is available but has no operations', function() {
            this.historyManager._previouslySelectedPathname = 'main.tex'
            this.sampleUpdates[0].pathnames = []
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file.pathname).to.equal(
              this.sampleUpdateAddedFile
            )
          })

          it('should ignore the previously selected file if it is not available', function() {
            this.historyManager._previouslySelectedPathname =
              'non/existent.file'
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file.pathname).to.not.equal(
              'non/existent.file'
            )
          })
        })

        describe('without a previously selected file, with a list of files containing operations', function() {
          it('should prefer edited files', function() {
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file.pathname).to.equal(
              this.sampleUpdateEditedFile
            )
          })

          it('should prefer added files if no edited files are present', function() {
            this.sampleUpdates[0].pathnames = []
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file.pathname).to.equal(
              this.sampleUpdateAddedFile
            )
          })

          it('should prefer renamed files if no edited or added files are present', function() {
            this.sampleUpdates[0].pathnames = []
            this.sampleUpdates[0].project_ops.shift()
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file.pathname).to.equal(
              this.sampleUpdateRenamedFile
            )
          })
        })

        describe('without a previously selected file, with a list of files without operations', function() {
          beforeEach(function() {
            this.sampleUpdates[0].pathnames = []
            this.sampleUpdates[0].project_ops = []
            this.mockedMainTex = this.mockedFilesList[0]
            this.mockedReferencesFile = this.mockedFilesList[1]
          })

          it('should prefer main.tex if it exists', function() {
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file.pathname).to.equal(
              this.mockedMainTex.pathname
            )
          })

          it('should prefer another tex file if main.tex does not exist', function() {
            const indexOfMainTex = this.$scope.history.selection.files.indexOf(
              this.mockedMainTex
            )
            this.$scope.history.selection.files.splice(indexOfMainTex, 1)
            this.historyManager.autoSelectFile()
            expect(this.$scope.history.selection.file.pathname).to.match(
              /.tex$/
            )
          })
        })
      })
    })
  }))
