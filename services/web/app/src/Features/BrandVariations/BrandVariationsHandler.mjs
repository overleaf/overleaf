import OError from '@overleaf/o-error'
import { URL } from 'node:url'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import V1Api from '../V1/V1Api.mjs'
import sanitizeHtml from 'sanitize-html'
import { promisify } from '@overleaf/promise-utils'

export default {
  getBrandVariationById,
  promises: {
    getBrandVariationById: promisify(getBrandVariationById),
  },
}

function getBrandVariationById(brandVariationId, callback) {
  if (brandVariationId == null || brandVariationId === '') {
    return callback(new Error('Branding variation id not provided'))
  }
  logger.debug({ brandVariationId }, 'fetching brand variation details from v1')
  V1Api.request(
    {
      uri: `/api/v2/brand_variations/${brandVariationId}`,
    },
    function (error, response, brandVariationDetails) {
      if (error != null) {
        OError.tag(error, 'error getting brand variation details', {
          brandVariationId,
        })
        return callback(error)
      }
      formatBrandVariationDetails(brandVariationDetails)
      sanitizeBrandVariationDetails(brandVariationDetails)
      callback(null, brandVariationDetails)
    }
  )
}

function formatBrandVariationDetails(details) {
  if (details.export_url != null) {
    details.export_url = setV1AsHostIfRelativeURL(details.export_url)
  }
  if (details.home_url != null) {
    details.home_url = setV1AsHostIfRelativeURL(details.home_url)
  }
  if (details.logo_url != null) {
    details.logo_url = setV1AsHostIfRelativeURL(details.logo_url)
  }
  if (details.journal_guidelines_url != null) {
    details.journal_guidelines_url = setV1AsHostIfRelativeURL(
      details.journal_guidelines_url
    )
  }
  if (details.journal_cover_url != null) {
    details.journal_cover_url = setV1AsHostIfRelativeURL(
      details.journal_cover_url
    )
  }
  if (details.submission_confirmation_page_logo_url != null) {
    details.submission_confirmation_page_logo_url = setV1AsHostIfRelativeURL(
      details.submission_confirmation_page_logo_url
    )
  }
  if (details.publish_menu_icon != null) {
    details.publish_menu_icon = setV1AsHostIfRelativeURL(
      details.publish_menu_icon
    )
  }
}

function sanitizeBrandVariationDetails(details) {
  if (details.submit_button_html) {
    details.submit_button_html = sanitizeHtml(
      details.submit_button_html,
      settings.modules.sanitize.options
    )
    details.submit_button_html_no_br = sanitizeHtml(
      details.submit_button_html.replace(/<br\s*\/?>/gi, ' '),
      settings.modules.sanitize.options
    )
  }
}

function setV1AsHostIfRelativeURL(urlString) {
  // The first argument is the base URL to resolve against if the second argument is not absolute.
  // As it only applies if the second argument is not absolute, we can use it to transform relative URLs into
  // absolute ones using v1 as the host. If the URL is absolute (e.g. a filepicker one), then the base
  // argument is just ignored
  return new URL(urlString, settings.apis.v1.publicUrl).href
}
