import _ from 'lodash'
import { fontFamily, colors } from '../emailStyles.mjs'

export default _.template(`\
<% if (title) { %>
<h2 style="margin: 0 0 16px 0; font-family: ${fontFamily}; font-size: 30px; font-weight: 600; color: ${colors.textDark}; line-height: 40px;">
  <%= title %>
</h2>
<% } %>

<% if (greeting) { %>
<p style="margin: 0 0 16px 0;">
  <%= greeting %>
</p>
<% } %>

<% (message).forEach(function(paragraph) { %>
<p class="force-overleaf-style" style="margin: 0 0 16px 0;">
  <%= paragraph %>
</p>
<% }) %>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
  <tr>
    <td bgcolor="${colors.ctaGreen}" style="background-color: ${colors.ctaGreen}; border-radius: 9999px; padding: 6px 16px; text-align: center;">
      <a href="<%= ctaURL %>" style="color: ${colors.ctaText}; display: block; font-family: ${fontFamily}; font-size: 16px; font-weight: 600; line-height: 24px; text-align: center; text-decoration: none; -webkit-hyphens: none; -ms-hyphens: none; hyphens: none;">
        <%= ctaText %>
      </a>
    </td>
  </tr>
</table>

<% if (secondaryMessage && secondaryMessage.length > 0) { %>
  <% (secondaryMessage).forEach(function(paragraph) { %>
  <p class="force-overleaf-style" style="margin: 0 0 16px 0;">
    <%= paragraph %>
  </p>
  <% }) %>
<% } %>

<p style="margin: 0 0 4px 0; font-size: 14px; line-height: 20px; color: ${colors.textMuted};">
  If the button above does not appear, please copy and paste this link into your browser's address bar:
</p>
<p style="margin: 0; font-size: 14px; line-height: 20px; word-break: break-all;">
  <a href="<%= ctaURL %>" style="color: ${colors.linkGreen}; text-decoration: none;"><%= ctaURL %></a>
</p>

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
