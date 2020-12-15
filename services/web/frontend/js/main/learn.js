import _ from 'lodash'
/* eslint-disable
    camelcase,
    node/handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../base'
import '../directives/mathjax'
import '../services/algolia-search'
App.controller('SearchWikiController', function($scope, algoliaSearch, $modal) {
  $scope.hits = []
  $scope.hits_total = 0
  $scope.config_hits_per_page = 20
  $scope.processingSearch = false

  $scope.clearSearchText = function() {
    $scope.searchQueryText = ''
    return updateHits([])
  }

  $scope.safeApply = function(fn) {
    const phase = $scope.$root.$$phase
    if (phase === '$apply' || phase === '$digest') {
      return $scope.$eval(fn)
    } else {
      return $scope.$apply(fn)
    }
  }

  const buildHitViewModel = function(hit) {
    const pagePath = hit.kb ? 'how-to/' : 'latex/'
    const pageSlug = encodeURIComponent(hit.pageName.replace(/\s/g, '_'))
    let section_underscored = ''
    if (hit.sectionName && hit.sectionName !== '') {
      section_underscored = '#' + hit.sectionName.replace(/\s/g, '_')
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
    const matching_lines = []
    for (let line of Array.from(lines)) {
      if (!/^\[edit\]/.test(line)) {
        content += line + '\n'
        if (/<em>/.test(line)) {
          matching_lines.push(line)
        }
      }
    }
    content = matching_lines.join('\n...\n')
    const result = {
      name: pageName,
      url: `/learn/${pagePath}${pageSlug}${section_underscored}`,
      content
    }
    return result
  }

  var updateHits = (hits, hits_total = 0) => {
    $scope.safeApply(() => {
      $scope.hits = hits
      $scope.hits_total = hits_total
    })
  }

  $scope.search = function() {
    $scope.processingSearch = true
    const query = $scope.searchQueryText
    if (query == null || query.length === 0) {
      updateHits([])
      return
    }

    return algoliaSearch.searchWiki(
      query,
      {
        hitsPerPage: $scope.config_hits_per_page
      },
      function(err, response) {
        $scope.processingSearch = false
        if (response.hits.length === 0) {
          return updateHits([])
        } else {
          const hits = _.map(response.hits, buildHitViewModel)
          return updateHits(hits, response.nbHits)
        }
      }
    )
  }
})

export default App.controller('LearnController', function() {})
