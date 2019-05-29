/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const _ = require('underscore')
const settings = require('settings-sharelatex')

module.exports = _.template(`\
<table class="row" style="border-collapse: collapse; border-spacing: 0; display: table; padding: 0; position: relative; text-align: left; vertical-align: top; width: 100%;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;">
	<th class="small-12 large-12 columns first last" style="Margin: 0 auto; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0 auto; padding: 0; padding-bottom: 16px; padding-left: 16px; padding-right: 16px; text-align: left; width: 564px;"><table style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;"><tr style="padding: 0; text-align: left; vertical-align: top;"><th style="Margin: 0; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0; padding: 0; text-align: left;">
		<% if (title) { %>
			<h3 class="avoid-auto-linking" style="Margin: 0; color: inherit; font-family: Baskerville, 'Baskerville Old Face', Georgia, serif; font-size: 24px; font-weight: normal; line-height: 1.3; margin: 0; padding: 0; text-align: left; word-wrap: normal;">
				<%= title %>
			</h3>
		<% } %>
		<table class="spacer" style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;"><td height="20px" style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: normal; hyphens: auto; line-height: 20px; margin: 0; mso-line-height-rule: exactly; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">&#xA0;</td></tr></tbody></table> 
		<% if (greeting) { %>
			<p style="Margin: 0; Margin-bottom: 10px; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0; margin-bottom: 10px; padding: 0; text-align: left;">
				<%= greeting %>
			</p>
		<% } %>
		<p class="avoid-auto-linking" style="Margin: 0; Margin-bottom: 10px; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0; margin-bottom: 10px; padding: 0; text-align: left;">
			<%= message %>
		</p>
		<table class="spacer" style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;"><td height="20px" style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: normal; hyphens: auto; line-height: 20px; margin: 0; mso-line-height-rule: exactly; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">&#xA0;</td></tr></tbody></table> 
		<center data-parsed="" style="min-width: 532px; width: 100%;">
			<table class="button float-center" style="Margin: 0 0 16px 0; border-collapse: collapse; border-spacing: 0; float: none; margin: 0 0 16px 0; padding: 0; text-align: center; vertical-align: top; width: auto;"><tr style="padding: 0; text-align: left; vertical-align: top;"><td style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; hyphens: auto; line-height: 1.3; margin: 0; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;"><table style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;"><tr style="padding: 0; text-align: left; vertical-align: top;"><td style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; background: #a93529; border: 2px solid #a93529; border-collapse: collapse !important; color: #fefefe; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; hyphens: auto; line-height: 1.3; margin: 0; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">
				<a href="<%= ctaURL %>" style="Margin: 0; border: 0 solid #a93529; border-radius: 3px; color: #fefefe; display: inline-block; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: bold; line-height: 1.3; margin: 0; padding: 8px 16px 8px 16px; text-align: left; text-decoration: none;">
					<%= ctaText %>
				</a>
			</td></tr></table></td></tr></table>
		</center>
		<% if (secondaryMessage) { %>
			<table class="spacer" style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;"><td height="20px" style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: normal; hyphens: auto; line-height: 20px; margin: 0; mso-line-height-rule: exactly; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">&#xA0;</td></tr></tbody></table>
			<p class="avoid-auto-linking" style="Margin: 0; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0; padding: 0; text-align: left;">
				<%= secondaryMessage %>
			</p>
		<% } %>
		<table class="spacer" style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;"><td height="20px" style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #5D6879; font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: normal; hyphens: auto; line-height: 20px; margin: 0; mso-line-height-rule: exactly; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">&#xA0;</td></tr></tbody></table>
		<p class="avoid-auto-linking" style="Margin: 0; Margin-bottom: 10px; color: #5D6879; font-family: Helvetica, Arial, sans-serif; font-size: 12px; font-weight: normal; margin: 0; margin-bottom: 10px; padding: 0; text-align: left;">
			If the button above does not appear, please open the link in your browser here:<br>
			<a href="<%= ctaURL %>"><%= ctaURL %></a>
		</p>
	</th>
	<th class="expander" style="Margin: 0; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0; padding: 0 !important; text-align: left; visibility: hidden; width: 0;"></th></tr></table></th>
</tr></tbody></table>
<% if (gmailGoToAction) { %>
	<script type="application/ld+json">
		{
			"@context": "http://schema.org",
			"@type": "EmailMessage",
			"potentialAction": {
				"@type": "ViewAction",
				"target": "<%= gmailGoToAction.target %>",
				"url": "<%= gmailGoToAction.target %>",
				"name": "<%= gmailGoToAction.name %>"
			},
			"description": "<%= gmailGoToAction.description %>"
		}
	</script>
<% } %>\
`)
