ace.define("ace/snippets/maze",[], function(require, exports, module) {
"use strict";

exports.snippetText = "snippet >\n\
description assignment\n\
scope maze\n\
	-> ${1}= ${2}\n\
\n\
snippet >\n\
description if\n\
scope maze\n\
	-> IF ${2:**} THEN %${3:L} ELSE %${4:R}\n\
";
exports.scope = "maze";

});
                (function() {
                    ace.require(["ace/snippets/maze"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            