import _ from 'lodash'

export default _.template(`\
	<table class="row" style="border-collapse: collapse; border-spacing: 0; display: table; padding: 0; position: relative; text-align: left; vertical-align: top; width: 100%;">
		<tbody>
			<tr style="padding: 0; vertical-align: top;">
				<th class="small-12 columns" style="line-height: 1.3; margin: 0 auto; padding: 0; padding-bottom: 16px; padding-left: 16px; padding-right: 16px; text-align: left;">
					<table class="cta-table" style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%; color: #5D6879; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3;">
						<tr style="padding: 0; text-align: left; vertical-align: top;">
							<th style="margin: 0; padding: 0; text-align: left;">
								<% if (title) { %>
									<h3 class="force-overleaf-style" style="margin: 0; color: #5D6879; font-family: Georgia, serif; font-size: 24px; font-weight: normal; line-height: 1.3; padding: 0; text-align: left; word-wrap: normal;">
										<%= title %>
									</h3>
								<% } %>
							</th>
							<tr>
								<td>
									<p style="height: 20px; margin: 0; padding: 0;">&#xA0;</p>

									<% if (greeting) { %>
										<p style="margin: 0 0 10px 0; padding: 0;">
											<%= greeting %>
										</p>
									<% } %>

									<% (message).forEach(function(paragraph) { %>
										<p class="force-overleaf-style" style="margin: 0 0 10px 0; padding: 0;">
											<%= paragraph %>
										</p>
									<% }) %>

									<p style="margin: 0; padding: 0;">&#xA0;</p>

									<table style="border-collapse: collapse; border-spacing: 0; float: none; margin: 0 auto; padding: 0; text-align: center; vertical-align: top; width: auto;">
										<tr style="padding: 0; text-align: left; vertical-align: top;">
											<td style="-moz-hyphens: auto; -webkit-hyphens: auto; border-collapse: collapse !important; border-radius: 9999px; color: #5D6879; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; hyphens: auto; line-height: 1.3; margin: 0; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">
												<table style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;">
													<tr style="padding: 0; text-align: left; vertical-align: top;">
														<td style="-moz-hyphens: auto; -webkit-hyphens: auto; background: #4F9C45; border: none; border-collapse: collapse !important; border-radius: 9999px; color: #fefefe; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; hyphens: auto; line-height: 1.3; margin: 0; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">
															<a href="<%= ctaURL %>" style="border: 0 solid #4F9C45; border-radius: 9999px; color: #fefefe; display: inline-block; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: bold; line-height: 1.3; margin: 0; padding: 8px 16px 8px 16px; text-align: left; text-decoration: none;">
																<%= ctaText %>
															</a>
														</td>
													</tr>
												</table>
											</td>
										</tr>
									</table>

									<% if (secondaryMessage && secondaryMessage.length > 0) { %>
										<p style="margin: 0; padding: 0;">&#xA0;</p>

										<% (secondaryMessage).forEach(function(paragraph) { %>
											<p class="force-overleaf-style">
												<%= paragraph %>
											</p>
										<% }) %>
									<% } %>

									<p style="margin: 0; padding: 0;">&#xA0;</p>

									<p class="force-overleaf-style" style="font-size: 12px;">
										If the button above does not appear, please copy and paste this link into your browser's address bar:
									</p>

									<p class="force-overleaf-style" style="font-size: 12px;">
										<%= ctaURL %>
									</p>
								</td>
							</tr>
						</tr>
					</table>
				</th>
			</tr>
		</tbody>
	</table>
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
	<% } %>
\
`)
