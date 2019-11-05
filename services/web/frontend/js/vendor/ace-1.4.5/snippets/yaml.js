ace.define("ace/snippets/yaml",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "yaml";

});
                (function() {
                    ace.require(["ace/snippets/yaml"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            