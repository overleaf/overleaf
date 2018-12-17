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
          update: null,
          label: null,
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
  }))
