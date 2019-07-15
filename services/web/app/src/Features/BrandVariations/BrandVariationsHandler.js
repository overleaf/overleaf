/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let BrandVariationsHandler
const url = require('url')
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const V1Api = require('../V1/V1Api')

module.exports = BrandVariationsHandler = {
  getBrandVariationById(brandVariationId, callback) {
    if (callback == null) {
      callback = function(error, brandVariationDetails) {}
    }
    if (brandVariationId == null || brandVariationId === '') {
      return callback(new Error('Branding variation id not provided'))
    }
    logger.log({ brandVariationId }, 'fetching brand variation details from v1')
    return V1Api.request(
      {
        uri: `/api/v2/brand_variations/${brandVariationId}`
      },
      function(error, response, brandVariationDetails) {
        if (error != null) {
          logger.warn(
            { brandVariationId, error },
            'error getting brand variation details'
          )
          return callback(error)
        }
        _formatBrandVariationDetails(brandVariationDetails)
        return callback(null, brandVariationDetails)
      }
    )
  }
}

var _formatBrandVariationDetails = function(details) {
  if (details.export_url != null) {
    details.export_url = _setV1AsHostIfRelativeURL(details.export_url)
  }
  if (details.home_url != null) {
    details.home_url = _setV1AsHostIfRelativeURL(details.home_url)
  }
  if (details.logo_url != null) {
    details.logo_url = _setV1AsHostIfRelativeURL(details.logo_url)
  }
  if (details.journal_guidelines_url != null) {
    details.journal_guidelines_url = _setV1AsHostIfRelativeURL(
      details.journal_guidelines_url
    )
  }
  if (details.journal_cover_url != null) {
    details.journal_cover_url = _setV1AsHostIfRelativeURL(
      details.journal_cover_url
    )
  }
  if (details.submission_confirmation_page_logo_url != null) {
    details.submission_confirmation_page_logo_url = _setV1AsHostIfRelativeURL(
      details.submission_confirmation_page_logo_url
    )
  }
  if (details.publish_menu_icon != null) {
    return (details.publish_menu_icon = _setV1AsHostIfRelativeURL(
      details.publish_menu_icon
    ))
  }
}

var _setV1AsHostIfRelativeURL = urlString =>
  // The first argument is the base URL to resolve against if the second argument is not absolute.
  // As it only applies if the second argument is not absolute, we can use it to transform relative URLs into
  // absolute ones using v1 as the host. If the URL is absolute (e.g. a filepicker one), then the base
  // argument is just ignored
  url.resolve(settings.apis.v1.url, urlString)
