const _ = require('underscore')

module.exports = _.template(`\
	<table class="row" style="border-collapse: collapse; border-spacing: 0; display: table; padding: 0; position: relative; text-align: left; vertical-align: top; width: 100%;">
		<tbody>
			<tr style="padding: 0; vertical-align: top;">
				<th class="small-12 columns" style="margin: 0 auto; line-height: 1.3; margin: 0 auto; padding: 0; padding-bottom: 16px; padding-left: 16px; padding-right: 16px; text-align: left; width: 564px;">
					<table style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%; color: #5D6879; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3;"><tr style="padding: 0; text-align: left; vertical-align: top;">
						<th style="margin: 0; margin: 0; padding: 0; text-align: left;">
							<% if (title) { %>
								<h3 class="avoid-auto-linking" style="margin: 0; color: #5D6879; font-family: Georgia, serif; font-size: 24px; font-weight: normal; line-height: 1.3; margin: 0; padding: 0; text-align: left; word-wrap: normal;">
									<%= title %>
								</h3>
							<% } %>
						</th>
						<tr><td>
							<p style="height: 20px; margin: 0; padding: 0;">&#xA0;</p>

							<% if (greeting) { %>
								<p style="margin: 0 10px 0 0; padding: 0;">
									<%= greeting %>
								</p>
							<% } %>

							<p class="avoid-auto-linking" style="margin: 0 10px 0 0; padding: 0;">
								<%= message %>
							</p>

							<% if (secondaryMessage) { %>
								<p class="avoid-auto-linking" style="margin: 0 10px 0 0; padding: 0;">
									<%= secondaryMessage %>
								</p>
							<% } %>
						</td></tr>
					</tr>
				</table>
			</th>
	</tr></tbody></table>
<% if (gmailGoToAction) { %>
	<script type="application/ld+json">
		<%=
			StringHelper.stringifyJsonForScript({
				"@context": "http://schema.org",
				"@type": "EmailMessage",
				"potentialAction": {
					"@type": "ViewAction",
					"target": gmailGoToAction.target,
					"url": gmailGoToAction.target,
					"name": gmailGoToAction.name
				},
				"description": gmailGoToAction.description
			})
    %>
	</script>
<% } %>\
`)
