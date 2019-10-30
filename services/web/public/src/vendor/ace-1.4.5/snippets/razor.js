ace.define("ace/snippets/razor",[], function(require, exports, module) {
"use strict";

exports.snippetText = "snippet if\n\
(${1} == ${2}) {\n\
	${3}\n\
}";
exports.scope = "razor";

});
                (function() {
                    ace.require(["ace/snippets/razor"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            