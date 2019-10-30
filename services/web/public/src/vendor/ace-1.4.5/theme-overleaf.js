ace.define("ace/theme/overleaf",[], function(require, exports, module) {
"use strict";

exports.isDark = false;
exports.cssClass = "ace-overleaf";
exports.cssText = ".ace-overleaf .ace_gutter {\
background: #f0f0f0;\
color: #333;\
}\
.ace-overleaf .ace_print-margin {\
width: 1px;\
background: #e8e8e8;\
}\
.ace-overleaf {\
background-color: #FFFFFF;\
color: black;\
}\
.ace-overleaf .ace_cursor {\
color: black;\
}\
.ace-overleaf .ace_marker-layer .ace_selection {\
background: rgb(181, 213, 255);\
}\
.ace-overleaf.ace_multiselect .ace_selection.ace_start {\
box-shadow: 0 0 3px 0px white;\
}\
.ace-overleaf .ace_marker-layer .ace_step {\
background: rgb(252, 255, 0);\
}\
.ace-overleaf .ace_marker-layer .ace_bracket {\
border: 1px solid #5A5CAD;\
}\
.ace-overleaf .ace_marker-layer .ace_active-line {\
background: rgba(0, 0, 0, 0.07);\
}\
.ace-overleaf .ace_gutter-active-line {\
background-color: #dcdcdc;\
}\
.ace-overleaf .ace_marker-layer .ace_selected-word {\
background: rgb(250, 250, 255);\
border: 1px solid rgb(200, 200, 250);\
}\
.ace-overleaf .ace_fold {\
background-color: #6B72E6;\
}\
.ace-overleaf .ace_comment {\
color: #0080FF;\
font-style: italic;\
}\
.ace-overleaf .ace_storage,\
.ace-overleaf .ace_keyword {\
color: #3F7F7F;\
}\
.ace-overleaf .ace_variable,\
.ace-overleaf .ace_string {\
color: #5A5CAD;\
}\
";
exports.$id = "ace/theme/overleaf";

var dom = require("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
                (function() {
                    ace.require(["ace/theme/overleaf"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            