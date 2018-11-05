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
    beforeEach(function() {
      this.scope = {
        $watch: sinon.stub(),
        $on: sinon.stub(),
        project: {
          features: {
            versioning: true
          }
        }
      }
      this.ide = {}
      return (this.historyManager = new HistoryV2Manager(this.ide, this.scope))
    })

    it('should setup the history scope on initialization', function() {
      return expect(this.scope.history).to.deep.equal({
        isV2: true,
        updates: [],
        viewMode: null,
        nextBeforeTimestamp: null,
        atEnd: false,
        userHasFullFeature: true,
        freeHistoryLimitHit: false,
        selection: {
          label: null,
          updates: [],
          docs: {},
          pathname: null,
          range: {
            fromV: null,
            toV: null
          }
        },
        error: null,
        showOnlyLabels: false,
        labels: null,
        diff: null,
        files: [],
        selectedFile: null
      })
    })

    it('should setup history without full access to the feature if the project does not have versioning', function() {
      this.scope.project.features.versioning = false
      this.historyManager = new HistoryV2Manager(this.ide, this.scope)
      return expect(this.scope.history.userHasFullFeature).to.equal(false)
    })

    return describe('_perDocSummaryOfUpdates', function() {
      it('should return the range of updates for the docs', function() {
        const result = this.historyManager._perDocSummaryOfUpdates([
          {
            pathnames: ['main.tex'],
            fromV: 7,
            toV: 9
          },
          {
            pathnames: ['main.tex', 'foo.tex'],
            fromV: 4,
            toV: 6
          },
          {
            pathnames: ['main.tex'],
            fromV: 3,
            toV: 3
          },
          {
            pathnames: ['foo.tex'],
            fromV: 0,
            toV: 2
          }
        ])

        return expect(result).to.deep.equal({
          'main.tex': { fromV: 3, toV: 9 },
          'foo.tex': { fromV: 0, toV: 6 }
        })
      })

      it('should track renames', function() {
        const result = this.historyManager._perDocSummaryOfUpdates([
          {
            pathnames: ['main2.tex'],
            fromV: 5,
            toV: 9
          },
          {
            project_ops: [
              {
                rename: {
                  pathname: 'main1.tex',
                  newPathname: 'main2.tex'
                }
              }
            ],
            fromV: 4,
            toV: 4
          },
          {
            pathnames: ['main1.tex'],
            fromV: 3,
            toV: 3
          },
          {
            project_ops: [
              {
                rename: {
                  pathname: 'main0.tex',
                  newPathname: 'main1.tex'
                }
              }
            ],
            fromV: 2,
            toV: 2
          },
          {
            pathnames: ['main0.tex'],
            fromV: 0,
            toV: 1
          }
        ])

        return expect(result).to.deep.equal({
          'main0.tex': { fromV: 0, toV: 9 }
        })
      })

      it('should track single renames', function() {
        const result = this.historyManager._perDocSummaryOfUpdates([
          {
            project_ops: [
              {
                rename: {
                  pathname: 'main1.tex',
                  newPathname: 'main2.tex'
                }
              }
            ],
            fromV: 4,
            toV: 5
          }
        ])

        return expect(result).to.deep.equal({
          'main1.tex': { fromV: 4, toV: 5 }
        })
      })

      it('should track additions', function() {
        const result = this.historyManager._perDocSummaryOfUpdates([
          {
            project_ops: [
              {
                add: {
                  pathname: 'main.tex'
                }
              }
            ],
            fromV: 0,
            toV: 1
          },
          {
            pathnames: ['main.tex'],
            fromV: 1,
            toV: 4
          }
        ])

        return expect(result).to.deep.equal({
          'main.tex': { fromV: 0, toV: 4 }
        })
      })

      it('should track single additions', function() {
        const result = this.historyManager._perDocSummaryOfUpdates([
          {
            project_ops: [
              {
                add: {
                  pathname: 'main.tex'
                }
              }
            ],
            fromV: 0,
            toV: 1
          }
        ])

        return expect(result).to.deep.equal({
          'main.tex': { fromV: 0, toV: 1 }
        })
      })

      it('should track deletions', function() {
        const result = this.historyManager._perDocSummaryOfUpdates([
          {
            pathnames: ['main.tex'],
            fromV: 0,
            toV: 1
          },
          {
            project_ops: [
              {
                remove: {
                  pathname: 'main.tex'
                },
                atV: 2
              }
            ],
            fromV: 1,
            toV: 2
          }
        ])

        return expect(result).to.deep.equal({
          'main.tex': { fromV: 0, toV: 2, deletedAtV: 2 }
        })
      })

      return it('should track single deletions', function() {
        const result = this.historyManager._perDocSummaryOfUpdates([
          {
            project_ops: [
              {
                remove: {
                  pathname: 'main.tex'
                },
                atV: 1
              }
            ],
            fromV: 0,
            toV: 1
          }
        ])

        return expect(result).to.deep.equal({
          'main.tex': { fromV: 0, toV: 1, deletedAtV: 1 }
        })
      })
    })
  }))
