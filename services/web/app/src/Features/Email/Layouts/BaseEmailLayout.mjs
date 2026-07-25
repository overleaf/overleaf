import _ from 'lodash'
import settings from '@overleaf/settings'
import { fontFamily, colors } from '../emailStyles.mjs'

const _isSaas = settings.env === 'saas'
const _imageBase = settings.cdn?.web?.host || settings.siteUrl || null

let _logoHtml = `<span style="font-family: ${fontFamily}; font-size: 30px; font-weight: bold; color: ${colors.logoGreen};">${settings.appName}</span>`
let _taglineHtml = ''
if (_isSaas && _imageBase) {
  _logoHtml = `
    <a href="${settings.siteUrl}" style="text-decoration: none; display: inline-block; border: 0;">
      <img
        src="${_imageBase}/img/ol-brand/email-logo@2x.png"
        alt="${settings.appName}"
        width="139"
        height="40"
        style="display: block; border: 0; width: 139px; height: 40px;"
      >
    </a>
  `

  _taglineHtml = `
    <!--[if mso]>
    <img
      src="${_imageBase}/img/ol-brand/email-footer-tagline@2x.png"
      alt="The home of scientific and technical writing"
      width="452"
      height="25"
      style="display: block; border: 0;"
    />
    <![endif]-->
    <!--[if !mso]><!-->
    <img
      src="${_imageBase}/img/ol-brand/email-footer-tagline@2x.png"
      alt="The home of scientific and technical writing"
      style="display: block; border: 0; width: 100%; max-width: 452px; height: auto;"
    >
    <!--<![endif]-->
  `
}

const _customFooter = settings.email?.template?.customFooter || ''

export default _.template(`\
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, li { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: ${colors.background}; }
    img { border: 0; display: block; outline: none; text-decoration: none; }
    .email-layout-table { border-collapse: collapse !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }

    .force-overleaf-style a,
    .force-overleaf-style a[href] {
      color: ${colors.linkGreen} !important;
      text-decoration: underline !important;
      -moz-hyphens: none;
      -ms-hyphens: none;
      -webkit-hyphens: none;
      hyphens: none;
    }
    .force-overleaf-style a:visited,
    .force-overleaf-style a[href]:visited { color: ${colors.linkGreen}; }
    .force-overleaf-style a:hover,
    .force-overleaf-style a[href]:hover { color: ${colors.linkHover}; }

    @media only screen and (min-width: 621px) {
      .email-card-inner { padding: 56px !important; }
    }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-outer-cell { padding: 0 10px !important; }
      .email-header-cell { padding: 16px 0 !important; }
    }
  </style>
</head>
<body bgcolor="${colors.background}" style="margin: 0; padding: 0; background-color: ${colors.background}; font-family: ${fontFamily};">

  <!-- Prevent Gmail iOS font size manipulation -->
  <div style="display: none; white-space: nowrap; font: 15px courier; line-height: 0;">
    &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;
    &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;
  </div>

  <table class="email-layout-table" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${colors.background}" style="background-color: ${colors.background}; min-width: 100%;">
    <tr>
      <td class="email-outer-cell" align="center" valign="top" style="padding: 40px 10px;">

        <!--[if mso]>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" align="center"><tr><td>
        <![endif]-->
        <table class="email-container email-layout-table" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">

          <!-- Logo header -->
          <tr>
            <td class="email-header-cell" style="padding: 0 0 24px 0;">
              ${_logoHtml}
            </td>
          </tr>

          <!-- White content card -->
          <tr>
            <td bgcolor="#ffffff" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
              <table class="email-layout-table" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td
                    class="email-card-inner"
                    style="padding: 32px 24px; font-family: ${fontFamily}; font-size: 16px; line-height: 1.5; color: ${colors.textDark};"
                  >
                    <%= body %>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer spacer -->
          <tr>
            <td style="height: 24px; font-size: 24px; line-height: 24px; mso-line-height-rule: exactly;">&nbsp;</td>
          </tr>

          <!-- Footer tagline -->
          <tr>
            <td align="center" style="padding: 0 0 48px 0;">
              ${_taglineHtml}
            </td>
          </tr>

          <!-- Footer site info -->
          ${
            _customFooter
              ? `<tr>
            <td align="center" style="padding: 0 0 32px 0; font-family: ${fontFamily}; font-size: 13px; color: ${colors.textMuted}; line-height: 1.5;">
              ${_customFooter}
            </td>
          </tr>`
              : ''
          }

          <% if (footerMessage) { %>
          <tr>
            <td align="center" class="force-overleaf-style" style="padding: 0 0 32px 0; font-family: ${fontFamily}; font-size: 14px; color: ${colors.textMuted}; line-height: 20px;">
              <%= footerMessage %>
            </td>
          </tr>
          <% } %>

        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->

      </td>
    </tr>
  </table>

</body>
</html>\
`)
