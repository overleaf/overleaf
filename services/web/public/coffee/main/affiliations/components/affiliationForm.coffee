define [
	"base"
], (App) ->
	affiliationFormController = ($scope, $element, $attrs, UserAffiliationsDataService) ->
		ctrl = @
		ctrl.roles = []
		ctrl.departments = []
		ctrl.countries = []
		ctrl.universities = []
		_defaultDepartments = []

		ctrl.addUniversityToSelection = (universityName) -> 
			{ name: universityName, isUserSuggested: true }
		ctrl.handleFreeformInputChange = ($select, propertyToMatch) ->
			if !$select.search? or $select.search == ""
				return
			resultingItem = $select.search
			if $select.tagging?.fct?
				resultingItem = $select.tagging.fct $select.search
			if propertyToMatch?
				matchingItem = _.find $select.items, (item) -> item[propertyToMatch] == $select.search
				if matchingItem?
					resultingItem = matchingItem
			$select.searchInput.scope().$broadcast "uis:select", resultingItem

		# Populates the countries dropdown
		UserAffiliationsDataService
			.getCountries()
			.then (countries) -> ctrl.countries = countries
		# Populates the roles dropdown
		UserAffiliationsDataService
			.getDefaultRoleHints()
			.then (roles) -> ctrl.roles = roles 
		# Fetches the default department hints
		UserAffiliationsDataService
			.getDefaultDepartmentHints()
			.then (departments) -> 
				_defaultDepartments = departments
		# Populates the universities dropdown (after selecting a country)
		$scope.$watch "$ctrl.affiliationData.country", (newSelectedCountry, prevSelectedCountry) ->
			if newSelectedCountry? and newSelectedCountry != prevSelectedCountry
				ctrl.affiliationData.university = null
				ctrl.affiliationData.role = null
				ctrl.affiliationData.department = null
				UserAffiliationsDataService
					.getUniversitiesFromCountry(newSelectedCountry)
					.then (universities) -> ctrl.universities = universities
		# Populates the departments dropdown (after selecting a university)
		$scope.$watch "$ctrl.affiliationData.university", (newSelectedUniversity, prevSelectedUniversity) ->
			if newSelectedUniversity? and newSelectedUniversity != prevSelectedUniversity and newSelectedUniversity.departments?.length > 0
				ctrl.departments = _.uniq newSelectedUniversity.departments
			else 
				ctrl.departments = _defaultDepartments

		return

	App.component "affiliationForm", {
		bindings:
			affiliationData: "="
			showUniversityAndCountry: "<"
			showRoleAndDepartment: "<"
		controller: affiliationFormController
		templateUrl: "affiliationFormTpl"
	}