import _ from 'lodash'
import App from '../base'
import '../directives/mathjax'
import '../services/algolia-search'
App.controller(
  'SearchWikiController',
  function ($scope, algoliaSearch, $modal) {
    $scope.hits = []
    $scope.hits_total = 0
    $scope.config_hits_per_page = 20
    $scope.processingSearch = false

    $scope.clearSearchText = function () {
      $scope.searchQueryText = ''
      updateHits([])
    }

    $scope.safeApply = function (fn) {
      const phase = $scope.$root.$$phase
      if (phase === '$apply' || phase === '$digest') {
        $scope.$eval(fn)
      } else {
        $scope.$apply(fn)
      }
    }

    const buildHitViewModel = function (hit) {
      const pagePath = hit.kb ? 'how-to/' : 'latex/'
      const pageSlug = encodeURIComponent(hit.pageName.replace(/\s/g, '_'))
      let sectionUnderscored = ''
      if (hit.sectionName && hit.sectionName !== '') {
        sectionUnderscored = '#' + hit.sectionName.replace(/\s/g, '_')
      }
      const section = hit._highlightResult.sectionName
      let pageName = hit._highlightResult.pageName.value
      if (section && section.value && section !== '') {
        pageName += ' - ' + section.value
      }

      let content = hit._highlightResult.content.value
      // Replace many new lines
      content = content.replace(/\n\n+/g, '\n\n')
      const lines = content.split('\n')
      // Only show the lines that have a highlighted match
      const matchingLines = []
      for (const line of lines) {
        if (!/^\[edit\]/.test(line)) {
          content += line + '\n'
          if (/<em>/.test(line)) {
            matchingLines.push(line)
          }
        }
      }
      content = matchingLines.join('\n...\n')
      const result = {
        name: pageName,
        url: `/learn/${pagePath}${pageSlug}${sectionUnderscored}`,
        content,
      }
      return result
    }

    var updateHits = (hits, hitsTotal = 0) => {
      $scope.safeApply(() => {
        $scope.hits = hits
        $scope.hits_total = hitsTotal
      })
    }

    $scope.search = function () {
      $scope.processingSearch = true
      const query = $scope.searchQueryText
      if (!query || query.length === 0) {
        updateHits([])
        return
      }

      algoliaSearch.searchWiki(
        query,
        {
          hitsPerPage: $scope.config_hits_per_page,
        },
        function (err, response) {
          $scope.processingSearch = false
          if (response.hits.length === 0) {
            updateHits([])
          } else {
            const hits = _.map(response.hits, buildHitViewModel)
            updateHits(hits, response.nbHits)
          }
        }
      )
    }
  }
)

export default App.controller('LearnController', function () {})
