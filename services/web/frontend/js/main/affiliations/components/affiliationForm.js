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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], function(App) {
  const affiliationFormController = function(
    $scope,
    $element,
    $attrs,
    UserAffiliationsDataService
  ) {
    const ctrl = this
    ctrl.roles = []
    ctrl.departments = []
    ctrl.countries = []
    ctrl.universities = []
    let _defaultDepartments = []

    ctrl.addUniversityToSelection = universityName => ({
      name: universityName,
      isUserSuggested: true
    })
    ctrl.handleFreeformInputChange = function($select, propertyToMatch) {
      if ($select.search == null || $select.search === '') {
        return
      }
      let resultingItem = $select.search
      if (($select.tagging != null ? $select.tagging.fct : undefined) != null) {
        resultingItem = $select.tagging.fct($select.search)
      }
      if (propertyToMatch != null) {
        const matchingItem = _.find(
          $select.items,
          item => item[propertyToMatch] === $select.search
        )
        if (matchingItem != null) {
          resultingItem = matchingItem
        }
      }
      return $select.searchInput.scope().$broadcast('uis:select', resultingItem)
    }

    // Populates the countries dropdown
    UserAffiliationsDataService.getCountries().then(
      countries => (ctrl.countries = countries)
    )
    // Populates the roles dropdown
    UserAffiliationsDataService.getDefaultRoleHints().then(
      roles => (ctrl.roles = roles)
    )
    // Fetches the default department hints
    UserAffiliationsDataService.getDefaultDepartmentHints().then(
      departments => (_defaultDepartments = departments)
    )
    // Populates the universities dropdown (after selecting a country)
    $scope.$watch('$ctrl.affiliationData.country', function(
      newSelectedCountry,
      prevSelectedCountry
    ) {
      if (
        newSelectedCountry != null &&
        newSelectedCountry !== prevSelectedCountry
      ) {
        ctrl.affiliationData.university = null
        ctrl.affiliationData.role = null
        ctrl.affiliationData.department = null
        return UserAffiliationsDataService.getUniversitiesFromCountry(
          newSelectedCountry
        ).then(universities => (ctrl.universities = universities))
      }
    })
    // Populates the departments dropdown (after selecting a university)
    $scope.$watch('$ctrl.affiliationData.university', function(
      newSelectedUniversity,
      prevSelectedUniversity
    ) {
      if (
        newSelectedUniversity != null &&
        newSelectedUniversity !== prevSelectedUniversity &&
        (newSelectedUniversity.departments != null
          ? newSelectedUniversity.departments.length
          : undefined) > 0
      ) {
        return (ctrl.departments = _.uniq(newSelectedUniversity.departments))
      } else {
        return (ctrl.departments = _defaultDepartments)
      }
    })
  }

  return App.component('affiliationForm', {
    bindings: {
      affiliationData: '=',
      showUniversityAndCountry: '<',
      showRoleAndDepartment: '<'
    },
    controller: affiliationFormController,
    templateUrl: 'affiliationFormTpl'
  })
})
