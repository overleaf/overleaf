ace.define("ace/snippets/toml",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "toml";

});
                (function() {
                    ace.require(["ace/snippets/toml"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            