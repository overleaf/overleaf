/* ===================================================
 * bootstrap-tagmanager.js v2.4.1
 * http://welldonethings.com/tags/manager
 * ===================================================
 * Copyright 2012 Max Favilli
 *
 * Licensed under the Mozilla Public License, Version 2.0 You may not use this work except in compliance with the License.
 *
 * http://www.mozilla.org/MPL/2.0/
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

(function($){

  "use strict";

  if (typeof console === "undefined" || typeof console.log === "undefined") {
    console = {};
    console.log = function () { };
  }

  $.fn.tagsManager = function (options,tagToManipulate) {
    var tagManagerOptions = {
      prefilled: null,
      CapitalizeFirstLetter: false,
      preventSubmitOnEnter: true, // deprecated
      isClearInputOnEsc: true, // deprecated
      typeahead: false,
      typeaheadAjaxMethod: "POST",
      typeaheadAjaxSource: null,
      typeaheadAjaxPolling: false,
      typeaheadOverrides: null,
      typeaheadDelegate: {},
      typeaheadSource: null,
      AjaxPush: null,
      AjaxPushAllTags: null,
      AjaxPushParameters: null,
      delimiters: [9,13,44], // tab, enter, comma
      backspace: [8],
      maxTags: 0,
      hiddenTagListName: null,
      hiddenTagListId: null,
      deleteTagsOnBackspace: true, // deprecated
      tagsContainer: null,
      tagCloseIcon: '×',
      tagClass: '',
      validator: null,
      onlyTagList: false
    };

    var TypeaheadOverrides = (function () {
      function TypeaheadOverrides() {
        this.instanceSelectHandler = null;
        this.selectedClass = "selected";
        this.select = null;
        if ("typeahead" in $.fn) {
          this.instanceSelectHandler = $.fn.typeahead.Constructor.prototype.select;
          this.select = function (overrides) {
            this.$menu.find(".active").addClass(overrides.selectedClass);
            overrides.instanceSelectHandler.apply(this, arguments);
          };
        }
      }
      return TypeaheadOverrides;
    })();

    // exit when no matched elements
    if (!(0 in this)) {
      return this;
    }

    tagManagerOptions.typeaheadOverrides = new TypeaheadOverrides();

    $.extend(tagManagerOptions, options);

    if (tagManagerOptions.hiddenTagListName === null) {
      tagManagerOptions.hiddenTagListName = "hidden-" + this.attr('name');
    }

    var obj = this;
    var objName = obj.attr('name').replace(/[^\w]/g, '_');
    var delimiters = tagManagerOptions.delimeters || tagManagerOptions.delimiters; // 'delimeter' is deprecated
    // delimiter values to be handled as key codes
    var keyNums = [9,13,17,18,19,37,38,39,40];
    var delimiterChars = [], delimiterKeys = [];
    $.each(delimiters, function(i,v){
      if ( $.inArray(v, keyNums) != -1 ){
        delimiterKeys.push(v);
      } else {
        delimiterChars.push(v);
      }
    });
    var baseDelimiter = String.fromCharCode(delimiterChars[0] || 44);
    var backspace = tagManagerOptions.backspace;
    var tagBaseClass = 'tm-tag';
    var inputBaseClass = 'tm-input';

    if ($.isFunction(tagManagerOptions.validator)) obj.data('validator', tagManagerOptions.validator);

    var setupTypeahead = function () {
      if (!obj.typeahead) return;

      var taOpts = tagManagerOptions.typeaheadDelegate;

      if (tagManagerOptions.typeaheadSource != null && $.isFunction(tagManagerOptions.typeaheadSource)) {
        $.extend(taOpts, { source: tagManagerOptions.typeaheadSource });
        obj.typeahead(taOpts);
      } else if (tagManagerOptions.typeaheadSource != null) {
        obj.typeahead(taOpts);
        setTypeaheadSource(tagManagerOptions.typeaheadSource);
      } else if (tagManagerOptions.typeaheadAjaxSource != null) {
        if (!tagManagerOptions.typeaheadAjaxPolling) {
          obj.typeahead(taOpts);

          if (typeof (tagManagerOptions.typeaheadAjaxSource) == "string") {
            $.ajax({
              cache: false,
              type: tagManagerOptions.typeaheadAjaxMethod,
              contentType: "application/json",
              dataType: "json",
              url: tagManagerOptions.typeaheadAjaxSource,
              data: JSON.stringify({ typeahead: "" }),
              success: function (data) { onTypeaheadAjaxSuccess(data, true); }
            });
          }
        } else if (tagManagerOptions.typeaheadAjaxPolling) {
          $.extend(taOpts, { source: ajaxPolling });
          obj.typeahead(taOpts);
        }
      }

      var data = obj.data('typeahead');
      if (data) {
        // set the overrided handler
        data.select = $.proxy(tagManagerOptions.typeaheadOverrides.select,
          obj.data('typeahead'),
          tagManagerOptions.typeaheadOverrides);
      }
    };

    var onTypeaheadAjaxSuccess = function(data, isSetTypeaheadSource, process) {
      // format data if it is an asp.net 3.5 response
      if ("d" in data) {
        data = data.d;
      }

      if (data && data.tags) {
        var sourceAjaxArray = [];
        sourceAjaxArray.length = 0;
        $.each(data.tags, function (key, val) {
          sourceAjaxArray.push(val.tag);
          if (isSetTypeaheadSource) {
            setTypeaheadSource(sourceAjaxArray);
          }
        });

        if ($.isFunction(process)) {
          process(sourceAjaxArray);
        }
      }
    };

    var setTypeaheadSource = function (source) {
      obj.data('active', true);
      obj.data('typeahead').source = source;
      tagManagerOptions.typeaheadSource = source;
      obj.data('active', false);
    };

    var typeaheadSelectedItem = function () {
      var listItemSelector = '.' + tagManagerOptions.typeaheadOverrides.selectedClass;
      var typeahead_data = obj.data('typeahead');
      return typeahead_data ? typeahead_data.$menu.find(listItemSelector) : undefined;
    };

    var typeaheadVisible = function () {
      return $('.typeahead:visible')[0];
    };

    var ajaxPolling = function (query, process) {
      if (typeof (tagManagerOptions.typeaheadAjaxSource) == "string") {
        $.ajax({
          cache: false,
          type: "POST",
          contentType: "application/json",
          dataType: "json",
          url: tagManagerOptions.typeaheadAjaxSource,
          data: JSON.stringify({ typeahead: query }),
          success: function (data) { onTypeaheadAjaxSuccess(data, false, process); }
        });
      }
    };

    var tagClasses = function () {
      // 1) default class (tm-tag)
      var cl = tagBaseClass;
      // 2) interpolate from input class: tm-input-xxx --> tm-tag-xxx
      if (obj.attr('class')) {
        $.each(obj.attr('class').split(' '), function(index, value) {
          if (value.indexOf(inputBaseClass+'-') != -1){
            cl += ' ' + tagBaseClass + value.substring(inputBaseClass.length);
          }
        });
      }
      // 3) tags from tagClass option
      cl += (tagManagerOptions.tagClass ? ' ' + tagManagerOptions.tagClass : '');
      return cl;
    };

    var trimTag = function (tag) {
      tag = $.trim(tag);
      // truncate at the first delimiter char
      var i = 0;
      for (i; i < tag.length; i++) {
        if ($.inArray(tag.charCodeAt(i), delimiterChars) != -1) break;
      }
      return tag.substring(0, i);
    };

    var popTag = function () {
      var tlis = obj.data("tlis");
      var tlid = obj.data("tlid");

      if (tlid.length > 0) {
        var tagId = tlid.pop();
        tlis.pop();
        // console.log("TagIdToRemove: " + tagId);
        $("#" + objName + "_" + tagId).remove();
        refreshHiddenTagList();
        // console.log(tlis);
      }
    };

    var empty = function () {
      var tlis = obj.data("tlis");
      var tlid = obj.data("tlid");

      while (tlid.length > 0) {
        var tagId = tlid.pop();
        tlis.pop();
        // console.log("TagIdToRemove: " + tagId);
        $("#" + objName + "_" + tagId).remove();
        refreshHiddenTagList();
        // console.log(tlis);
      }
    };

    var refreshHiddenTagList = function () {
      var tlis = obj.data("tlis");
      var lhiddenTagList = obj.data("lhiddenTagList");

      obj.trigger('tags:refresh', tlis.join(baseDelimiter));

      if (lhiddenTagList) {
        $(lhiddenTagList).val(tlis.join(baseDelimiter)).change();
      }
    };

    var spliceTag = function (tagId) {
      var tlis = obj.data("tlis");
      var tlid = obj.data("tlid");
      window.tlis = tlis
      var p = $.inArray(tagId, tlid);

      var deletedTag = tlis[p]
      sendDeletedTagToServer(deletedTag)
      // console.log("TagIdToRemove: " + tagId);
      // console.log("position: " + p);

      if (-1 != p) {
        $("#" + objName + "_" + tagId).remove();
        tlis.splice(p, 1);
        tlid.splice(p, 1);
        refreshHiddenTagList();
        // console.log(tlis);
      }

      if (tagManagerOptions.maxTags > 0 && tlis.length < tagManagerOptions.maxTags) {
        obj.show();
      }
    };

    var sendDeletedTagToServer = function(tagstring){
      $.post(tagManagerOptions.AjaxPush,  {deletedTag: tagstring});
    }

    var pushAllTags = function (e, tagstring) {
      if (tagManagerOptions.AjaxPushAllTags) {
        $.post(tagManagerOptions.AjaxPush, { tags: tagstring });
      }
    };

    var pushTag = function (tag) {
      tag = trimTag(tag);

      if (!tag || tag.length <= 0) return;

      if (tagManagerOptions.typeaheadSource != null)
      {
          var source = $.isFunction(tagManagerOptions.typeaheadSource) ? 
                      tagManagerOptions.typeaheadSource() : tagManagerOptions.typeaheadSource;
                      
          if(tagManagerOptions.onlyTagList &&
              $.inArray(tag, source) == -1) return;
      }

      if (tagManagerOptions.CapitalizeFirstLetter && tag.length > 1) {
        tag = tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
      }

      // call the validator (if any) and do not let the tag pass if invalid
      if (obj.data('validator') && !obj.data('validator')(tag)) return;

      var tlis = obj.data("tlis");
      var tlid = obj.data("tlid");

      // dont accept new tags beyond the defined maximum
      if (tagManagerOptions.maxTags > 0 && tlis.length >= tagManagerOptions.maxTags) return;

      var alreadyInList = false;
      var tlisLowerCase = tlis.map(function(elem) { return elem.toLowerCase(); });
      var p = $.inArray(tag.toLowerCase(), tlisLowerCase);
      if (-1 != p) {
        // console.log("tag:" + tag + " !!already in list!!");
        alreadyInList = true;
      }

      if (alreadyInList) {
        var pTagId = tlid[p];
        $("#" + objName + "_" + pTagId).stop()
          .animate({ backgroundColor: tagManagerOptions.blinkBGColor_1 }, 100)
          .animate({ backgroundColor: tagManagerOptions.blinkBGColor_2 }, 100)
          .animate({ backgroundColor: tagManagerOptions.blinkBGColor_1 }, 100)
          .animate({ backgroundColor: tagManagerOptions.blinkBGColor_2 }, 100)
          .animate({ backgroundColor: tagManagerOptions.blinkBGColor_1 }, 100)
          .animate({ backgroundColor: tagManagerOptions.blinkBGColor_2 }, 100);
      } else {
        var max = Math.max.apply(null, tlid);
        max = max == -Infinity ? 0 : max;

        var tagId = ++max;
        tlis.push(tag);
        tlid.push(tagId);

        if (tagManagerOptions.AjaxPush != null) {
          $.post(tagManagerOptions.AjaxPush, $.extend({ tag: tag }, tagManagerOptions.AjaxPushParameters));
        }

        // console.log("tagList: " + tlis);

        var newTagId = objName + '_' + tagId;
        var newTagRemoveId = objName + '_Remover_' + tagId;

        var html = '<span class="' + tagClasses() + '" id="' + newTagId + '">';
        html += '<span>' + tag + '</span>';
        html += '<a href="#" class="tm-tag-remove" id="' + newTagRemoveId + '" TagIdToRemove="' + tagId + '">';
        html += tagManagerOptions.tagCloseIcon + '</a></span> ';
        var $el = $(html);

        if (tagManagerOptions.tagsContainer != null) {
          $(tagManagerOptions.tagsContainer).append($el);
        } else {
          obj.before($el);
        }

        $el.find("#" + newTagRemoveId).on("click", obj, function (e) {
          e.preventDefault();
          var TagIdToRemove = parseInt($(this).attr("TagIdToRemove"));
          spliceTag(TagIdToRemove, e.data);
        });

        refreshHiddenTagList();

        if (tagManagerOptions.maxTags > 0 && tlis.length >= tagManagerOptions.maxTags) {
          obj.hide();
        }
      }
      obj.val("");
    };

    var prefill = function (pta) {
      $.each(pta, function (key, val) {
        pushTag(val);
      });
    };

    var killEvent = function (e) {
      e.cancelBubble = true;
      e.returnValue = false;
      e.stopPropagation();
      e.preventDefault();
    };

    var keyInArray = function (e, ary) {
      return $.inArray(e.which, ary) != -1
    };

    var applyDelimiter = function (e) {
      var taItem = typeaheadSelectedItem();
      var taVisible = typeaheadVisible();
      if (!(e.which==13 && taItem && taVisible)) {
        pushTag(obj.val());
      }
      e.preventDefault();
    };

    return this.each(function () {

      if (typeof options == 'string') {
        switch (options) {
          case "empty":
            empty();
            break;
          case "popTag":
            popTag();
            break;
          case "pushTag":
            pushTag(tagToManipulate);
            break;
        }
        return;
      }

      // prevent double-initialization of TagManager
      if ($(this).data('tagManager')){ return false; }
      $(this).data('tagManager', true);

      // store instance-specific data in the DOM object
      var tlis = new Array();
      var tlid = new Array();
      obj.data("tlis", tlis); //list of string tags
      obj.data("tlid", tlid); //list of ID of the string tags

      if (tagManagerOptions.hiddenTagListId == null) { /* if hidden input not given default activity */
        var hiddenTag = $("input[name='" + tagManagerOptions.hiddenTagListName + "']");
        if (hiddenTag.length > 0) {
          hiddenTag.remove();
        }

        var html = "";
        html += "<input name='" + tagManagerOptions.hiddenTagListName + "' type='hidden' value=''/>";
        obj.after(html);
        obj.data("lhiddenTagList",
          obj.siblings("input[name='" + tagManagerOptions.hiddenTagListName + "']")[0]
        );
      } else {
        obj.data("lhiddenTagList", $('#' + tagManagerOptions.hiddenTagListId))
      }

      if (tagManagerOptions.typeahead) {
        setupTypeahead();
      }

      if (tagManagerOptions.AjaxPushAllTags) {
        obj.on('tags:refresh', pushAllTags);
      }

      // hide popovers on focus and keypress events
      obj.on('focus keypress', function (e) {
        if ($(this).popover) {
          $(this).popover('hide');
        }
      });

      // handle ESC (keyup used for browser compatibility)
      if (tagManagerOptions.isClearInputOnEsc) {
        obj.on('keyup', function (e) {
          if (e.which == 27) {
            // console.log('esc detected');
            $(this).val('');
            killEvent(e);
          }
        });
      }

      obj.on('keypress', function (e) {
        // push ASCII-based delimiters
        if (keyInArray(e, delimiterChars)) {
          applyDelimiter(e);
        }
      });

      obj.on('keydown', function (e) {
        // disable ENTER
        if (e.which == 13) {
          if (tagManagerOptions.preventSubmitOnEnter) {
            killEvent(e);
          }
        }

        // push key-based delimiters (includes <enter> by default)
        if (keyInArray(e, delimiterKeys)) {
          applyDelimiter(e);
        }
      });

      // BACKSPACE (keydown used for browser compatibility)
      if (tagManagerOptions.deleteTagsOnBackspace) {
        obj.on('keydown', function (e) {
          if (keyInArray(e, backspace)) {
            // console.log("backspace detected");
            if ($(this).val().length <= 0) {
              popTag();
              killEvent(e);
            }
          }
        });
      }

      obj.change(function (e) {

        if (!/webkit/.test(navigator.userAgent.toLowerCase())) { $(this).focus(); } // why?

        var taItem = typeaheadSelectedItem();
        var taVisible = typeaheadVisible();

        if (taItem && taVisible) {
          taItem.removeClass(tagManagerOptions.typeaheadOverrides.selectedClass);
          pushTag(taItem.attr('data-value'));
          // console.log('change: pushTypeAheadTag ' + tag);
        }
        /* unimplemented mode to push tag on blur
         else if (tagManagerOptions.pushTagOnBlur) {
         console.log('change: pushTagOnBlur ' + tag);
         pushTag($(this).val());
         } */
        killEvent(e);
      });

      if (tagManagerOptions.prefilled != null) {
        if (typeof (tagManagerOptions.prefilled) == "object") {
          prefill(tagManagerOptions.prefilled);
        } else if (typeof (tagManagerOptions.prefilled) == "string") {
          prefill(tagManagerOptions.prefilled.split(baseDelimiter));
        } else if (typeof (tagManagerOptions.prefilled) == "function") {
          prefill(tagManagerOptions.prefilled());
        }
      } else if (tagManagerOptions.hiddenTagListId != null) {
        prefill($('#' + tagManagerOptions.hiddenTagListId).val().split(baseDelimiter));
      }
    });
  }
})(jQuery);
