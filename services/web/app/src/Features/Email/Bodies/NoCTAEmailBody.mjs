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

<% if (highlightedText) { %>
<div style="text-align: center; color: ${colors.textDark}; font-size: 20px; margin: 16px 0; padding: 16px 8px; border-radius: 8px; background-color: ${colors.background};">
  <b><%= highlightedText %></b>
</div>
<% } %>\
`)
