# Usage

```
node scripts/learn/checkSanitize/index.mjs https://LEARN_WIKI
```

## Bulk export

There is a bulk export for media wiki pages, but it produces different
 html escaping compared to the regular parse API we use in web.

The bulk export does not escape all the placeholder HTML-like elements,
 like `<project-id` or `<document goes here>`.

## Example output

Here is how a missing tag gets flagged:

```
---
page           : MediaWiki markup for the Overleaf support team
title          : MediaWiki markup for the Overleaf support team
match          : false
toText         : false
text           : "Overleaf</strong></td>\n            </tr>\n           <tr><td>Kb/<strong>TITLE_SLUG</strong></td><td><nowiki>https://www.overleaf.com/learn/how-to/</nowiki><strong>TITLE_SLUG</strong></td>\n           </"
sanitized      : "Overleaf</strong></td>\n            </tr>\n           <tr><td>Kb/<strong>TITLE_SLUG</strong></td><td>&lt;nowiki&gt;https://www.overleaf.com/learn/how-to/&lt;/nowiki&gt;<strong>TITLE_SLUG</strong></td>\n "
textToText     : "    \n        \n        \n            \n                MediaWiki page\n                Maps to on Overleaf\n            \n           Kb/TITLE_SLUGhttps://www.overleaf.com/learn/how-to/TITLE_SLUG\n           "
sanitizedToText: "    \n        \n        \n            \n                MediaWiki page\n                Maps to on Overleaf\n            \n           Kb/TITLE_SLUG<nowiki>https://www.overleaf.com/learn/how-to/</nowiki>TITLE"
```

Note the hidden/escaped `<nowiki>` element.
In addition to the side-by-side comparison of HTML you will see a plain-text diff.
