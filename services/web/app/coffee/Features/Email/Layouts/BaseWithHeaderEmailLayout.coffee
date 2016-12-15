_ = require("underscore")
settings = require "settings-sharelatex"

module.exports = _.template """
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en" style="Margin: 0; background: #f6f6f6 !important; margin: 0; min-height: 100%; padding: 0;">
	<head>
		
		
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
		<meta name="viewport" content="width=device-width">
		<title>Project invite</title>
		<style>.avoid-auto-linking a,
.avoid-auto-linking a[href] {
	color: #a93529 !important;
	text-decoration: none !important;
	-moz-hyphens: none;
	-ms-hyphens: none;
	-webkit-hyphens: none;
	hyphens: none; }
	.avoid-auto-linking a:visited,
	.avoid-auto-linking a[href]:visited {
		color: #a93529; }
	.avoid-auto-linking a:hover,
	.avoid-auto-linking a[href]:hover {
		color: #80281f; }
	.avoid-auto-linking a:active,
	.avoid-auto-linking a[href]:active {
		color: #80281f; }
@media only screen {
	html {
		min-height: 100%;
		background: #f6f6f6;
	}
}

@media only screen and (max-width: 596px) {
	.small-float-center {
		margin: 0 auto !important;
		float: none !important;
		text-align: center !important;
	}

	.small-text-center {
		text-align: center !important;
	}

	.small-text-left {
		text-align: left !important;
	}

	.small-text-right {
		text-align: right !important;
	}
}

@media only screen and (max-width: 596px) {
	.hide-for-large {
		display: block !important;
		width: auto !important;
		overflow: visible !important;
		max-height: none !important;
		font-size: inherit !important;
		line-height: inherit !important;
	}
}

@media only screen and (max-width: 596px) {
	table.body table.container .hide-for-large,
	table.body table.container .row.hide-for-large {
		display: table !important;
		width: 100% !important;
	}
}

@media only screen and (max-width: 596px) {
	table.body table.container .callout-inner.hide-for-large {
		display: table-cell !important;
		width: 100% !important;
	}
}

@media only screen and (max-width: 596px) {
	table.body table.container .show-for-large {
		display: none !important;
		width: 0;
		mso-hide: all;
		overflow: hidden;
	}
}

@media only screen and (max-width: 596px) {
	table.body img {
		width: auto;
		height: auto;
	}

	table.body center {
		min-width: 0 !important;
	}

	table.body .container {
		width: 95% !important;
	}

	table.body .columns,
	table.body .column {
		height: auto !important;
		-moz-box-sizing: border-box;
		-webkit-box-sizing: border-box;
		box-sizing: border-box;
		padding-left: 16px !important;
		padding-right: 16px !important;
	}

	table.body .columns .column,
	table.body .columns .columns,
	table.body .column .column,
	table.body .column .columns {
		padding-left: 0 !important;
		padding-right: 0 !important;
	}

	table.body .collapse .columns,
	table.body .collapse .column {
		padding-left: 0 !important;
		padding-right: 0 !important;
	}

	td.small-1,
	th.small-1 {
		display: inline-block !important;
		width: 8.33333% !important;
	}

	td.small-2,
	th.small-2 {
		display: inline-block !important;
		width: 16.66667% !important;
	}

	td.small-3,
	th.small-3 {
		display: inline-block !important;
		width: 25% !important;
	}

	td.small-4,
	th.small-4 {
		display: inline-block !important;
		width: 33.33333% !important;
	}

	td.small-5,
	th.small-5 {
		display: inline-block !important;
		width: 41.66667% !important;
	}

	td.small-6,
	th.small-6 {
		display: inline-block !important;
		width: 50% !important;
	}

	td.small-7,
	th.small-7 {
		display: inline-block !important;
		width: 58.33333% !important;
	}

	td.small-8,
	th.small-8 {
		display: inline-block !important;
		width: 66.66667% !important;
	}

	td.small-9,
	th.small-9 {
		display: inline-block !important;
		width: 75% !important;
	}

	td.small-10,
	th.small-10 {
		display: inline-block !important;
		width: 83.33333% !important;
	}

	td.small-11,
	th.small-11 {
		display: inline-block !important;
		width: 91.66667% !important;
	}

	td.small-12,
	th.small-12 {
		display: inline-block !important;
		width: 100% !important;
	}

	.columns td.small-12,
	.column td.small-12,
	.columns th.small-12,
	.column th.small-12 {
		display: block !important;
		width: 100% !important;
	}

	table.body td.small-offset-1,
	table.body th.small-offset-1 {
		margin-left: 8.33333% !important;
		Margin-left: 8.33333% !important;
	}

	table.body td.small-offset-2,
	table.body th.small-offset-2 {
		margin-left: 16.66667% !important;
		Margin-left: 16.66667% !important;
	}

	table.body td.small-offset-3,
	table.body th.small-offset-3 {
		margin-left: 25% !important;
		Margin-left: 25% !important;
	}

	table.body td.small-offset-4,
	table.body th.small-offset-4 {
		margin-left: 33.33333% !important;
		Margin-left: 33.33333% !important;
	}

	table.body td.small-offset-5,
	table.body th.small-offset-5 {
		margin-left: 41.66667% !important;
		Margin-left: 41.66667% !important;
	}

	table.body td.small-offset-6,
	table.body th.small-offset-6 {
		margin-left: 50% !important;
		Margin-left: 50% !important;
	}

	table.body td.small-offset-7,
	table.body th.small-offset-7 {
		margin-left: 58.33333% !important;
		Margin-left: 58.33333% !important;
	}

	table.body td.small-offset-8,
	table.body th.small-offset-8 {
		margin-left: 66.66667% !important;
		Margin-left: 66.66667% !important;
	}

	table.body td.small-offset-9,
	table.body th.small-offset-9 {
		margin-left: 75% !important;
		Margin-left: 75% !important;
	}

	table.body td.small-offset-10,
	table.body th.small-offset-10 {
		margin-left: 83.33333% !important;
		Margin-left: 83.33333% !important;
	}

	table.body td.small-offset-11,
	table.body th.small-offset-11 {
		margin-left: 91.66667% !important;
		Margin-left: 91.66667% !important;
	}

	table.body table.columns td.expander,
	table.body table.columns th.expander {
		display: none !important;
	}

	table.body .right-text-pad,
	table.body .text-pad-right {
		padding-left: 10px !important;
	}

	table.body .left-text-pad,
	table.body .text-pad-left {
		padding-right: 10px !important;
	}

	table.menu {
		width: 100% !important;
	}

	table.menu td,
	table.menu th {
		width: auto !important;
		display: inline-block !important;
	}

	table.menu.vertical td,
	table.menu.vertical th,
	table.menu.small-vertical td,
	table.menu.small-vertical th {
		display: block !important;
	}

	table.menu[align="center"] {
		width: auto !important;
	}

	table.button.small-expand,
	table.button.small-expanded {
		width: 100% !important;
	}

	table.button.small-expand table,
	table.button.small-expanded table {
		width: 100%;
	}

	table.button.small-expand table a,
	table.button.small-expanded table a {
		text-align: center !important;
		width: 100% !important;
		padding-left: 0 !important;
		padding-right: 0 !important;
	}

	table.button.small-expand center,
	table.button.small-expanded center {
		min-width: 0;
	}
}</style>
	</head>
	<body leftmargin="0" topmargin="0" marginwidth="0" marginheight="0" bgcolor="#F6F6F6" style="-moz-box-sizing: border-box; -ms-text-size-adjust: 100%; -webkit-box-sizing: border-box; -webkit-text-size-adjust: 100%; Margin: 0; background: #f6f6f6 !important; box-sizing: border-box; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0; min-height: 100%; min-width: 100%; padding: 0; text-align: left; width: 100% !important;">
		<!-- <span class="preheader"></span> -->
		<table class="body" border="0" cellspacing="0" cellpadding="0" width="100%" height="100%" style="Margin: 0; background: #f6f6f6 !important; border-collapse: collapse; border-spacing: 0; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; height: 100%; line-height: 1.3; margin: 0; min-height: 100%; padding: 0; text-align: left; vertical-align: top; width: 100%;">
			<tr style="padding: 0; text-align: left; vertical-align: top;">
				<td class="body-cell" align="center" valign="top" bgcolor="#F6F6F6" style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; background: #f6f6f6 !important; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; hyphens: auto; line-height: 1.3; margin: 0; padding: 0; padding-bottom: 20px; text-align: left; vertical-align: top; word-wrap: break-word;">
					<center data-parsed="" style="min-width: 580px; width: 100%;">
						
						<table align="center" class="wrapper header float-center" style="Margin: 0 auto; background: #fefefe; border-bottom: solid 1px #cfcfcf; border-collapse: collapse; border-spacing: 0; float: none; margin: 0 auto; padding: 0; text-align: center; vertical-align: top; width: 100%;"><tr style="padding: 0; text-align: left; vertical-align: top;"><td class="wrapper-inner" style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; hyphens: auto; line-height: 1.3; margin: 0; padding: 20px; text-align: left; vertical-align: top; word-wrap: break-word;">
							<table align="center" class="container" style="Margin: 0 auto; background: transparent; border-collapse: collapse; border-spacing: 0; margin: 0 auto; padding: 0; text-align: inherit; vertical-align: top; width: 580px;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;"><td style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; hyphens: auto; line-height: 1.3; margin: 0; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">
							<table class="row collapse" style="border-collapse: collapse; border-spacing: 0; display: table; padding: 0; position: relative; text-align: left; vertical-align: top; width: 100%;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;">
								<th class="small-12 large-12 columns first last" style="Margin: 0 auto; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0 auto; padding: 0; padding-bottom: 0; padding-left: 0; padding-right: 0; text-align: left; width: 588px;"><table style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;"><tr style="padding: 0; text-align: left; vertical-align: top;"><th style="Margin: 0; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0; padding: 0; text-align: left;">
								<h1 class="sl-logotype" style="Margin: 0; Margin-bottom: 0; color: #333333; font-family: Baskerville, 'Baskerville Old Face', Georgia, serif; font-size: 26px; font-weight: normal; line-height: 1.3; margin: 0; margin-bottom: 0; padding: 0; text-align: left; word-wrap: normal;">
									<span>S</span><span class="sl-logotype-small" style="font-size: 80%;">HARE</span><span>L</span><span class="sl-logotype-small" style="font-size: 80%;">A</span><span>T</span><span class="sl-logotype-small" style="font-size: 80%;">E</span><span>X</span>
								</h1>
								</th>
								<th class="expander" style="Margin: 0; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0; padding: 0 !important; text-align: left; visibility: hidden; width: 0;"></th></tr></table></th>
							</tr></tbody></table>
							</td></tr></tbody></table>
						</td></tr></table>
						<table class="spacer float-center" style="Margin: 0 auto; border-collapse: collapse; border-spacing: 0; float: none; margin: 0 auto; padding: 0; text-align: center; vertical-align: top; width: 100%;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;"><td height="20px" style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: normal; hyphens: auto; line-height: 20px; margin: 0; mso-line-height-rule: exactly; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">&#xA0;</td></tr></tbody></table> 
						<table align="center" class="container main float-center" style="Margin: 0 auto; Margin-top: 10px; background: #fefefe; border-collapse: collapse; border-spacing: 0; float: none; margin: 0 auto; margin-top: 10px; padding: 0; text-align: center; vertical-align: top; width: 580px;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;"><td style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; hyphens: auto; line-height: 1.3; margin: 0; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">
							<table class="spacer" style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;"><td height="20px" style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: normal; hyphens: auto; line-height: 20px; margin: 0; mso-line-height-rule: exactly; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">&#xA0;</td></tr></tbody></table> 
							
							<%= body %>
							
							<table class="wrapper secondary" align="center" style="background: #f6f6f6; border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;"><tr style="padding: 0; text-align: left; vertical-align: top;"><td class="wrapper-inner" style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; hyphens: auto; line-height: 1.3; margin: 0; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">
								<table class="spacer" style="border-collapse: collapse; border-spacing: 0; padding: 0; text-align: left; vertical-align: top; width: 100%;"><tbody><tr style="padding: 0; text-align: left; vertical-align: top;"><td height="10px" style="-moz-hyphens: auto; -webkit-hyphens: auto; Margin: 0; border-collapse: collapse !important; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 10px; font-weight: normal; hyphens: auto; line-height: 10px; margin: 0; mso-line-height-rule: exactly; padding: 0; text-align: left; vertical-align: top; word-wrap: break-word;">&#xA0;</td></tr></tbody></table> 
								<p style="Margin: 0; Margin-bottom: 10px; color: #0a0a0a; font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: normal; line-height: 1.3; margin: 0; margin-bottom: 10px; padding: 0; text-align: left;"><small style="color: #7a7a7a; font-size: 80%;">ShareLaTeX &bull; <a href="www.sharelatex.com" style="Margin: 0; color: #a93529; font-family: Helvetica, Arial, sans-serif; font-weight: normal; line-height: 1.3; margin: 0; padding: 0; text-align: left; text-decoration: none;">www.sharelatex.com</a></small></p>
							</td></tr></table>
						</td></tr></tbody></table>
						
					</center>
				</td>
			</tr>
		</table>
		<!-- prevent Gmail on iOS font size manipulation -->
	 <div style="display:none; white-space:nowrap; font:15px courier; line-height:0;"> &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; </div>
	</body>
</html>

"""
