define [
	"ide/review-panel/controllers/ReviewPanelController"
	"ide/review-panel/directives/reviewPanelSorted"
	"ide/review-panel/directives/reviewPanelToggle"
	"ide/review-panel/directives/changeEntry"
	"ide/review-panel/directives/commentEntry"
	"ide/review-panel/directives/addCommentEntry"
	"ide/review-panel/directives/resolvedCommentsDropdown"
	"ide/review-panel/filters/notEmpty"
	"ide/review-panel/filters/orderOverviewEntries"
], () ->