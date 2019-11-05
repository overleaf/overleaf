ace.define("ace/snippets/asciidoc",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "asciidoc";

});
                (function() {
                    ace.require(["ace/snippets/asciidoc"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            