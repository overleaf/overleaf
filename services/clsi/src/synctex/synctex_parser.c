/* 
Copyright (c) 2008, 2009, 2010 , 2011 jerome DOT laurens AT u-bourgogne DOT fr

This file is part of the SyncTeX package.

Latest Revision: Tue Jun 14 08:23:30 UTC 2011

Version: 1.16

See synctex_parser_readme.txt for more details

License:
--------
Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE

Except as contained in this notice, the name of the copyright holder  
shall not be used in advertising or otherwise to promote the sale,  
use or other dealings in this Software without prior written  
authorization from the copyright holder.

Acknowledgments:
----------------
The author received useful remarks from the pdfTeX developers, especially Hahn The Thanh,
and significant help from XeTeX developer Jonathan Kew

Nota Bene:
----------
If you include or use a significant part of the synctex package into a software,
I would appreciate to be listed as contributor and see "SyncTeX" highlighted.

Version 1
Thu Jun 19 09:39:21 UTC 2008

*/

/*  We assume that high level application like pdf viewers will want
 *  to embed this code as is. We assume that they also have locale.h and setlocale.
 *  For other tools such as TeXLive tools, you must define SYNCTEX_USE_LOCAL_HEADER,
 *  when building. You also have to create and customize synctex_parser_local.h to fit your system.
 *  In particular, the HAVE_LOCALE_H and HAVE_SETLOCALE macros should be properly defined.
 *  With this design, you should not need to edit this file. */

#   if defined(SYNCTEX_USE_LOCAL_HEADER)
#       include "synctex_parser_local.h"
#   else
#       define HAVE_LOCALE_H 1
#       define HAVE_SETLOCALE 1
#       if defined(_MSC_VER) 
#          define SYNCTEX_INLINE __inline
#       else
#          define SYNCTEX_INLINE inline
#       endif
#   endif

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <limits.h>

#if defined(HAVE_LOCALE_H)
#include <locale.h>
#endif

/*  The data is organized in a graph with multiple entries.
 *  The root object is a scanner, it is created with the contents on a synctex file.
 *  Each leaf of the tree is a synctex_node_t object.
 *  There are 3 subtrees, two of them sharing the same leaves.
 *  The first tree is the list of input records, where input file names are associated with tags.
 *  The second tree is the box tree as given by TeX when shipping pages out.
 *  First level objects are sheets, containing boxes, glues, kerns...
 *  The third tree allows to browse leaves according to tag and line.
 */

#include "synctex_parser.h"
#include "synctex_parser_utils.h"

/*  These are the possible extensions of the synctex file */
const char * synctex_suffix = ".synctex";
const char * synctex_suffix_gz = ".gz";

/*  each synctex node has a class */
typedef struct __synctex_class_t _synctex_class_t;
typedef _synctex_class_t * synctex_class_t;


/*  synctex_node_t is a pointer to a node
 *  _synctex_node is the target of the synctex_node_t pointer
 *  It is a pseudo object oriented program.
 *  class is a pointer to the class object the node belongs to.
 *  implementation is meant to contain the private data of the node
 *  basically, there are 2 kinds of information: navigation information and
 *  synctex information. Both will depend on the type of the node,
 *  thus different nodes will have different private data.
 *  There is no inheritancy overhead.
 */
typedef union _synctex_info_t {
	int    INT;
	char * PTR;
} synctex_info_t;

struct _synctex_node {
	synctex_class_t class;
	synctex_info_t * implementation;
};

/*  Each node of the tree, except the scanner itself belongs to a class.
 *  The class object is just a struct declaring the owning scanner
 *  This is a pointer to the scanner as root of the tree.
 *  The type is used to identify the kind of node.
 *  The class declares pointers to a creator and a destructor method.
 *  The log and display fields are used to log and display the node.
 *  display will also display the child, sibling and parent sibling.
 *  parent, child and sibling are used to navigate the tree,
 *  from TeX box hierarchy point of view.
 *  The friend field points to a method which allows to navigate from friend to friend.
 *  A friend is a node with very close tag and line numbers.
 *  Finally, the info field point to a method giving the private node info offset.
 */

typedef synctex_node_t *(*_synctex_node_getter_t)(synctex_node_t);
typedef synctex_info_t *(*_synctex_info_getter_t)(synctex_node_t);

struct __synctex_class_t {
	synctex_scanner_t scanner;
	int type;
	synctex_node_t (*new)(synctex_scanner_t scanner);
	void (*free)(synctex_node_t);
	void (*log)(synctex_node_t);
	void (*display)(synctex_node_t);
	_synctex_node_getter_t parent;
	_synctex_node_getter_t child;
	_synctex_node_getter_t sibling;
	_synctex_node_getter_t friend;
	_synctex_node_getter_t next_box;
	_synctex_info_getter_t info;
};

#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark Abstract OBJECTS and METHODS
#   endif

/*  These macros are shortcuts
 *  This macro checks if a message can be sent.
 */
#   define SYNCTEX_CAN_PERFORM(NODE,SELECTOR)\
		(NULL!=((((NODE)->class))->SELECTOR))

/*  This macro is some kind of objc_msg_send.
 *  It takes care of sending the proper message if possible.
 */
#   define SYNCTEX_MSG_SEND(NODE,SELECTOR) if (NODE && SYNCTEX_CAN_PERFORM(NODE,SELECTOR)) {\
		(*((((NODE)->class))->SELECTOR))(NODE);\
	}

/*  read only safe getter
 */
#   define SYNCTEX_GET(NODE,SELECTOR)((NODE && SYNCTEX_CAN_PERFORM(NODE,SELECTOR))?SYNCTEX_GETTER(NODE,SELECTOR)[0]:(NULL))

/*  read/write getter
 */
#   define SYNCTEX_GETTER(NODE,SELECTOR)\
		((synctex_node_t *)((*((((NODE)->class))->SELECTOR))(NODE)))

#   define SYNCTEX_FREE(NODE) SYNCTEX_MSG_SEND(NODE,free);

/*  Parent getter and setter
 */
#   define SYNCTEX_PARENT(NODE) SYNCTEX_GET(NODE,parent)
#   define SYNCTEX_SET_PARENT(NODE,NEW_PARENT) if (NODE && NEW_PARENT && SYNCTEX_CAN_PERFORM(NODE,parent)){\
		SYNCTEX_GETTER(NODE,parent)[0]=NEW_PARENT;\
	}

/*  Child getter and setter
 */
#   define SYNCTEX_CHILD(NODE) SYNCTEX_GET(NODE,child)
#   define SYNCTEX_SET_CHILD(NODE,NEW_CHILD) if (NODE && NEW_CHILD){\
		SYNCTEX_GETTER(NODE,child)[0]=NEW_CHILD;\
		SYNCTEX_GETTER(NEW_CHILD,parent)[0]=NODE;\
	}

/*  Sibling getter and setter
 */
#   define SYNCTEX_SIBLING(NODE) SYNCTEX_GET(NODE,sibling)
#   define SYNCTEX_SET_SIBLING(NODE,NEW_SIBLING) if (NODE && NEW_SIBLING) {\
		SYNCTEX_GETTER(NODE,sibling)[0]=NEW_SIBLING;\
		if (SYNCTEX_CAN_PERFORM(NEW_SIBLING,parent) && SYNCTEX_CAN_PERFORM(NODE,parent)) {\
			SYNCTEX_GETTER(NEW_SIBLING,parent)[0]=SYNCTEX_GETTER(NODE,parent)[0];\
		}\
	}
/*  Friend getter and setter. A friend is a kern, math, glue or void box node which tag and line numbers are similar.
 *  This is a first filter on the nodes that avoids testing all of them.
 *  Friends are used mainly in forward synchronization aka from source to output.
 */
#   define SYNCTEX_FRIEND(NODE) SYNCTEX_GET(NODE,friend)
#   define SYNCTEX_SET_FRIEND(NODE,NEW_FRIEND) if (NODE && NEW_FRIEND){\
		SYNCTEX_GETTER(NODE,friend)[0]=NEW_FRIEND;\
	}

/*  Next box getter and setter. The box tree can be traversed from one horizontal box to the other.
 *  Navigation starts with the deeper boxes.
 */
#   define SYNCTEX_NEXT_HORIZ_BOX(NODE) SYNCTEX_GET(NODE,next_box)
#   define SYNCTEX_SET_NEXT_HORIZ_BOX(NODE,NEXT_BOX) if (NODE && NEXT_BOX){\
		SYNCTEX_GETTER(NODE,next_box)[0]=NEXT_BOX;\
	}

void _synctex_free_node(synctex_node_t node);
void _synctex_free_leaf(synctex_node_t node);

/*  A node is meant to own its child and sibling.
 *  It is not owned by its parent, unless it is its first child.
 *  This destructor is for all nodes with children.
 */
void _synctex_free_node(synctex_node_t node) {
	if (node) {
		(*((node->class)->sibling))(node);
		SYNCTEX_FREE(SYNCTEX_SIBLING(node));
		SYNCTEX_FREE(SYNCTEX_CHILD(node));
		free(node);
	}
	return;
}

/*  A node is meant to own its child and sibling.
 *  It is not owned by its parent, unless it is its first child.
 *  This destructor is for nodes with no child.
 */
void _synctex_free_leaf(synctex_node_t node) {
	if (node) {
		SYNCTEX_FREE(SYNCTEX_SIBLING(node));
		free(node);
	}
	return;
}
#	ifdef	__SYNCTEX_WORK__
#		include "/usr/include/zlib.h"
#	else
#		include <zlib.h>
#	endif

/*  The synctex scanner is the root object.
 *  Is is initialized with the contents of a text file or a gzipped file.
 *  The buffer_? are first used to parse the text.
 */
struct __synctex_scanner_t {
	gzFile file;                  /*  The (possibly compressed) file */
	char * buffer_cur;            /*  current location in the buffer */
	char * buffer_start;          /*  start of the buffer */
	char * buffer_end;            /*  end of the buffer */
	char * output_fmt;            /*  dvi or pdf, not yet used */
	char * output;                /*  the output name used to create the scanner */
	char * synctex;               /*  the .synctex or .synctex.gz name used to create the scanner */
	int version;                  /*  1, not yet used */
	struct {
		unsigned has_parsed:1;		/*  Whether the scanner has parsed its underlying synctex file. */
		unsigned reserved:sizeof(unsigned)-1;	/*  alignment */
	} flags;
	int pre_magnification;        /*  magnification from the synctex preamble */
	int pre_unit;                 /*  unit from the synctex preamble */
	int pre_x_offset;             /*  X offste from the synctex preamble */
	int pre_y_offset;             /*  Y offset from the synctex preamble */
	int count;                    /*  Number of records, from the synctex postamble */
	float unit;                   /*  real unit, from synctex preamble or post scriptum */
	float x_offset;               /*  X offset, from synctex preamble or post scriptum */
	float y_offset;               /*  Y Offset, from synctex preamble or post scriptum */
	synctex_node_t sheet;         /*  The first sheet node, its siblings are the other sheet nodes */
	synctex_node_t input;         /*  The first input node, its siblings are the other input nodes */
	int number_of_lists;          /*  The number of friend lists */
	synctex_node_t * lists_of_friends;/*  The friend lists */
	_synctex_class_t class[synctex_node_number_of_types]; /*  The classes of the nodes of the scanner */
};

/*  SYNCTEX_CUR, SYNCTEX_START and SYNCTEX_END are convenient shortcuts
 */
#   define SYNCTEX_CUR (scanner->buffer_cur)
#   define SYNCTEX_START (scanner->buffer_start)
#   define SYNCTEX_END (scanner->buffer_end)

#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark OBJECTS, their creators and destructors.
#   endif

/*  Here, we define the indices for the different informations.
 *  They are used to declare the size of the implementation.
 *  For example, if one object uses SYNCTEX_HORIZ_IDX is its size,
 *  then its info will contain a tag, line, column, horiz but no width nor height nor depth
 */

/*  The sheet is a first level node.
 *  It has no parent (the parent is the scanner itself)
 *  Its sibling points to another sheet.
 *  Its child points to its first child, in general a box.
 *  A sheet node contains only one synctex information: the page.
 *  This is the 1 based page index as given by TeX.
 */
/*  The next macros are used to access the node info
 *  SYNCTEX_INFO(node) points to the first synctex integer or pointer data of node
 *  SYNCTEX_INFO(node)[index] is the information at index
 *  for example, the page of a sheet is stored in SYNCTEX_INFO(sheet)[SYNCTEX_PAGE_IDX]
 */
#   define SYNCTEX_INFO(NODE) ((*((((NODE)->class))->info))(NODE))
#   define SYNCTEX_PAGE_IDX 0
#   define SYNCTEX_PAGE(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_PAGE_IDX].INT

/*  This macro defines implementation offsets
 *  It is only used for pointer values
 */
#   define SYNCTEX_MAKE_GET(SYNCTEX_GETTER,OFFSET)\
synctex_node_t * SYNCTEX_GETTER (synctex_node_t node);\
synctex_node_t * SYNCTEX_GETTER (synctex_node_t node) {\
	return node?(synctex_node_t *)((&((node)->implementation))+OFFSET):NULL;\
}
SYNCTEX_MAKE_GET(_synctex_implementation_0,0)
SYNCTEX_MAKE_GET(_synctex_implementation_1,1)
SYNCTEX_MAKE_GET(_synctex_implementation_2,2)
SYNCTEX_MAKE_GET(_synctex_implementation_3,3)
SYNCTEX_MAKE_GET(_synctex_implementation_4,4)
SYNCTEX_MAKE_GET(_synctex_implementation_5,5)

typedef struct {
	synctex_class_t class;
	synctex_info_t implementation[3+SYNCTEX_PAGE_IDX+1];/*  child, sibling, next box,
	                         *  SYNCTEX_PAGE_IDX */
} synctex_sheet_t;

synctex_node_t _synctex_new_sheet(synctex_scanner_t scanner);
void _synctex_display_sheet(synctex_node_t sheet);
void _synctex_log_sheet(synctex_node_t sheet);

static _synctex_class_t synctex_class_sheet = {
	NULL,                       /*  No scanner yet */
	synctex_node_type_sheet,    /*  Node type */
	&_synctex_new_sheet,        /*  creator */
	&_synctex_free_node,        /*  destructor */
	&_synctex_log_sheet,        /*  log */
	&_synctex_display_sheet,    /*  display */
	NULL,                       /*  No parent */
	&_synctex_implementation_0, /*  child */
	&_synctex_implementation_1, /*  sibling */
	NULL,                       /*  No friend */
	&_synctex_implementation_2, /*  Next box */
	(_synctex_info_getter_t)&_synctex_implementation_3  /*  info */
};

/*  sheet node creator */
synctex_node_t _synctex_new_sheet(synctex_scanner_t scanner) {
	synctex_node_t node = _synctex_malloc(sizeof(synctex_sheet_t));
	if (node) {
		node->class = scanner?scanner->class+synctex_node_type_sheet:(synctex_class_t)&synctex_class_sheet;
	}
	return node;
}

/*  A box node contains navigation and synctex information
 *  There are different kind of boxes.
 *  Only horizontal boxes are treated differently because of their visible size.
 */
#   define SYNCTEX_TAG_IDX 0
#   define SYNCTEX_LINE_IDX (SYNCTEX_TAG_IDX+1)
#   define SYNCTEX_COLUMN_IDX (SYNCTEX_LINE_IDX+1)
#   define SYNCTEX_HORIZ_IDX (SYNCTEX_COLUMN_IDX+1)
#   define SYNCTEX_VERT_IDX (SYNCTEX_HORIZ_IDX+1)
#   define SYNCTEX_WIDTH_IDX (SYNCTEX_VERT_IDX+1)
#   define SYNCTEX_HEIGHT_IDX (SYNCTEX_WIDTH_IDX+1)
#   define SYNCTEX_DEPTH_IDX (SYNCTEX_HEIGHT_IDX+1)
/*  the corresponding info accessors */
#   define SYNCTEX_TAG(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_TAG_IDX].INT
#   define SYNCTEX_LINE(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_LINE_IDX].INT
#   define SYNCTEX_COLUMN(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_COLUMN_IDX].INT
#   define SYNCTEX_HORIZ(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_HORIZ_IDX].INT
#   define SYNCTEX_VERT(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_VERT_IDX].INT
#   define SYNCTEX_WIDTH(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_WIDTH_IDX].INT
#   define SYNCTEX_HEIGHT(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_HEIGHT_IDX].INT
#   define SYNCTEX_DEPTH(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_DEPTH_IDX].INT
#   define SYNCTEX_ABS_WIDTH(NODE) ((SYNCTEX_WIDTH(NODE)>0?SYNCTEX_WIDTH(NODE):-SYNCTEX_WIDTH(NODE)))
#   define SYNCTEX_ABS_HEIGHT(NODE) ((SYNCTEX_HEIGHT(NODE)>0?SYNCTEX_HEIGHT(NODE):-SYNCTEX_HEIGHT(NODE)))
#   define SYNCTEX_ABS_DEPTH(NODE) ((SYNCTEX_DEPTH(NODE)>0?SYNCTEX_DEPTH(NODE):-SYNCTEX_DEPTH(NODE)))

typedef struct {
	synctex_class_t class;
	synctex_info_t implementation[5+SYNCTEX_DEPTH_IDX+1]; /*  parent,child,sibling,friend,next box,
						        *  SYNCTEX_TAG,SYNCTEX_LINE,SYNCTEX_COLUMN,
								*  SYNCTEX_HORIZ,SYNCTEX_VERT,SYNCTEX_WIDTH,SYNCTEX_HEIGHT,SYNCTEX_DEPTH */
} synctex_vert_box_node_t;

synctex_node_t _synctex_new_vbox(synctex_scanner_t scanner);
void _synctex_log_box(synctex_node_t sheet);
void _synctex_display_vbox(synctex_node_t node);

/*  These are static class objects, each scanner will make a copy of them and setup the scanner field.
 */
static _synctex_class_t synctex_class_vbox = {
	NULL,                       /*  No scanner yet */
	synctex_node_type_vbox,     /*  Node type */
	&_synctex_new_vbox,         /*  creator */
	&_synctex_free_node,        /*  destructor */
	&_synctex_log_box,          /*  log */
	&_synctex_display_vbox,     /*  display */
	&_synctex_implementation_0, /*  parent */
	&_synctex_implementation_1, /*  child */
	&_synctex_implementation_2, /*  sibling */
	&_synctex_implementation_3, /*  friend */
	&_synctex_implementation_4, /*  next box */
	(_synctex_info_getter_t)&_synctex_implementation_5
};

/*  vertical box node creator */
synctex_node_t _synctex_new_vbox(synctex_scanner_t scanner) {
	synctex_node_t node = _synctex_malloc(sizeof(synctex_vert_box_node_t));
	if (node) {
		node->class = scanner?scanner->class+synctex_node_type_vbox:(synctex_class_t)&synctex_class_vbox;
	}
	return node;
}

#   define SYNCTEX_HORIZ_V_IDX (SYNCTEX_DEPTH_IDX+1)
#   define SYNCTEX_VERT_V_IDX (SYNCTEX_HORIZ_V_IDX+1)
#   define SYNCTEX_WIDTH_V_IDX (SYNCTEX_VERT_V_IDX+1)
#   define SYNCTEX_HEIGHT_V_IDX (SYNCTEX_WIDTH_V_IDX+1)
#   define SYNCTEX_DEPTH_V_IDX (SYNCTEX_HEIGHT_V_IDX+1)
/*  the corresponding info accessors */
#   define SYNCTEX_HORIZ_V(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_HORIZ_V_IDX].INT
#   define SYNCTEX_VERT_V(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_VERT_V_IDX].INT
#   define SYNCTEX_WIDTH_V(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_WIDTH_V_IDX].INT
#   define SYNCTEX_HEIGHT_V(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_HEIGHT_V_IDX].INT
#   define SYNCTEX_DEPTH_V(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_DEPTH_V_IDX].INT
#   define SYNCTEX_ABS_WIDTH_V(NODE) ((SYNCTEX_WIDTH_V(NODE)>0?SYNCTEX_WIDTH_V(NODE):-SYNCTEX_WIDTH_V(NODE)))
#   define SYNCTEX_ABS_HEIGHT_V(NODE) ((SYNCTEX_HEIGHT_V(NODE)>0?SYNCTEX_HEIGHT_V(NODE):-SYNCTEX_HEIGHT_V(NODE)))
#   define SYNCTEX_ABS_DEPTH_V(NODE) ((SYNCTEX_DEPTH_V(NODE)>0?SYNCTEX_DEPTH_V(NODE):-SYNCTEX_DEPTH_V(NODE)))

/*  Horizontal boxes must contain visible size, because 0 width does not mean emptiness */
typedef struct {
	synctex_class_t class;
	synctex_info_t implementation[5+SYNCTEX_DEPTH_V_IDX+1]; /*parent,child,sibling,friend,next box,
						*  SYNCTEX_TAG,SYNCTEX_LINE,SYNCTEX_COLUMN,
						*  SYNCTEX_HORIZ,SYNCTEX_VERT,SYNCTEX_WIDTH,SYNCTEX_HEIGHT,SYNCTEX_DEPTH,
						*  SYNCTEX_HORIZ_V,SYNCTEX_VERT_V,SYNCTEX_WIDTH_V,SYNCTEX_HEIGHT_V,SYNCTEX_DEPTH_V*/
} synctex_horiz_box_node_t;

synctex_node_t _synctex_new_hbox(synctex_scanner_t scanner);
void _synctex_display_hbox(synctex_node_t node);
void _synctex_log_horiz_box(synctex_node_t sheet);


static _synctex_class_t synctex_class_hbox = {
	NULL,                       /*  No scanner yet */
	synctex_node_type_hbox,     /*  Node type */
	&_synctex_new_hbox,         /*  creator */
	&_synctex_free_node,        /*  destructor */
	&_synctex_log_horiz_box,    /*  log */
	&_synctex_display_hbox,     /*  display */
	&_synctex_implementation_0, /*  parent */
	&_synctex_implementation_1, /*  child */
	&_synctex_implementation_2, /*  sibling */
	&_synctex_implementation_3, /*  friend */
	&_synctex_implementation_4, /*  next box */
	(_synctex_info_getter_t)&_synctex_implementation_5
};

/*  horizontal box node creator */
synctex_node_t _synctex_new_hbox(synctex_scanner_t scanner) {
	synctex_node_t node = _synctex_malloc(sizeof(synctex_horiz_box_node_t));
	if (node) {
		node->class = scanner?scanner->class+synctex_node_type_hbox:(synctex_class_t)&synctex_class_hbox;
	}
	return node;
}

/*  This void box node implementation is either horizontal or vertical
 *  It does not contain a child field.
 */
typedef struct {
	synctex_class_t class;
	synctex_info_t implementation[3+SYNCTEX_DEPTH_IDX+1]; /*  parent,sibling,friend,
	                  *  SYNCTEX_TAG,SYNCTEX_LINE,SYNCTEX_COLUMN,
					  *  SYNCTEX_HORIZ,SYNCTEX_VERT,SYNCTEX_WIDTH,SYNCTEX_HEIGHT,SYNCTEX_DEPTH*/
} synctex_void_box_node_t;

synctex_node_t _synctex_new_void_vbox(synctex_scanner_t scanner);
void _synctex_log_void_box(synctex_node_t sheet);
void _synctex_display_void_vbox(synctex_node_t node);

static _synctex_class_t synctex_class_void_vbox = {
	NULL,                       /*  No scanner yet */
	synctex_node_type_void_vbox,/*  Node type */
	&_synctex_new_void_vbox,    /*  creator */
	&_synctex_free_node,        /*  destructor */
	&_synctex_log_void_box,     /*  log */
	&_synctex_display_void_vbox,/*  display */
	&_synctex_implementation_0, /*  parent */
	NULL,                       /*  No child */
	&_synctex_implementation_1, /*  sibling */
	&_synctex_implementation_2, /*  friend */
	NULL,						/*  No next box */
	(_synctex_info_getter_t)&_synctex_implementation_3
};

/*  vertical void box node creator */
synctex_node_t _synctex_new_void_vbox(synctex_scanner_t scanner) {
	synctex_node_t node = _synctex_malloc(sizeof(synctex_void_box_node_t));
	if (node) {
		node->class = scanner?scanner->class+synctex_node_type_void_vbox:(synctex_class_t)&synctex_class_void_vbox;
	}
	return node;
}

synctex_node_t _synctex_new_void_hbox(synctex_scanner_t scanner);
void _synctex_display_void_hbox(synctex_node_t node);

static _synctex_class_t synctex_class_void_hbox = {
	NULL,                       /*  No scanner yet */
	synctex_node_type_void_hbox,/*  Node type */
	&_synctex_new_void_hbox,    /*  creator */
	&_synctex_free_node,        /*  destructor */
	&_synctex_log_void_box,     /*  log */
	&_synctex_display_void_hbox,/*  display */
	&_synctex_implementation_0, /*  parent */
	NULL,                       /*  No child */
	&_synctex_implementation_1, /*  sibling */
	&_synctex_implementation_2, /*  friend */
	NULL,						/*  No next box */
	(_synctex_info_getter_t)&_synctex_implementation_3
};

/*  horizontal void box node creator */
synctex_node_t _synctex_new_void_hbox(synctex_scanner_t scanner) {
	synctex_node_t node = _synctex_malloc(sizeof(synctex_void_box_node_t));
	if (node) {
		node->class = scanner?scanner->class+synctex_node_type_void_hbox:(synctex_class_t)&synctex_class_void_hbox;
	}
	return node;
}

/*  The medium nodes correspond to kern, glue, penalty and math nodes.  */
typedef struct {
	synctex_class_t class;
	synctex_info_t implementation[3+SYNCTEX_WIDTH_IDX+1]; /*  parent,sibling,friend,
	                  *  SYNCTEX_TAG,SYNCTEX_LINE,SYNCTEX_COLUMN,
					  *  SYNCTEX_HORIZ,SYNCTEX_VERT,SYNCTEX_WIDTH */
} synctex_medium_node_t;

#define SYNCTEX_IS_BOX(NODE)\
	((NODE->class->type == synctex_node_type_vbox)\
	|| (NODE->class->type == synctex_node_type_void_vbox)\
	|| (NODE->class->type == synctex_node_type_hbox)\
	|| (NODE->class->type == synctex_node_type_void_hbox))
	
#define SYNCTEX_HAS_CHILDREN(NODE) (NODE && SYNCTEX_CHILD(NODE))
	
void _synctex_log_medium_node(synctex_node_t node);

/*  math node creator */
synctex_node_t _synctex_new_math(synctex_scanner_t scanner);
void _synctex_display_math(synctex_node_t node);

static _synctex_class_t synctex_class_math = {
	NULL,                       /*  No scanner yet */
	synctex_node_type_math,     /*  Node type */
	&_synctex_new_math,         /*  creator */
	&_synctex_free_leaf,        /*  destructor */
	&_synctex_log_medium_node,  /*  log */
	&_synctex_display_math,     /*  display */
	&_synctex_implementation_0, /*  parent */
	NULL,                       /*  No child */
	&_synctex_implementation_1, /*  sibling */
	&_synctex_implementation_2, /*  friend */
	NULL,                       /*  No next box */
	(_synctex_info_getter_t)&_synctex_implementation_3
};

synctex_node_t _synctex_new_math(synctex_scanner_t scanner) {
	synctex_node_t node = _synctex_malloc(sizeof(synctex_medium_node_t));
	if (node) {
		node->class = scanner?scanner->class+synctex_node_type_math:(synctex_class_t)&synctex_class_math;
	}
	return node;
}

/*  kern node creator */
synctex_node_t _synctex_new_kern(synctex_scanner_t scanner);
void _synctex_display_kern(synctex_node_t node);

static _synctex_class_t synctex_class_kern = {
	NULL,                       /*  No scanner yet */
	synctex_node_type_kern,     /*  Node type */
	&_synctex_new_kern,         /*  creator */
	&_synctex_free_leaf,        /*  destructor */
	&_synctex_log_medium_node,  /*  log */
	&_synctex_display_kern,     /*  display */
	&_synctex_implementation_0, /*  parent */
	NULL,                       /*  No child */
	&_synctex_implementation_1, /*  sibling */
	&_synctex_implementation_2, /*  friend */
	NULL,                       /*  No next box */
	(_synctex_info_getter_t)&_synctex_implementation_3
};

synctex_node_t _synctex_new_kern(synctex_scanner_t scanner) {
	synctex_node_t node = _synctex_malloc(sizeof(synctex_medium_node_t));
	if (node) {
		node->class = scanner?scanner->class+synctex_node_type_kern:(synctex_class_t)&synctex_class_kern;
	}
	return node;
}

/*  The small nodes correspond to glue and boundary nodes.  */
typedef struct {
	synctex_class_t class;
	synctex_info_t implementation[3+SYNCTEX_VERT_IDX+1]; /*  parent,sibling,friend,
	                  *  SYNCTEX_TAG,SYNCTEX_LINE,SYNCTEX_COLUMN,
					  *  SYNCTEX_HORIZ,SYNCTEX_VERT */
} synctex_small_node_t;

void _synctex_log_small_node(synctex_node_t node);
/*  glue node creator */
synctex_node_t _synctex_new_glue(synctex_scanner_t scanner);
void _synctex_display_glue(synctex_node_t node);

static _synctex_class_t synctex_class_glue = {
	NULL,                       /*  No scanner yet */
	synctex_node_type_glue,     /*  Node type */
	&_synctex_new_glue,         /*  creator */
	&_synctex_free_leaf,        /*  destructor */
	&_synctex_log_medium_node,  /*  log */
	&_synctex_display_glue,     /*  display */
	&_synctex_implementation_0, /*  parent */
	NULL,                       /*  No child */
	&_synctex_implementation_1, /*  sibling */
	&_synctex_implementation_2, /*  friend */
	NULL,                       /*  No next box */
	(_synctex_info_getter_t)&_synctex_implementation_3
};
synctex_node_t _synctex_new_glue(synctex_scanner_t scanner) {
	synctex_node_t node = _synctex_malloc(sizeof(synctex_medium_node_t));
	if (node) {
		node->class = scanner?scanner->class+synctex_node_type_glue:(synctex_class_t)&synctex_class_glue;
	}
	return node;
}

/*  boundary node creator */
synctex_node_t _synctex_new_boundary(synctex_scanner_t scanner);
void _synctex_display_boundary(synctex_node_t node);

static _synctex_class_t synctex_class_boundary = {
	NULL,                       /*  No scanner yet */
	synctex_node_type_boundary,     /*  Node type */
	&_synctex_new_boundary, /*  creator */
	&_synctex_free_leaf,        /*  destructor */
	&_synctex_log_small_node,   /*  log */
	&_synctex_display_boundary,     /*  display */
	&_synctex_implementation_0, /*  parent */
	NULL,                       /*  No child */
	&_synctex_implementation_1, /*  sibling */
	&_synctex_implementation_2, /*  friend */
	NULL,                       /*  No next box */
	(_synctex_info_getter_t)&_synctex_implementation_3
};

synctex_node_t _synctex_new_boundary(synctex_scanner_t scanner) {
	synctex_node_t node = _synctex_malloc(sizeof(synctex_small_node_t));
	if (node) {
		node->class = scanner?scanner->class+synctex_node_type_boundary:(synctex_class_t)&synctex_class_boundary;
	}
	return node;
}

#   define SYNCTEX_NAME_IDX (SYNCTEX_TAG_IDX+1)
#   define SYNCTEX_NAME(NODE) SYNCTEX_INFO(NODE)[SYNCTEX_NAME_IDX].PTR

/*  Input nodes only know about their sibling, which is another input node.
 *  The synctex information is the SYNCTEX_TAG and SYNCTEX_NAME*/
typedef struct {
	synctex_class_t class;
	synctex_info_t implementation[1+SYNCTEX_NAME_IDX+1]; /*  sibling,
	                          *  SYNCTEX_TAG,SYNCTEX_NAME */
} synctex_input_t;

synctex_node_t _synctex_new_input(synctex_scanner_t scanner);
void _synctex_free_input(synctex_node_t node);
void _synctex_display_input(synctex_node_t node);
void _synctex_log_input(synctex_node_t sheet);

static _synctex_class_t synctex_class_input = {
	NULL,                       /*  No scanner yet */
	synctex_node_type_input,    /*  Node type */
	&_synctex_new_input,        /*  creator */
	&_synctex_free_input,       /*  destructor */
	&_synctex_log_input,        /*  log */
	&_synctex_display_input,    /*  display */
	NULL,                       /*  No parent */
	NULL,                       /*  No child */
	&_synctex_implementation_0, /*  sibling */
	NULL,                       /*  No friend */
	NULL,                       /*  No next box */
	(_synctex_info_getter_t)&_synctex_implementation_1
};

synctex_node_t _synctex_new_input(synctex_scanner_t scanner) {
	synctex_node_t node = _synctex_malloc(sizeof(synctex_input_t));
	if (node) {
		node->class = scanner?scanner->class+synctex_node_type_input:(synctex_class_t)&synctex_class_input;
	}
	return node;
}
void _synctex_free_input(synctex_node_t node){
	if (node) {
		SYNCTEX_FREE(SYNCTEX_SIBLING(node));
		free(SYNCTEX_NAME(node));
		free(node);
	}
}
#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark Navigation
#   endif
synctex_node_t synctex_node_parent(synctex_node_t node)
{
	return SYNCTEX_PARENT(node);
}
synctex_node_t synctex_node_sheet(synctex_node_t node)
{
	while(node && node->class->type != synctex_node_type_sheet) {
		node = SYNCTEX_PARENT(node);
	}
	/*  exit the while loop either when node is NULL or node is a sheet */
	return node;
}
synctex_node_t synctex_node_child(synctex_node_t node)
{
	return SYNCTEX_CHILD(node);
}
synctex_node_t synctex_node_sibling(synctex_node_t node)
{
	return SYNCTEX_SIBLING(node);
}
synctex_node_t synctex_node_next(synctex_node_t node) {
	if (SYNCTEX_CHILD(node)) {
		return SYNCTEX_CHILD(node);
	}
sibling:
	if (SYNCTEX_SIBLING(node)) {
		return SYNCTEX_SIBLING(node);
	}
	if ((node = SYNCTEX_PARENT(node))) {
		if (node->class->type == synctex_node_type_sheet) {/*  EXC_BAD_ACCESS? */
			return NULL;
		}
		goto sibling;
	}
	return NULL;
}
#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark CLASS
#   endif

/*  Public node accessor: the type  */
synctex_node_type_t synctex_node_type(synctex_node_t node) {
	if (node) {
		return (((node)->class))->type;
	}
	return synctex_node_type_error;
}

/*  Public node accessor: the human readable type  */
const char * synctex_node_isa(synctex_node_t node) {
static const char * isa[synctex_node_number_of_types] =
		{"Not a node","input","sheet","vbox","void vbox","hbox","void hbox","kern","glue","math","boundary"};
	return isa[synctex_node_type(node)];
}

#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark SYNCTEX_LOG
#   endif

#   define SYNCTEX_LOG(NODE) SYNCTEX_MSG_SEND(NODE,log)

/*  Public node logger  */
void synctex_node_log(synctex_node_t node) {
	SYNCTEX_LOG(node);
}

#   define SYNCTEX_DISPLAY(NODE) SYNCTEX_MSG_SEND(NODE,display)

void synctex_node_display(synctex_node_t node) {
	SYNCTEX_DISPLAY(node);
}

void _synctex_display_input(synctex_node_t node) {
	printf("....Input:%i:%s\n",
		SYNCTEX_TAG(node),
		SYNCTEX_NAME(node));
	SYNCTEX_DISPLAY(SYNCTEX_SIBLING(node));
}

void _synctex_log_sheet(synctex_node_t sheet) {
	if (sheet) {
		printf("%s:%i\n",synctex_node_isa(sheet),SYNCTEX_PAGE(sheet));
		printf("SELF:%p",(void *)sheet);
		printf(" SYNCTEX_PARENT:%p",(void *)SYNCTEX_PARENT(sheet));
		printf(" SYNCTEX_CHILD:%p",(void *)SYNCTEX_CHILD(sheet));
		printf(" SYNCTEX_SIBLING:%p",(void *)SYNCTEX_SIBLING(sheet));
		printf(" SYNCTEX_FRIEND:%p\n",(void *)SYNCTEX_FRIEND(sheet));
	}
}

void _synctex_log_small_node(synctex_node_t node) {
	printf("%s:%i,%i:%i,%i\n",
		synctex_node_isa(node),
		SYNCTEX_TAG(node),
		SYNCTEX_LINE(node),
		SYNCTEX_HORIZ(node),
		SYNCTEX_VERT(node));
	printf("SELF:%p",(void *)node);
	printf(" SYNCTEX_PARENT:%p",(void *)SYNCTEX_PARENT(node));
	printf(" SYNCTEX_CHILD:%p",(void *)SYNCTEX_CHILD(node));
	printf(" SYNCTEX_SIBLING:%p",(void *)SYNCTEX_SIBLING(node));
	printf(" SYNCTEX_FRIEND:%p\n",(void *)SYNCTEX_FRIEND(node));
}

void _synctex_log_medium_node(synctex_node_t node) {
	printf("%s:%i,%i:%i,%i:%i\n",
		synctex_node_isa(node),
		SYNCTEX_TAG(node),
		SYNCTEX_LINE(node),
		SYNCTEX_HORIZ(node),
		SYNCTEX_VERT(node),
		SYNCTEX_WIDTH(node));
	printf("SELF:%p",(void *)node);
	printf(" SYNCTEX_PARENT:%p",(void *)SYNCTEX_PARENT(node));
	printf(" SYNCTEX_CHILD:%p",(void *)SYNCTEX_CHILD(node));
	printf(" SYNCTEX_SIBLING:%p",(void *)SYNCTEX_SIBLING(node));
	printf(" SYNCTEX_FRIEND:%p\n",(void *)SYNCTEX_FRIEND(node));
}

void _synctex_log_void_box(synctex_node_t node) {
	printf("%s",synctex_node_isa(node));
	printf(":%i",SYNCTEX_TAG(node));
	printf(",%i",SYNCTEX_LINE(node));
	printf(",%i",0);
	printf(":%i",SYNCTEX_HORIZ(node));
	printf(",%i",SYNCTEX_VERT(node));
	printf(":%i",SYNCTEX_WIDTH(node));
	printf(",%i",SYNCTEX_HEIGHT(node));
	printf(",%i",SYNCTEX_DEPTH(node));
	printf("\nSELF:%p",(void *)node);
	printf(" SYNCTEX_PARENT:%p",(void *)SYNCTEX_PARENT(node));
	printf(" SYNCTEX_CHILD:%p",(void *)SYNCTEX_CHILD(node));
	printf(" SYNCTEX_SIBLING:%p",(void *)SYNCTEX_SIBLING(node));
	printf(" SYNCTEX_FRIEND:%p\n",(void *)SYNCTEX_FRIEND(node));
}

void _synctex_log_box(synctex_node_t node) {
	printf("%s",synctex_node_isa(node));
	printf(":%i",SYNCTEX_TAG(node));
	printf(",%i",SYNCTEX_LINE(node));
	printf(",%i",0);
	printf(":%i",SYNCTEX_HORIZ(node));
	printf(",%i",SYNCTEX_VERT(node));
	printf(":%i",SYNCTEX_WIDTH(node));
	printf(",%i",SYNCTEX_HEIGHT(node));
	printf(",%i",SYNCTEX_DEPTH(node));
	printf("\nSELF:%p",(void *)node);
	printf(" SYNCTEX_PARENT:%p",(void *)SYNCTEX_PARENT(node));
	printf(" SYNCTEX_CHILD:%p",(void *)SYNCTEX_CHILD(node));
	printf(" SYNCTEX_SIBLING:%p",(void *)SYNCTEX_SIBLING(node));
	printf(" SYNCTEX_FRIEND:%p\n",(void *)SYNCTEX_FRIEND(node));
}

void _synctex_log_horiz_box(synctex_node_t node) {
	printf("%s",synctex_node_isa(node));
	printf(":%i",SYNCTEX_TAG(node));
	printf(",%i",SYNCTEX_LINE(node));
	printf(",%i",0);
	printf(":%i",SYNCTEX_HORIZ(node));
	printf(",%i",SYNCTEX_VERT(node));
	printf(":%i",SYNCTEX_WIDTH(node));
	printf(",%i",SYNCTEX_HEIGHT(node));
	printf(",%i",SYNCTEX_DEPTH(node));
	printf("/%i",SYNCTEX_HORIZ_V(node));
	printf(",%i",SYNCTEX_VERT_V(node));
	printf(":%i",SYNCTEX_WIDTH_V(node));
	printf(",%i",SYNCTEX_HEIGHT_V(node));
	printf(",%i",SYNCTEX_DEPTH_V(node));
	printf("\nSELF:%p",(void *)node);
	printf(" SYNCTEX_PARENT:%p",(void *)SYNCTEX_PARENT(node));
	printf(" SYNCTEX_CHILD:%p",(void *)SYNCTEX_CHILD(node));
	printf(" SYNCTEX_SIBLING:%p",(void *)SYNCTEX_SIBLING(node));
	printf(" SYNCTEX_FRIEND:%p\n",(void *)SYNCTEX_FRIEND(node));
}

void _synctex_log_input(synctex_node_t node) {
	printf("%s",synctex_node_isa(node));
	printf(":%i",SYNCTEX_TAG(node));
	printf(",%s",SYNCTEX_NAME(node));
	printf(" SYNCTEX_SIBLING:%p",(void *)SYNCTEX_SIBLING(node));
}

void _synctex_display_sheet(synctex_node_t sheet) {
	if (sheet) {
		printf("....{%i\n",SYNCTEX_PAGE(sheet));
		SYNCTEX_DISPLAY(SYNCTEX_CHILD(sheet));
		printf("....}\n");
		SYNCTEX_DISPLAY(SYNCTEX_SIBLING(sheet));
	}
}

void _synctex_display_vbox(synctex_node_t node) {
	printf("....[%i,%i:%i,%i:%i,%i,%i\n",
		SYNCTEX_TAG(node),
		SYNCTEX_LINE(node),
		SYNCTEX_HORIZ(node),
		SYNCTEX_VERT(node),
		SYNCTEX_WIDTH(node),
		SYNCTEX_HEIGHT(node),
		SYNCTEX_DEPTH(node));
	SYNCTEX_DISPLAY(SYNCTEX_CHILD(node));
	printf("....]\n");
	SYNCTEX_DISPLAY(SYNCTEX_SIBLING(node));
}

void _synctex_display_hbox(synctex_node_t node) {
	printf("....(%i,%i:%i,%i:%i,%i,%i\n",
		SYNCTEX_TAG(node),
		SYNCTEX_LINE(node),
		SYNCTEX_HORIZ(node),
		SYNCTEX_VERT(node),
		SYNCTEX_WIDTH(node),
		SYNCTEX_HEIGHT(node),
		SYNCTEX_DEPTH(node));
	SYNCTEX_DISPLAY(SYNCTEX_CHILD(node));
	printf("....)\n");
	SYNCTEX_DISPLAY(SYNCTEX_SIBLING(node));
}

void _synctex_display_void_vbox(synctex_node_t node) {
	printf("....v%i,%i;%i,%i:%i,%i,%i\n",
		SYNCTEX_TAG(node),
		SYNCTEX_LINE(node),
		SYNCTEX_HORIZ(node),
		SYNCTEX_VERT(node),
		SYNCTEX_WIDTH(node),
		SYNCTEX_HEIGHT(node),
		SYNCTEX_DEPTH(node));
	SYNCTEX_DISPLAY(SYNCTEX_SIBLING(node));
}

void _synctex_display_void_hbox(synctex_node_t node) {
	printf("....h%i,%i:%i,%i:%i,%i,%i\n",
		SYNCTEX_TAG(node),
		SYNCTEX_LINE(node),
		SYNCTEX_HORIZ(node),
		SYNCTEX_VERT(node),
		SYNCTEX_WIDTH(node),
		SYNCTEX_HEIGHT(node),
		SYNCTEX_DEPTH(node));
	SYNCTEX_DISPLAY(SYNCTEX_SIBLING(node));
}

void _synctex_display_glue(synctex_node_t node) {
	printf("....glue:%i,%i:%i,%i\n",
		SYNCTEX_TAG(node),
		SYNCTEX_LINE(node),
		SYNCTEX_HORIZ(node),
		SYNCTEX_VERT(node));
	SYNCTEX_DISPLAY(SYNCTEX_SIBLING(node));
}

void _synctex_display_math(synctex_node_t node) {
	printf("....math:%i,%i:%i,%i\n",
		SYNCTEX_TAG(node),
		SYNCTEX_LINE(node),
		SYNCTEX_HORIZ(node),
		SYNCTEX_VERT(node));
	SYNCTEX_DISPLAY(SYNCTEX_SIBLING(node));
}

void _synctex_display_kern(synctex_node_t node) {
	printf("....kern:%i,%i:%i,%i:%i\n",
		SYNCTEX_TAG(node),
		SYNCTEX_LINE(node),
		SYNCTEX_HORIZ(node),
		SYNCTEX_VERT(node),
		SYNCTEX_WIDTH(node));
	SYNCTEX_DISPLAY(SYNCTEX_SIBLING(node));
}

void _synctex_display_boundary(synctex_node_t node) {
	printf("....boundary:%i,%i:%i,%i\n",
		SYNCTEX_TAG(node),
		SYNCTEX_LINE(node),
		SYNCTEX_HORIZ(node),
		SYNCTEX_VERT(node));
	SYNCTEX_DISPLAY(SYNCTEX_SIBLING(node));
}

#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark SCANNER
#   endif

/*  Here are gathered all the possible status that the next scanning functions will return.
 *  All these functions return a status, and pass their result through pointers.
 *  Negative values correspond to errors.
 *  The management of the buffer is causing some significant overhead.
 *  Every function that may access the buffer returns a status related to the buffer and file state.
 *  status >= SYNCTEX_STATUS_OK means the function worked as expected
 *  status < SYNCTEX_STATUS_OK means the function did not work as expected
 *  status == SYNCTEX_STATUS_NOT_OK means the function did not work as expected but there is still some material to parse.
 *  status == SYNCTEX_STATUS_EOF means the function did not work as expected and there is no more material.
 *  status<SYNCTEX_STATUS_EOF means an error
 */
typedef int synctex_status_t;
/*  When the end of the synctex file has been reached: */
#   define SYNCTEX_STATUS_EOF 0
/*  When the function could not return the value it was asked for: */
#   define SYNCTEX_STATUS_NOT_OK (SYNCTEX_STATUS_EOF+1)
/*  When the function returns the value it was asked for: */
#   define SYNCTEX_STATUS_OK (SYNCTEX_STATUS_NOT_OK+1)
/*  Generic error: */
#   define SYNCTEX_STATUS_ERROR -1
/*  Parameter error: */
#   define SYNCTEX_STATUS_BAD_ARGUMENT -2

#   define SYNCTEX_FILE (scanner->file)

/*  Actually, the minimum buffer size is driven by integer and float parsing.
 *  ±0.123456789e123
 */
#   define SYNCTEX_BUFFER_MIN_SIZE 16
#   define SYNCTEX_BUFFER_SIZE 32768

#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark Prototypes
#   endif
void _synctex_log_void_box(synctex_node_t node);
void _synctex_log_box(synctex_node_t node);
void _synctex_log_horiz_box(synctex_node_t node);
void _synctex_log_input(synctex_node_t node);
synctex_status_t _synctex_buffer_get_available_size(synctex_scanner_t scanner, size_t * size_ptr);
synctex_status_t _synctex_next_line(synctex_scanner_t scanner);
synctex_status_t _synctex_match_string(synctex_scanner_t scanner, const char * the_string);
synctex_status_t _synctex_decode_int(synctex_scanner_t scanner, int* value_ref);
synctex_status_t _synctex_decode_string(synctex_scanner_t scanner, char ** value_ref);
synctex_status_t _synctex_scan_input(synctex_scanner_t scanner);
synctex_status_t _synctex_scan_preamble(synctex_scanner_t scanner);
synctex_status_t _synctex_scan_float_and_dimension(synctex_scanner_t scanner, float * value_ref);
synctex_status_t _synctex_scan_post_scriptum(synctex_scanner_t scanner);
int _synctex_scan_postamble(synctex_scanner_t scanner);
synctex_status_t _synctex_setup_visible_box(synctex_node_t box);
synctex_status_t _synctex_horiz_box_setup_visible(synctex_node_t node,int h, int v);
synctex_status_t _synctex_scan_sheet(synctex_scanner_t scanner, synctex_node_t parent);
synctex_status_t _synctex_scan_nested_sheet(synctex_scanner_t scanner);
synctex_status_t _synctex_scan_content(synctex_scanner_t scanner);
int synctex_scanner_pre_x_offset(synctex_scanner_t scanner);
int synctex_scanner_pre_y_offset(synctex_scanner_t scanner);
const char * synctex_scanner_get_output_fmt(synctex_scanner_t scanner);
int _synctex_node_is_box(synctex_node_t node);
int _synctex_bail(void);

/*  Try to ensure that the buffer contains at least size bytes.
 *  Passing a huge size argument means the whole buffer length.
 *  Passing a null size argument means return the available buffer length, without reading the file.
 *  In that case, the return status is always SYNCTEX_STATUS_OK unless the given scanner is NULL,
 *  in which case, SYNCTEX_STATUS_BAD_ARGUMENT is returned.
 *  The value returned in size_ptr is the number of bytes now available in the buffer.
 *  This is a nonnegative integer, it may take the value 0.
 *  It is the responsibility of the caller to test whether this size is conforming to its needs.
 *  Negative values may return in case of error, actually
 *  when there was an error reading the synctex file. */
synctex_status_t _synctex_buffer_get_available_size(synctex_scanner_t scanner, size_t * size_ptr) {
  	size_t available = 0;
	if (NULL == scanner || NULL == size_ptr) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
#   define size (* size_ptr)
	if (size>SYNCTEX_BUFFER_SIZE){
		size = SYNCTEX_BUFFER_SIZE;
	}
	available = SYNCTEX_END - SYNCTEX_CUR; /*  available is the number of unparsed chars in the buffer */
	if (size<=available) {
		/*  There are already sufficiently many characters in the buffer */
		size = available;
		return SYNCTEX_STATUS_OK;
	}
	if (SYNCTEX_FILE) {
		/*  Copy the remaining part of the buffer to the beginning,
		 *  then read the next part of the file */
		int already_read = 0;
		if (available) {
			memmove(SYNCTEX_START, SYNCTEX_CUR, available);
		}
		SYNCTEX_CUR = SYNCTEX_START + available; /*  the next character after the move, will change. */
		/*  Fill the buffer up to its end */
		already_read = gzread(SYNCTEX_FILE,(void *)SYNCTEX_CUR,SYNCTEX_BUFFER_SIZE - available);
		if (already_read>0) {
			/*  We assume that 0<already_read<=SYNCTEX_BUFFER_SIZE - available, such that
			 *  SYNCTEX_CUR + already_read = SYNCTEX_START + available  + already_read <= SYNCTEX_START + SYNCTEX_BUFFER_SIZE */
			SYNCTEX_END = SYNCTEX_CUR + already_read;
			/*  If the end of the file was reached, all the required SYNCTEX_BUFFER_SIZE - available
			 *  may not be filled with values from the file.
			 *  In that case, the buffer should stop properly after already_read characters. */
			* SYNCTEX_END = '\0';
			SYNCTEX_CUR = SYNCTEX_START;
			size = SYNCTEX_END - SYNCTEX_CUR; /* == old available + already_read*/
			return SYNCTEX_STATUS_OK; /*  May be available is less than size, the caller will have to test. */
		} else if (0>already_read) {
			/*  There is a possible error in reading the file */
			int errnum = 0;
			const char * error_string = gzerror(SYNCTEX_FILE, &errnum);
			if (Z_ERRNO == errnum) {
				/*  There is an error in zlib caused by the file system */
				_synctex_error("gzread error from the file system (%i)",errno);
                return SYNCTEX_STATUS_ERROR;
			} else if (errnum) {
				_synctex_error("gzread error (%i:%i,%s)",already_read,errnum,error_string);
                return SYNCTEX_STATUS_ERROR;
			}
		}
        /*  Nothing was read, we are at the end of the file. */
        gzclose(SYNCTEX_FILE);
        SYNCTEX_FILE = NULL;
        SYNCTEX_END = SYNCTEX_CUR;
        SYNCTEX_CUR = SYNCTEX_START;
        * SYNCTEX_END = '\0';/*  Terminate the string properly.*/
        size = SYNCTEX_END - SYNCTEX_CUR;
        return SYNCTEX_STATUS_EOF; /*  there might be a bit of text left */
    }
	/*  We cannot enlarge the buffer because the end of the file was reached. */
	size = available;
 	return SYNCTEX_STATUS_EOF;
#   undef size
}

/*  Used when parsing the synctex file.
 *  Advance to the next character starting a line.
 *  Actually, only '\n' is recognized as end of line marker.
 *  On normal completion, the returned value is the number of unparsed characters available in the buffer.
 *  In general, it is a positive value, 0 meaning that the end of file was reached.
 *  -1 is returned in case of error, actually because there was an error while feeding the buffer.
 *  When the function returns with no error, SYNCTEX_CUR points to the first character of the next line, if any.
 *  J. Laurens: Sat May 10 07:52:31 UTC 2008
 */
synctex_status_t _synctex_next_line(synctex_scanner_t scanner) {
	synctex_status_t status = SYNCTEX_STATUS_OK;
	size_t available = 0;
	if (NULL == scanner) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
infinite_loop:
	while(SYNCTEX_CUR<SYNCTEX_END) {
		if (*SYNCTEX_CUR == '\n') {
			++SYNCTEX_CUR;
			available = 1;
			return _synctex_buffer_get_available_size(scanner, &available);
		}
		++SYNCTEX_CUR;
	}
	/*  Here, we have SYNCTEX_CUR == SYNCTEX_END, such that the next call to _synctex_buffer_get_available_size
	 *  will read another bunch of synctex file. Little by little, we advance to the end of the file. */
	available = 1;
	status = _synctex_buffer_get_available_size(scanner, &available);
	if (status<=0) {
		return status;
	}
	goto infinite_loop;
}

/*  Scan the given string.
 *  Both scanner and the_string must not be NULL, and the_string must not be 0 length.
 *  SYNCTEX_STATUS_OK is returned if the string is found,
 *  SYNCTEX_STATUS_EOF is returned when the EOF is reached,
 *  SYNCTEX_STATUS_NOT_OK is returned is the string is not found,
 *  an error status is returned otherwise.
 *  This is a critical method because buffering renders things more difficult.
 *  The given string might be as long as the maximum size_t value.
 *  As side effect, the buffer state may have changed if the given argument string can't fit into the buffer.
 */
synctex_status_t _synctex_match_string(synctex_scanner_t scanner, const char * the_string) {
	size_t tested_len = 0; /*  the number of characters at the beginning of the_string that match */
	size_t remaining_len = 0; /*  the number of remaining characters of the_string that should match */
	size_t available = 0;
	synctex_status_t status = 0;
	if (NULL == scanner || NULL == the_string) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	remaining_len = strlen(the_string); /*  All the_string should match */
	if (0 == remaining_len) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	/*  How many characters available in the buffer? */
	available = remaining_len;
	status = _synctex_buffer_get_available_size(scanner,&available);
	if (status<SYNCTEX_STATUS_EOF) {
		return status;
	}
	/*  Maybe we have less characters than expected because the buffer is too small. */
	if (available>=remaining_len) {
		/*  The buffer is sufficiently big to hold the expected number of characters. */
		if (strncmp((char *)SYNCTEX_CUR,the_string,remaining_len)) {
			return SYNCTEX_STATUS_NOT_OK;
		}
return_OK:
		/*  Advance SYNCTEX_CUR to the next character after the_string. */
		SYNCTEX_CUR += remaining_len;
		return SYNCTEX_STATUS_OK;
	} else if (strncmp((char *)SYNCTEX_CUR,the_string,available)) {
			/*  No need to goo further, this is not the expected string in the buffer. */
			return SYNCTEX_STATUS_NOT_OK;
	} else if (SYNCTEX_FILE) {
		/*  The buffer was too small to contain remaining_len characters.
		 *  We have to cut the string into pieces. */
		z_off_t offset = 0L;
		/*  the first part of the string is found, advance the_string to the next untested character. */
		the_string += available;
		/*  update the remaining length and the parsed length. */
		remaining_len -= available;
		tested_len += available;
		SYNCTEX_CUR += available; /*  We validate the tested characters. */
		if (0 == remaining_len) {
			/*  Nothing left to test, we have found the given string, we return the length. */
			return tested_len;
		}
		/*  We also have to record the current state of the file cursor because
		 *  if the_string does not match, all this should be a totally blank operation,
		 *  for which the file and buffer states should not be modified at all.
		 *  In fact, the states of the buffer before and after this function are in general different
		 *  but they are totally equivalent as long as the values of the buffer before SYNCTEX_CUR
		 *  can be safely discarded.  */
		offset = gztell(SYNCTEX_FILE);
		/*  offset now corresponds to the first character of the file that was not buffered. */
		available = SYNCTEX_CUR - SYNCTEX_START; /*  available can be used as temporary placeholder. */
		/*  available now corresponds to the number of chars that where already buffered and
		 *  that match the head of the_string. If in fine the_string does not match, all these chars must be recovered
		 *  because the buffer contents is completely replaced by _synctex_buffer_get_available_size.
		 *  They were buffered from offset-len location in the file. */
		offset -= available;
more_characters:
		/*  There is still some work to be done, so read another bunch of file.
		 *  This is the second call to _synctex_buffer_get_available_size,
		 *  which means that the actual contents of the buffer will be discarded.
		 *  We will definitely have to recover the previous state in case we do not find the expected string. */
		available = remaining_len;
		status = _synctex_buffer_get_available_size(scanner,&available);
		if (status<SYNCTEX_STATUS_EOF) {
			return status; /*  This is an error, no need to go further. */
		}
		if (available==0) {
			/*  Missing characters: recover the initial state of the file and return. */
return_NOT_OK:
			if (offset != gzseek(SYNCTEX_FILE,offset,SEEK_SET)) {
				/*  This is a critical error, we could not recover the previous state. */
				_synctex_error("can't seek file");
				return SYNCTEX_STATUS_ERROR;
			}
			/*  Next time we are asked to fill the buffer,
			 *  we will read a complete bunch of text from the file. */
			SYNCTEX_CUR = SYNCTEX_END;
			return SYNCTEX_STATUS_NOT_OK;
		}
		if (available<remaining_len) {
			/*  We'll have to loop one more time. */
			if (strncmp((char *)SYNCTEX_CUR,the_string,available)) {
				/*  This is not the expected string, recover the previous state and return. */
				goto return_NOT_OK;
			}
			/*  Advance the_string to the first untested character. */
			the_string += available;
			/*  update the remaining length and the parsed length. */
			remaining_len -= available;
			tested_len += available;
			SYNCTEX_CUR += available; /*  We validate the tested characters. */
			if (0 == remaining_len) {
				/*  Nothing left to test, we have found the given string. */
				return SYNCTEX_STATUS_OK;
			}
			goto more_characters;
		}
		/*  This is the last step. */
		if (strncmp((char *)SYNCTEX_CUR,the_string,remaining_len)) {
			/*  This is not the expected string, recover the previous state and return. */
			goto return_NOT_OK;
		}
		goto return_OK;
	} else {
		/*  The buffer can't contain the given string argument, and the EOF was reached */
		return SYNCTEX_STATUS_EOF;
	}
}

/*  Used when parsing the synctex file.
 *  Decode an integer.
 *  First, field separators, namely ':' and ',' characters are skipped
 *  The returned value is negative if there is an unrecoverable error.
 *  It is SYNCTEX_STATUS_NOT_OK if an integer could not be parsed, for example
 *  if the characters at the current cursor position are not digits or
 *  if the end of the file has been reached.
 *  It is SYNCTEX_STATUS_OK if an int has been successfully parsed.
 *  The given scanner argument must not be NULL, on the contrary, value_ref may be NULL.
 */
synctex_status_t _synctex_decode_int(synctex_scanner_t scanner, int* value_ref) {
	char * ptr = NULL;
	char * end = NULL;
	int result = 0;
	size_t available = 0;
	synctex_status_t status = 0;
	if (NULL == scanner) {
		 return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	available = SYNCTEX_BUFFER_MIN_SIZE;
	status = _synctex_buffer_get_available_size(scanner, &available);
	if (status<SYNCTEX_STATUS_EOF) {
		return status;/*  Forward error. */
	}
	if (available==0) {
		return SYNCTEX_STATUS_EOF;/*  it is the end of file. */
	}
	ptr = SYNCTEX_CUR;
	if (*ptr==':' || *ptr==',') {
		++ptr;
		--available;
		if (available==0) {
			return SYNCTEX_STATUS_NOT_OK;/*  It is not possible to scan an int */
		}
	}
	result = (int)strtol(ptr, &end, 10);
	if (end>ptr) {
		SYNCTEX_CUR = end;
		if (value_ref) {
			* value_ref = result;
		}
		return SYNCTEX_STATUS_OK;/*  Successfully scanned an int */
	}	
	return SYNCTEX_STATUS_NOT_OK;/*  Could not scan an int */
}

/*  The purpose of this function is to read a string.
 *  A string is an array of characters from the current parser location
 *  and before the next '\n' character.
 *  If a string was properly decoded, it is returned in value_ref and
 *  the cursor points to the new line marker.
 *  The returned string was alloced on the heap, the caller is the owner and
 *  is responsible to free it in due time.
 *  If no string is parsed, * value_ref is undefined.
 *  The maximum length of a string that a scanner can decode is platform dependent, namely UINT_MAX.
 *  If you just want to blindly parse the file up to the end of the current line,
 *  use _synctex_next_line instead.
 *  On return, the scanner cursor is unchanged if a string could not be scanned or
 *  points to the terminating '\n' character otherwise. As a consequence,
 *  _synctex_next_line is necessary after.
 *  If either scanner or value_ref is NULL, it is considered as an error and
 *  SYNCTEX_STATUS_BAD_ARGUMENT is returned.
 */
synctex_status_t _synctex_decode_string(synctex_scanner_t scanner, char ** value_ref) {
	char * end = NULL;
	size_t current_size = 0;
	size_t new_size = 0;
	size_t len = 0;/*  The number of bytes to copy */
	size_t available = 0;
	synctex_status_t status = 0;
	if (NULL == scanner || NULL == value_ref) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	/*  The buffer must at least contain one character: the '\n' end of line marker */
	if (SYNCTEX_CUR>=SYNCTEX_END) {
		available = 1;
		status = _synctex_buffer_get_available_size(scanner,&available);
		if (status < 0) {
			return status;
		}
		if (0 == available) {
			return SYNCTEX_STATUS_EOF;
		}
	}
	/*  Now we are sure that there is at least one available character, either because
	 *  SYNCTEX_CUR was already < SYNCTEX_END, or because the buffer has been properly filled. */
	/*  end will point to the next unparsed '\n' character in the file, when mapped to the buffer. */
	end = SYNCTEX_CUR;
	* value_ref = NULL;/*  Initialize, it will be realloc'ed */
	/*  We scan all the characters up to the next '\n' */
next_character:
	if (end<SYNCTEX_END) {
		if (*end == '\n') {
			/*  OK, we found where to stop */
			len = end - SYNCTEX_CUR;
			if (current_size>UINT_MAX-len-1) {
				/*  But we have reached the limit: we do not have current_size+len+1>UINT_MAX.
				 *  We return the missing amount of memory.
				 *  This will never occur in practice. */
				return UINT_MAX-len-1 - current_size;
			}
			new_size = current_size+len;
			/*  We have current_size+len+1<=UINT_MAX
			 *  or equivalently new_size<UINT_MAX,
			 *  where we have assumed that len<UINT_MAX */
			if ((* value_ref = realloc(* value_ref,new_size+1)) != NULL) {
				if (memcpy((*value_ref)+current_size,SYNCTEX_CUR,len)) {
					(* value_ref)[new_size]='\0'; /*  Terminate the string */
					SYNCTEX_CUR += len;/*  Advance to the terminating '\n' */
					return SYNCTEX_STATUS_OK;
				}
				free(* value_ref);
				* value_ref = NULL;
				_synctex_error("could not copy memory (1).");
				return SYNCTEX_STATUS_ERROR;
			}
			_synctex_error("could not allocate memory (1).");
			return SYNCTEX_STATUS_ERROR;
		} else {
			++end;
			goto next_character;
		}
	} else {
		/*  end == SYNCTEX_END */
		len = SYNCTEX_END - SYNCTEX_CUR;
		if (current_size>UINT_MAX-len-1) {
			/*  We have reached the limit. */
			_synctex_error("limit reached (missing %i).",current_size-(UINT_MAX-len-1));
			return SYNCTEX_STATUS_ERROR;
		}
		new_size = current_size+len;
		if ((* value_ref = realloc(* value_ref,new_size+1)) != NULL) {
			if (memcpy((*value_ref)+current_size,SYNCTEX_CUR,len)) {
				(* value_ref)[new_size]='\0'; /*  Terminate the string */
				SYNCTEX_CUR = SYNCTEX_END;/*  Advance the cursor to the end of the bufer */
				return SYNCTEX_STATUS_OK;
			}
			free(* value_ref);
			* value_ref = NULL;
			_synctex_error("could not copy memory (2).");
			return SYNCTEX_STATUS_ERROR;
		}
		/*  Huge memory problem */
		_synctex_error("could not allocate memory (2).");
		return SYNCTEX_STATUS_ERROR;
	}
}

/*  Used when parsing the synctex file.
 *  Read an Input record.
 */
synctex_status_t _synctex_scan_input(synctex_scanner_t scanner) {
	synctex_status_t status = 0;
	size_t available = 0;
	synctex_node_t input = NULL;
	if (NULL == scanner) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	status = _synctex_match_string(scanner,"Input:");
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	/*  Create a node */
	input = _synctex_new_input(scanner);
	if (NULL == input) {
		_synctex_error("could not create an input node.");
		return SYNCTEX_STATUS_ERROR;
	}
	/*  Decode the synctag  */
	status = _synctex_decode_int(scanner,&(SYNCTEX_TAG(input)));
	if (status<SYNCTEX_STATUS_OK) {
		_synctex_error("bad format of input node.");
		SYNCTEX_FREE(input);
		return status;
	}
	/*  The next character is a field separator, we expect one character in the buffer. */
	available = 1;
	status = _synctex_buffer_get_available_size(scanner, &available);
	if (status<=SYNCTEX_STATUS_ERROR) {
		return status;
	}
	if (0 == available) {
		return SYNCTEX_STATUS_EOF;
	}
	/*  We can now safely advance to the next character, stepping over the field separator. */
	++SYNCTEX_CUR;
	--available;
	/*  Then we scan the file name */
	status = _synctex_decode_string(scanner,&(SYNCTEX_NAME(input)));
	if (status<SYNCTEX_STATUS_OK) {
		SYNCTEX_FREE(input);
		return status;
	}
	/*  Prepend this input node to the input linked list of the scanner */
	SYNCTEX_SET_SIBLING(input,scanner->input);
	scanner->input = input;
	return _synctex_next_line(scanner);/*  read the line termination character, if any */
	/*  Now, set up the path */
}

typedef synctex_status_t (*synctex_decoder_t)(synctex_scanner_t,void *);

synctex_status_t _synctex_scan_named(synctex_scanner_t scanner,const char * name,void * value_ref,synctex_decoder_t decoder);

/*  Used when parsing the synctex file.
 *  Read one of the settings.
 *  On normal completion, returns SYNCTEX_STATUS_OK.
 *  On error, returns SYNCTEX_STATUS_ERROR.
 *  Both arguments must not be NULL.
 *  On return, the scanner points to the next character after the decoded object whatever it is.
 *  It is the responsibility of the caller to prepare the scanner for the next line.
 */
synctex_status_t _synctex_scan_named(synctex_scanner_t scanner,const char * name,void * value_ref,synctex_decoder_t decoder) {
	synctex_status_t status = 0;
	if (NULL == scanner || NULL == name || NULL == value_ref || NULL == decoder) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
not_found:
	status = _synctex_match_string(scanner,name);
	if (status<SYNCTEX_STATUS_NOT_OK) {
		return status;
	} else if (status == SYNCTEX_STATUS_NOT_OK) {
		status = _synctex_next_line(scanner);
		if (status<SYNCTEX_STATUS_OK) {
			return status;
		}
		goto not_found;
	}
	/*  A line is found, scan the value */
	return (*decoder)(scanner,value_ref);
}

/*  Used when parsing the synctex file.
 *  Read the preamble.
 */
synctex_status_t _synctex_scan_preamble(synctex_scanner_t scanner) {
	synctex_status_t status = 0;
	if (NULL == scanner) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	status = _synctex_scan_named(scanner,"SyncTeX Version:",&(scanner->version),(synctex_decoder_t)&_synctex_decode_int);
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	status = _synctex_next_line(scanner);
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	/*  Read all the input records */
	do {
		status = _synctex_scan_input(scanner);
		if (status<SYNCTEX_STATUS_NOT_OK) {
			return status;
		}
	} while(status == SYNCTEX_STATUS_OK);
	/*  the loop exits when status == SYNCTEX_STATUS_NOT_OK */
	/*  Now read all the required settings. */
	status = _synctex_scan_named(scanner,"Output:",&(scanner->output_fmt),(synctex_decoder_t)&_synctex_decode_string);
	if (status<SYNCTEX_STATUS_NOT_OK) {
		return status;
	}
	status = _synctex_next_line(scanner);
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	status = _synctex_scan_named(scanner,"Magnification:",&(scanner->pre_magnification),(synctex_decoder_t)&_synctex_decode_int);
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	status = _synctex_next_line(scanner);
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	status = _synctex_scan_named(scanner,"Unit:",&(scanner->pre_unit),(synctex_decoder_t)&_synctex_decode_int);
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	status = _synctex_next_line(scanner);
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	status = _synctex_scan_named(scanner,"X Offset:",&(scanner->pre_x_offset),(synctex_decoder_t)&_synctex_decode_int);
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	status = _synctex_next_line(scanner);
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	status = _synctex_scan_named(scanner,"Y Offset:",&(scanner->pre_y_offset),(synctex_decoder_t)&_synctex_decode_int);
	if (status<SYNCTEX_STATUS_OK) {
		return status;
	}
	return _synctex_next_line(scanner);
}

/*  parse a float with a dimension */
synctex_status_t _synctex_scan_float_and_dimension(synctex_scanner_t scanner, float * value_ref) {
	synctex_status_t status = 0;
	char * endptr = NULL;
	float f = 0;
#ifdef HAVE_SETLOCALE
	char * loc = setlocale(LC_NUMERIC, NULL);
#endif
	size_t available = 0;
	if (NULL == scanner || NULL == value_ref) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	available = SYNCTEX_BUFFER_MIN_SIZE;
	status = _synctex_buffer_get_available_size(scanner, &available);
	if (status<SYNCTEX_STATUS_EOF) {
		_synctex_error("problem with float.");
		return status;
	}
#ifdef HAVE_SETLOCALE
	setlocale(LC_NUMERIC, "C");
#endif
	f = strtod(SYNCTEX_CUR,&endptr);
#ifdef HAVE_SETLOCALE
	setlocale(LC_NUMERIC, loc);
#endif
	if (endptr == SYNCTEX_CUR) {
		_synctex_error("a float was expected.");
		return SYNCTEX_STATUS_ERROR;
	}
	SYNCTEX_CUR = endptr;
	if ((status = _synctex_match_string(scanner,"in")) >= SYNCTEX_STATUS_OK) {
		f *= 72.27f*65536;
	} else if (status<SYNCTEX_STATUS_EOF) {
report_unit_error:
		_synctex_error("problem with unit.");
		return status;
	} else if ((status = _synctex_match_string(scanner,"cm")) >= SYNCTEX_STATUS_OK) {
		f *= 72.27f*65536/2.54f;
	} else if (status<0) {
		goto report_unit_error;
	} else if ((status = _synctex_match_string(scanner,"mm")) >= SYNCTEX_STATUS_OK) {
		f *= 72.27f*65536/25.4f;
	} else if (status<0) {
		goto report_unit_error;
	} else if ((status = _synctex_match_string(scanner,"pt")) >= SYNCTEX_STATUS_OK) {
		f *= 65536.0f;
	} else if (status<0) {
		goto report_unit_error;
	} else if ((status = _synctex_match_string(scanner,"bp")) >= SYNCTEX_STATUS_OK) {
		f *= 72.27f/72*65536.0f;
	}  else if (status<0) {
		goto report_unit_error;
	} else if ((status = _synctex_match_string(scanner,"pc")) >= SYNCTEX_STATUS_OK) {
		f *= 12.0*65536.0f;
	}  else if (status<0) {
		goto report_unit_error;
	} else if ((status = _synctex_match_string(scanner,"sp")) >= SYNCTEX_STATUS_OK) {
		f *= 1.0f;
	}  else if (status<0) {
		goto report_unit_error;
	} else if ((status = _synctex_match_string(scanner,"dd")) >= SYNCTEX_STATUS_OK) {
		f *= 1238.0f/1157*65536.0f;
	}  else if (status<0) {
		goto report_unit_error;
	} else if ((status = _synctex_match_string(scanner,"cc")) >= SYNCTEX_STATUS_OK) {
		f *= 14856.0f/1157*65536;
	} else if (status<0) {
		goto report_unit_error;
	} else if ((status = _synctex_match_string(scanner,"nd")) >= SYNCTEX_STATUS_OK) {
		f *= 685.0f/642*65536;
	}  else if (status<0) {
		goto report_unit_error;
	} else if ((status = _synctex_match_string(scanner,"nc")) >= SYNCTEX_STATUS_OK) {
		f *= 1370.0f/107*65536;
	} else if (status<0) {
		goto report_unit_error;
	}
	*value_ref = f;
	return SYNCTEX_STATUS_OK;
}

/*  parse the post scriptum
 *  SYNCTEX_STATUS_OK is returned on completion
 *  a negative error is returned otherwise */
synctex_status_t _synctex_scan_post_scriptum(synctex_scanner_t scanner) {
	synctex_status_t status = 0;
	char * endptr = NULL;
#ifdef HAVE_SETLOCALE
	char * loc = setlocale(LC_NUMERIC, NULL);
#endif
	if (NULL == scanner) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	/*  Scan the file until a post scriptum line is found */
post_scriptum_not_found:
	status = _synctex_match_string(scanner,"Post scriptum:");
	if (status<SYNCTEX_STATUS_NOT_OK) {
		return status;
	}
	if (status == SYNCTEX_STATUS_NOT_OK) {
		status = _synctex_next_line(scanner);
		if (status<SYNCTEX_STATUS_EOF) {
			return status;
		} else if (status<SYNCTEX_STATUS_OK) {
			return SYNCTEX_STATUS_OK;/*  The EOF is found, we have properly scanned the file */
		}
		goto post_scriptum_not_found;
	}
	/*  We found the name, advance to the next line. */
next_line:
	status = _synctex_next_line(scanner);
	if (status<SYNCTEX_STATUS_EOF) {
		return status;
	} else if (status<SYNCTEX_STATUS_OK) {
		return SYNCTEX_STATUS_OK;/*  The EOF is found, we have properly scanned the file */
	}
	/*  Scanning the information */
	status = _synctex_match_string(scanner,"Magnification:");
	if (status == SYNCTEX_STATUS_OK ) {
#ifdef HAVE_SETLOCALE
		setlocale(LC_NUMERIC, "C");
#endif
		scanner->unit = strtod(SYNCTEX_CUR,&endptr);
#ifdef HAVE_SETLOCALE
		setlocale(LC_NUMERIC, loc);
#endif
		if (endptr == SYNCTEX_CUR) {
			_synctex_error("bad magnification in the post scriptum, a float was expected.");
			return SYNCTEX_STATUS_ERROR;
		}
		if (scanner->unit<=0) {
			_synctex_error("bad magnification in the post scriptum, a positive float was expected.");
			return SYNCTEX_STATUS_ERROR;
		}
		SYNCTEX_CUR = endptr;
		goto next_line;
	}
	if (status<SYNCTEX_STATUS_EOF){
report_record_problem:
		_synctex_error("Problem reading the Post Scriptum records");
		return status; /*  echo the error. */
	}
	status = _synctex_match_string(scanner,"X Offset:");
	if (status == SYNCTEX_STATUS_OK) {
		status = _synctex_scan_float_and_dimension(scanner, &(scanner->x_offset));
		if (status<SYNCTEX_STATUS_OK) {
			_synctex_error("problem with X offset in the Post Scriptum.");
			return status;
		}
		goto next_line;
	} else if (status<SYNCTEX_STATUS_EOF){
		goto report_record_problem;
	}
	status = _synctex_match_string(scanner,"Y Offset:");
	if (status==SYNCTEX_STATUS_OK) {
		status = _synctex_scan_float_and_dimension(scanner, &(scanner->y_offset));
		if (status<SYNCTEX_STATUS_OK) {
			_synctex_error("problem with Y offset in the Post Scriptum.");
			return status;
		}
		goto next_line;
	} else if (status<SYNCTEX_STATUS_EOF){
		goto report_record_problem;
	}
	goto next_line;
}

/*  SYNCTEX_STATUS_OK is returned if the postamble is read
 *  SYNCTEX_STATUS_NOT_OK is returned if the postamble is not at the current location
 *  a negative error otherwise
 *  The postamble comprises the post scriptum section.
 */
int _synctex_scan_postamble(synctex_scanner_t scanner) {
	int status = 0;
	if (NULL == scanner) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	status = _synctex_match_string(scanner,"Postamble:");
	if (status < SYNCTEX_STATUS_OK) {
		return status;
	}
count_again:
	status = _synctex_next_line(scanner);
	if (status < SYNCTEX_STATUS_OK) {
		return status;
	}
	status = _synctex_scan_named(scanner,"Count:",&(scanner->count),(synctex_decoder_t)&_synctex_decode_int);
	if (status < SYNCTEX_STATUS_EOF) {
		return status; /*  forward the error */
	} else if (status < SYNCTEX_STATUS_OK) { /*  No Count record found */
		status = _synctex_next_line(scanner); /*  Advance one more line */
		if (status<SYNCTEX_STATUS_OK) {
			return status;
		}
		goto count_again;
	}
	/*  Now we scan the last part of the SyncTeX file: the Post Scriptum section. */
	return _synctex_scan_post_scriptum(scanner);
}

/*  Horizontal boxes also have visible size.
 *  Visible size are bigger than real size.
 *  For example 0 width boxes may contain text.
 *  At creation time, the visible size is set to the values of the real size.
 */
synctex_status_t _synctex_setup_visible_box(synctex_node_t box) {
	if (box) {
		switch(box->class->type) {
			case synctex_node_type_hbox:
				if (SYNCTEX_INFO(box) != NULL) {
					SYNCTEX_HORIZ_V(box)  = SYNCTEX_HORIZ(box);
					SYNCTEX_VERT_V(box)   = SYNCTEX_VERT(box);
					SYNCTEX_WIDTH_V(box)  = SYNCTEX_WIDTH(box);
					SYNCTEX_HEIGHT_V(box) = SYNCTEX_HEIGHT(box);
					SYNCTEX_DEPTH_V(box)  = SYNCTEX_DEPTH(box);
					return SYNCTEX_STATUS_OK;
				}
				return SYNCTEX_STATUS_ERROR;
		}
	}
	return SYNCTEX_STATUS_BAD_ARGUMENT;
}

/*  This method is sent to an horizontal box to setup the visible size
 *  Some box have 0 width but do contain text material.
 *  With this method, one can enlarge the box to contain the given point (h,v).
 */
synctex_status_t _synctex_horiz_box_setup_visible(synctex_node_t node,int h, int v) {
#	ifdef __DARWIN_UNIX03
#       pragma unused(v)
#   endif
	int itsBtm, itsTop;
	if (NULL == node || node->class->type != synctex_node_type_hbox) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	if (SYNCTEX_WIDTH_V(node)<0) {
		itsBtm = SYNCTEX_HORIZ_V(node);
		itsTop = SYNCTEX_HORIZ_V(node)-SYNCTEX_WIDTH_V(node);
		if (h<itsBtm) {
			SYNCTEX_HORIZ_V(node) = h;
			SYNCTEX_WIDTH_V(node) = SYNCTEX_HORIZ_V(node) - itsTop;
		} else if (h>itsTop) {
			SYNCTEX_WIDTH_V(node) = SYNCTEX_HORIZ_V(node) - h;
		}
	} else {
		itsBtm = SYNCTEX_HORIZ_V(node);
		itsTop = SYNCTEX_HORIZ_V(node)+SYNCTEX_WIDTH_V(node);
		if (h<itsBtm) {
			SYNCTEX_HORIZ_V(node) = h;
			SYNCTEX_WIDTH_V(node) = itsTop - SYNCTEX_HORIZ_V(node);
		} else if (h>itsTop) {
			SYNCTEX_WIDTH_V(node) = h - SYNCTEX_HORIZ_V(node);
		}
	}
	return SYNCTEX_STATUS_OK;
}

/*  Here are the control characters that strat each line of the synctex output file.
 *  Their values define the meaning of the line.
 */
#   define SYNCTEX_CHAR_BEGIN_SHEET '{'
#   define SYNCTEX_CHAR_END_SHEET   '}'
#   define SYNCTEX_CHAR_BEGIN_VBOX  '['
#   define SYNCTEX_CHAR_END_VBOX    ']'
#   define SYNCTEX_CHAR_BEGIN_HBOX  '('
#   define SYNCTEX_CHAR_END_HBOX    ')'
#   define SYNCTEX_CHAR_ANCHOR      '!'
#   define SYNCTEX_CHAR_VOID_VBOX   'v'
#   define SYNCTEX_CHAR_VOID_HBOX   'h'
#   define SYNCTEX_CHAR_KERN        'k'
#   define SYNCTEX_CHAR_GLUE        'g'
#   define SYNCTEX_CHAR_MATH        '$'
#   define SYNCTEX_CHAR_BOUNDARY    'x'

#   define SYNCTEX_RETURN(STATUS) return STATUS;

/*  Used when parsing the synctex file. A '{' character has just been parsed.
 *  The purpose is to gobble everything until the closing '}'.
 *  Actually only one nesting depth has been observed when using the clip option
 *  of \includegraphics option. Here we use arbitrary level of depth.
 */
synctex_status_t _synctex_scan_nested_sheet(synctex_scanner_t scanner) {
    unsigned int depth = 0;
deeper:
    ++depth;
    if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
        _synctex_error("Unexpected end of nested sheet (1).");
        SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
    }
scan_next_line:
    if (SYNCTEX_CUR<SYNCTEX_END) {
		if (*SYNCTEX_CUR == SYNCTEX_CHAR_END_SHEET) {
			++SYNCTEX_CUR;
			if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
				_synctex_error("Unexpected end of nested sheet (2).");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
            if (--depth>0) {
                goto scan_next_line;
            } else {
            	SYNCTEX_RETURN(SYNCTEX_STATUS_OK);
            }
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_BEGIN_SHEET) {
			++SYNCTEX_CUR;
			goto deeper;
            
		} else if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
            _synctex_error("Unexpected end of nested sheet (3).");
            SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
        }
    }
    _synctex_error("Unexpected end of nested sheet (4).");
    SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
}

/*  Used when parsing the synctex file.
 *  The sheet argument is a newly created sheet node that will hold the contents.
 *  Something is returned in case of error.
 */
synctex_status_t _synctex_scan_sheet(synctex_scanner_t scanner, synctex_node_t sheet) {
	synctex_node_t parent = sheet;
	synctex_node_t child = NULL;
	synctex_node_t sibling = NULL;
	synctex_node_t box = sheet;
	int friend_index = 0;
	synctex_info_t * info = NULL;
	synctex_status_t status = 0;
	size_t available = 0;
	if ((NULL == scanner) || (NULL == sheet)) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	/*  We MUST start with a box, so at this level, the unique possibility is '[', '(' or "}". */
prepare_loop:
	if (SYNCTEX_CUR<SYNCTEX_END) {
		if (*SYNCTEX_CUR == SYNCTEX_CHAR_BEGIN_VBOX) {
scan_vbox:
			++SYNCTEX_CUR;
			if ((child = _synctex_new_vbox(scanner)) && (info = SYNCTEX_INFO(child))) {
#               define SYNCTEX_DECODE_FAILED(WHAT) \
					(_synctex_decode_int(scanner,&(info[WHAT].INT))<SYNCTEX_STATUS_OK)
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_WIDTH_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HEIGHT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_DEPTH_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad vbox record.");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_CHILD(parent,child);
				parent = child;
				child = NULL;
				goto child_loop;/*  next created node will be a child */
			} else {
				_synctex_error("Can't create vbox record.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_BEGIN_HBOX) {
scan_hbox:
			++SYNCTEX_CUR;
			if ((child = _synctex_new_hbox(scanner)) && (info = SYNCTEX_INFO(child))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_WIDTH_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HEIGHT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_DEPTH_IDX)
						|| _synctex_setup_visible_box(child)<SYNCTEX_STATUS_OK
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad hbox record.");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child)+SYNCTEX_ABS_WIDTH(child),SYNCTEX_VERT(child));
				SYNCTEX_SET_CHILD(parent,child);
				parent = child;
				child = NULL;
				goto child_loop;/*  next created node will be a child */
			} else {
				_synctex_error("Can't create hbox record.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_END_SHEET) {
scan_teehs:
			++SYNCTEX_CUR;
			if (NULL == parent || parent->class->type != synctex_node_type_sheet
					|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
				_synctex_error("Unexpected end of sheet.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
			SYNCTEX_RETURN(SYNCTEX_STATUS_OK);
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_BEGIN_SHEET) {
			/*  Addendum to version 1.10 to manage nested sheets  */
			++SYNCTEX_CUR;
			if (_synctex_scan_nested_sheet(scanner)<SYNCTEX_STATUS_OK) {
				_synctex_error("Unexpected nested sheet.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
			goto prepare_loop;
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_ANCHOR) {
scan_anchor:
			++SYNCTEX_CUR;
			if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
				_synctex_error("Missing anchor.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
			goto prepare_loop;
		} else {
			/*  _synctex_error("Ignored record %c\n",*SYNCTEX_CUR); */
			++SYNCTEX_CUR;
			if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
				_synctex_error("Unexpected end.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
			goto prepare_loop;
		}
	} else {
		available = 1;
		status = _synctex_buffer_get_available_size(scanner,&available);
		 if (status<SYNCTEX_STATUS_OK && available>0){
			_synctex_error("Uncomplete sheet(0)");
			SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
		} else {
			goto prepare_loop;
		}
	}
	_synctex_bail();
/*  The child loop means that we go do one level, when we just created a box node,
 *  the next node created is a child of this box. */
child_loop:
	if (SYNCTEX_CUR<SYNCTEX_END) {
		if (*SYNCTEX_CUR == SYNCTEX_CHAR_BEGIN_VBOX) {
			goto scan_vbox;
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_END_VBOX) {
scan_xobv:
			++SYNCTEX_CUR;
			if (NULL != parent && parent->class->type == synctex_node_type_vbox) {
				#define SYNCTEX_UPDATE_BOX_FRIEND(NODE)\
				friend_index = ((SYNCTEX_INFO(NODE))[SYNCTEX_TAG_IDX].INT+(SYNCTEX_INFO(NODE))[SYNCTEX_LINE_IDX].INT)%(scanner->number_of_lists);\
				SYNCTEX_SET_FRIEND(NODE,(scanner->lists_of_friends)[friend_index]);\
				(scanner->lists_of_friends)[friend_index] = NODE;
				if (NULL == SYNCTEX_CHILD(parent)) {
					/*  only void boxes are friends */
					SYNCTEX_UPDATE_BOX_FRIEND(parent);
				}
				child = parent;
				parent = SYNCTEX_PARENT(child);
			} else {
				_synctex_error("Unexpected end of vbox, ignored.");
			}
			if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
				_synctex_error("Uncomplete sheet.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
			goto sibling_loop;
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_BEGIN_HBOX) {
			goto scan_hbox;
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_END_HBOX) {
scan_xobh:
			++SYNCTEX_CUR;
			if ((parent) && parent->class->type == synctex_node_type_hbox) {
				if (NULL == child) {
					/*  Only boxes with no children are friends,
					 *  boxes with children are indirectly friends through one of their descendants. */
					SYNCTEX_UPDATE_BOX_FRIEND(parent);
				}
				/*  setting the next horizontal box at the end ensures that a child is recorded before any of its ancestors. */
				SYNCTEX_SET_NEXT_HORIZ_BOX(box,parent);
				box = parent;
				child = parent;
				parent = SYNCTEX_PARENT(child);
			} else {
				_synctex_error("Unexpected enf of hbox, ignored.");
			}
			if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
				_synctex_error("Uncomplete sheet.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
			goto sibling_loop;
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_VOID_VBOX) {
			++SYNCTEX_CUR;
			if (NULL != (child = _synctex_new_void_vbox(scanner))
					&& NULL != (info = SYNCTEX_INFO(child))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_WIDTH_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HEIGHT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_DEPTH_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad void vbox record.");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_CHILD(parent,child);
				#define SYNCTEX_UPDATE_FRIEND(NODE)\
				friend_index = (info[SYNCTEX_TAG_IDX].INT+info[SYNCTEX_LINE_IDX].INT)%(scanner->number_of_lists);\
				SYNCTEX_SET_FRIEND(NODE,(scanner->lists_of_friends)[friend_index]);\
				(scanner->lists_of_friends)[friend_index] = NODE;
				SYNCTEX_UPDATE_FRIEND(child);
				goto sibling_loop;
			} else {
				_synctex_error("Can't create vbox record.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_VOID_HBOX) {
			++SYNCTEX_CUR;
			if (NULL != (child = _synctex_new_void_hbox(scanner))
					&& NULL != (info = SYNCTEX_INFO(child))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_WIDTH_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HEIGHT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_DEPTH_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad void hbox record.");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_CHILD(parent,child);
				SYNCTEX_UPDATE_FRIEND(child);
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child)+SYNCTEX_ABS_WIDTH(child),SYNCTEX_VERT(child));
				goto sibling_loop;
			} else {
				_synctex_error("Can't create void hbox record.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_KERN) {
			++SYNCTEX_CUR;
			if (NULL != (child = _synctex_new_kern(scanner))
					&& NULL != (info = SYNCTEX_INFO(child))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_WIDTH_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad kern record.");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_CHILD(parent,child);
				SYNCTEX_UPDATE_FRIEND(child);
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child)-SYNCTEX_WIDTH(child),SYNCTEX_VERT(child));
				goto sibling_loop;
			} else {
				_synctex_error("Can't create kern record.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_GLUE) {
			++SYNCTEX_CUR;
			if (NULL != (child = _synctex_new_glue(scanner))
					&& NULL != (info = SYNCTEX_INFO(child))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad glue record.");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_CHILD(parent,child);
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				SYNCTEX_UPDATE_FRIEND(child);
				goto sibling_loop;
			} else {
				_synctex_error("Can't create glue record.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_MATH) {
			++SYNCTEX_CUR;
			if (NULL != (child = _synctex_new_math(scanner))
					&& NULL != (info = SYNCTEX_INFO(child))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad math record.");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_CHILD(parent,child);
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				SYNCTEX_UPDATE_FRIEND(child);
				goto sibling_loop;
			} else {
				_synctex_error("Can't create math record.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_BOUNDARY) {
			++SYNCTEX_CUR;
			if (NULL != (child = _synctex_new_boundary(scanner))
					&& NULL != (info = SYNCTEX_INFO(child))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad boundary record.");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_CHILD(parent,child);
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				SYNCTEX_UPDATE_FRIEND(child);
				goto sibling_loop;
			} else {
				_synctex_error("Can't create math record.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_END_SHEET) {
			goto scan_teehs;
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_BEGIN_SHEET) {
			/*  Addendum to version 1.10 to manage nested sheets  */
			++SYNCTEX_CUR;
			if (_synctex_scan_nested_sheet(scanner)<SYNCTEX_STATUS_OK) {
				_synctex_error("Unexpected nested sheet.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
			goto child_loop;
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_ANCHOR) {
			goto scan_anchor;
		} else {
			/*  _synctex_error("Ignored record %c\n",*SYNCTEX_CUR); */
			++SYNCTEX_CUR;
			if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
				_synctex_error("Unexpected end.");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
			goto child_loop;
		}
	} else {
		available = 1;
		status = _synctex_buffer_get_available_size(scanner,&available);
		 if (status<SYNCTEX_STATUS_OK && available>0){
			_synctex_error("Uncomplete sheet(0)");
			SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
		} else {
			goto child_loop;
		}
	}
	_synctex_bail();
/*  The vertical loop means that we are on the same level, for example when we just ended a box.
 *  If a node is created now, it will be a sibling of the current node, sharing the same parent. */
sibling_loop:
	if (SYNCTEX_CUR<SYNCTEX_END) {
		if (*SYNCTEX_CUR == SYNCTEX_CHAR_BEGIN_VBOX) {
			++SYNCTEX_CUR;
			if (NULL != (sibling = _synctex_new_vbox(scanner))
					&& NULL != (info = SYNCTEX_INFO(sibling))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_WIDTH_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HEIGHT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_DEPTH_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad vbox record (2).");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_SIBLING(child,sibling);
				parent = sibling;
				child = NULL;
				goto child_loop;
			} else {
				_synctex_error("Can't create vbox record (2).");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_END_VBOX) {
			goto scan_xobv;
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_BEGIN_HBOX) {
			++SYNCTEX_CUR;
			if (NULL != (sibling = _synctex_new_hbox(scanner)) &&
					NULL != (info = SYNCTEX_INFO(sibling))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_WIDTH_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HEIGHT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_DEPTH_IDX)
						|| _synctex_setup_visible_box(sibling)<SYNCTEX_STATUS_OK
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad hbox record (2).");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_SIBLING(child,sibling);
				child = sibling;
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child)+SYNCTEX_ABS_WIDTH(child),SYNCTEX_VERT(child));
				parent = child;
				child = NULL;
				goto child_loop;
			} else {
				_synctex_error("Can't create hbox record (2).");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_END_HBOX) {
			goto scan_xobh;
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_VOID_VBOX) {
			++SYNCTEX_CUR;
			if (NULL != (sibling = _synctex_new_void_vbox(scanner)) &&
					NULL != (info = SYNCTEX_INFO(sibling))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_WIDTH_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HEIGHT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_DEPTH_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad void vbox record (2).");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_SIBLING(child,sibling);
				child = sibling;
				SYNCTEX_UPDATE_FRIEND(child);
				goto sibling_loop;
			} else {
				_synctex_error("can't create void vbox record (2).");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_VOID_HBOX) {
			++SYNCTEX_CUR;
			if (NULL != (sibling = _synctex_new_void_hbox(scanner)) &&
					NULL != (info = SYNCTEX_INFO(sibling))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_WIDTH_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HEIGHT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_DEPTH_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad void hbox record (2).");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_SIBLING(child,sibling);
				child = sibling;
				SYNCTEX_UPDATE_FRIEND(child);
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child)+SYNCTEX_ABS_WIDTH(child),SYNCTEX_VERT(child));
				goto sibling_loop;
			} else {
				_synctex_error("can't create void hbox record (2).");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_KERN) {
			++SYNCTEX_CUR;
			if (NULL != (sibling = _synctex_new_kern(scanner))
					&& NULL != (info = SYNCTEX_INFO(sibling))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_WIDTH_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad kern record (2).");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_SIBLING(child,sibling);
				child = sibling;
				SYNCTEX_UPDATE_FRIEND(child);
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child)-SYNCTEX_WIDTH(child),SYNCTEX_VERT(child));
				goto sibling_loop;
			} else {
				_synctex_error("Can't create kern record (2).");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_GLUE) {
			++SYNCTEX_CUR;
			if (NULL != (sibling = _synctex_new_glue(scanner))
					&& NULL != (info = SYNCTEX_INFO(sibling))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad glue record (2).");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_SIBLING(child,sibling);
				child = sibling;
				SYNCTEX_UPDATE_FRIEND(child);
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				goto sibling_loop;
			} else {
				_synctex_error("Can't create glue record (2).");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_MATH) {
			++SYNCTEX_CUR;
			if (NULL != (sibling = _synctex_new_math(scanner))
					&& NULL != (info = SYNCTEX_INFO(sibling))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad math record (2).");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_SIBLING(child,sibling);
				child = sibling;
				SYNCTEX_UPDATE_FRIEND(child);
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				goto sibling_loop;
			} else {
				_synctex_error("Can't create math record (2).");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_BOUNDARY) {
			++SYNCTEX_CUR;
			if (NULL != (sibling = _synctex_new_boundary(scanner))
					&& NULL != (info = SYNCTEX_INFO(sibling))) {
				if (SYNCTEX_DECODE_FAILED(SYNCTEX_TAG_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_LINE_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_HORIZ_IDX)
						|| SYNCTEX_DECODE_FAILED(SYNCTEX_VERT_IDX)
						|| _synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
					_synctex_error("Bad boundary record (2).");
					SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
				}
				SYNCTEX_SET_SIBLING(child,sibling);
				child = sibling;
				SYNCTEX_UPDATE_FRIEND(child);
				_synctex_horiz_box_setup_visible(parent,SYNCTEX_HORIZ(child),SYNCTEX_VERT(child));
				goto sibling_loop;
			} else {
				_synctex_error("Can't create boundary record (2).");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_END_SHEET) {
			goto scan_teehs;
		} else if (*SYNCTEX_CUR == SYNCTEX_CHAR_ANCHOR) {
			++SYNCTEX_CUR;
			if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
				_synctex_error("Missing anchor (2).");
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
			goto sibling_loop;
		} else {
			++SYNCTEX_CUR;
			/* _synctex_error("Ignored record %c(2)\n",*SYNCTEX_CUR); */
			if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
				SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
			}
			goto sibling_loop;
		}
	} else {
		available = 1;
		status = _synctex_buffer_get_available_size(scanner,&available);
		if (status<SYNCTEX_STATUS_OK && available>0){
			goto sibling_loop;
		} else {
			_synctex_error("Uncomplete sheet(2)");
			SYNCTEX_RETURN(SYNCTEX_STATUS_ERROR);
		}
	}
#   undef SYNCTEX_DECODE_FAILED
}

/*  Used when parsing the synctex file
 */
synctex_status_t _synctex_scan_content(synctex_scanner_t scanner) {
	synctex_node_t sheet = NULL;
	synctex_status_t status = 0;
	if (NULL == scanner) {
		return SYNCTEX_STATUS_BAD_ARGUMENT;
	}
	/*  set up the lists of friends */
	if (NULL == scanner->lists_of_friends) {
		scanner->number_of_lists = 1024;
		scanner->lists_of_friends = (synctex_node_t *)_synctex_malloc(scanner->number_of_lists*sizeof(synctex_node_t));
		if (NULL == scanner->lists_of_friends) {
			_synctex_error("malloc:2");
			return SYNCTEX_STATUS_ERROR;
		}
	}
	/*  Find where this section starts */
content_not_found:
	status = _synctex_match_string(scanner,"Content:");
	if (status<SYNCTEX_STATUS_EOF) {
		return status;
	}
	if (_synctex_next_line(scanner)<SYNCTEX_STATUS_OK) {
		_synctex_error("Uncomplete Content.");
		return SYNCTEX_STATUS_ERROR;
	}
	if (status == SYNCTEX_STATUS_NOT_OK) {
		goto content_not_found;
	}
next_sheet:
	if (*SYNCTEX_CUR != SYNCTEX_CHAR_BEGIN_SHEET) {
		status = _synctex_scan_postamble(scanner);
		if (status < SYNCTEX_STATUS_EOF) {
			_synctex_error("Bad content.");
			return status;
		}
		if (status<SYNCTEX_STATUS_OK) {
			status = _synctex_next_line(scanner);
			if (status < SYNCTEX_STATUS_OK) {
				_synctex_error("Bad content.");
				return status;
			}
			goto next_sheet;
		}
		return SYNCTEX_STATUS_OK;
	}
	++SYNCTEX_CUR;
	/*  Create a new sheet node */
	sheet = _synctex_new_sheet(scanner);
	status = _synctex_decode_int(scanner,&(SYNCTEX_PAGE(sheet)));
	if (status<SYNCTEX_STATUS_OK) {
		_synctex_error("Missing sheet number.");
bail:
		SYNCTEX_FREE(sheet);
		return SYNCTEX_STATUS_ERROR;
	}
	status = _synctex_next_line(scanner);
	if (status<SYNCTEX_STATUS_OK) {
		_synctex_error("Uncomplete file.");
		goto bail;
	}
	status = _synctex_scan_sheet(scanner,sheet);
	if (status<SYNCTEX_STATUS_OK) {
		_synctex_error("Bad sheet content.");
		goto bail;
	}
	SYNCTEX_SET_SIBLING(sheet,scanner->sheet);
	scanner->sheet = sheet;
	sheet = NULL;
	/*  Now read the list of Inputs between 2 sheets. */
	do {
		status = _synctex_scan_input(scanner);
		if (status<SYNCTEX_STATUS_EOF) {
			_synctex_error("Bad input section.");
			goto bail;
		}
	}
	while(status >= SYNCTEX_STATUS_OK);
	goto next_sheet;
}

int _synctex_open(const char * output, const char * build_directory, char ** synctex_name_ref, gzFile * file_ref, synctex_bool_t add_quotes, synctex_io_mode_t * io_modeRef);

/*  Where the synctex scanner is created. */
synctex_scanner_t synctex_scanner_new_with_output_file(const char * output, const char * build_directory, int parse) {
	gzFile file = NULL;
	char * synctex = NULL;
	synctex_scanner_t scanner = NULL;
	synctex_io_mode_t io_mode = 0;
	/*  Here we assume that int are smaller than void * */
	if (sizeof(int)>sizeof(void*)) {
		_synctex_error("INTERNAL INCONSISTENCY: int's are unexpectedly bigger than pointers, bailing out.");
		return NULL;
	}
	/*  We ensure that SYNCTEX_BUFFER_SIZE < UINT_MAX, I don't know if it makes sense... */
	if (SYNCTEX_BUFFER_SIZE >= UINT_MAX) {
		_synctex_error("SyncTeX BUG: Internal inconsistency, bad SYNCTEX_BUFFER_SIZE (1)");
		return NULL;
	}
	/*  for integers: */
	if (SYNCTEX_BUFFER_SIZE < SYNCTEX_BUFFER_MIN_SIZE) {
		_synctex_error("SyncTeX BUG: Internal inconsistency, bad SYNCTEX_BUFFER_SIZE (2)");
		return NULL;
	}
	/*  now open the synctex file */
	if (_synctex_open(output,build_directory,&synctex,&file,synctex_ADD_QUOTES,&io_mode) || !file) {
		if (_synctex_open(output,build_directory,&synctex,&file,synctex_DONT_ADD_QUOTES,&io_mode) || !file) {
			return NULL;
		}
	}
	scanner = (synctex_scanner_t)_synctex_malloc(sizeof(_synctex_scanner_t));
	if (NULL == scanner) {
		_synctex_error("SyncTeX: malloc problem");
		free(synctex);
		gzclose(file);
		return NULL;
	}
	/*  make a private copy of output for the scanner */
	if (NULL == (scanner->output = (char *)malloc(strlen(output)+1))){
		_synctex_error("!  synctex_scanner_new_with_output_file: Memory problem (2), scanner's output is not reliable.");
	} else if (scanner->output != strcpy(scanner->output,output)) {
		_synctex_error("!  synctex_scanner_new_with_output_file: Copy problem, scanner's output is not reliable.");
	}
	scanner->synctex = synctex;/*  Now the scanner owns synctex */
	SYNCTEX_FILE = file;
	return parse? synctex_scanner_parse(scanner):scanner;
}

int __synctex_open(const char * output, char ** synctex_name_ref, gzFile * file_ref, synctex_bool_t add_quotes, synctex_io_mode_t * io_mode_ref);

/*	This functions opens the file at the "output" given location.
 *  It manages the problem of quoted filenames that appear with pdftex and filenames containing the space character.
 *  In TeXLive 2008, the synctex file created with pdftex did contain unexpected quotes.
 *	This function will remove them if possible.
 *  All the reference arguments will take a value on return. They must be non NULL.
 *	0 on success, non 0 on error. */
int __synctex_open(const char * output, char ** synctex_name_ref, gzFile * file_ref, synctex_bool_t add_quotes, synctex_io_mode_t * io_mode_ref) {
	if (synctex_name_ref && file_ref && io_mode_ref) {
        /*  1 local variables that uses dynamic memory */
        char * synctex_name = NULL;
        gzFile the_file = NULL;
        char * quoteless_synctex_name = NULL;
		size_t size = 0;
        synctex_io_mode_t io_mode = *io_mode_ref;
		const char * mode = _synctex_get_io_mode_name(io_mode);
		/*  now create the synctex file name */
		size = strlen(output)+strlen(synctex_suffix)+strlen(synctex_suffix_gz)+1;
		synctex_name = (char *)malloc(size);
		if (NULL == synctex_name) {
			_synctex_error("!  __synctex_open: Memory problem (1)\n");
			return 1;
		}
		/*  we have reserved for synctex enough memory to copy output (including its 2 eventual quotes), both suffices,
		 *  including the terminating character. size is free now. */
		if (synctex_name != strcpy(synctex_name,output)) {
			_synctex_error("!  __synctex_open: Copy problem\n");
return_on_error:
			free(synctex_name);
			free(quoteless_synctex_name);
			return 2;
		}
		/*  remove the last path extension if any */
		_synctex_strip_last_path_extension(synctex_name);
		if (!strlen(synctex_name)) {
			goto return_on_error;		
		}
		/*  now insert quotes. */
		if (add_quotes) {
			char * quoted = NULL;
			if (_synctex_copy_with_quoting_last_path_component(synctex_name,&quoted,size) || (NULL == quoted)) {
				/*	There was an error or quoting does not make sense: */
				goto return_on_error;
			}
			quoteless_synctex_name = synctex_name;
			synctex_name = quoted;
		}
		/*	Now add to synctex_name the first path extension. */
		if (synctex_name != strcat(synctex_name,synctex_suffix)){
			_synctex_error("!  __synctex_open: Concatenation problem (can't add suffix '%s')\n",synctex_suffix);
			goto return_on_error;
		}
		/*	Add to quoteless_synctex_name as well, if relevant. */
		if (quoteless_synctex_name && (quoteless_synctex_name != strcat(quoteless_synctex_name,synctex_suffix))){
			free(quoteless_synctex_name);
			quoteless_synctex_name = NULL;
		}
		if (NULL == (the_file = gzopen(synctex_name,mode))) {
			/*  Could not open this file */
			if (errno != ENOENT) {
				/*  The file does exist, this is a lower level error, I can't do anything. */
				_synctex_error("SyncTeX: could not open %s, error %i\n",synctex_name,errno);
				goto return_on_error;
			}
			/*  Apparently, there is no uncompressed synctex file. Try the compressed version */
			if (synctex_name != strcat(synctex_name,synctex_suffix_gz)){
				_synctex_error("!  __synctex_open: Concatenation problem (can't add suffix '%s')\n",synctex_suffix_gz);
				goto return_on_error;
			}
			io_mode |= synctex_io_gz_mask;
			mode = _synctex_get_io_mode_name(io_mode); /* the file is a compressed and is a binary file, this caused errors on Windows */
			/*	Add the suffix to the quoteless_synctex_name as well. */
			if (quoteless_synctex_name && (quoteless_synctex_name != strcat(quoteless_synctex_name,synctex_suffix_gz))){
				free(quoteless_synctex_name);
				quoteless_synctex_name = NULL;
			}
			if (NULL == (the_file = gzopen(synctex_name,mode))) {
				/*  Could not open this file */
				if (errno != ENOENT) {
					/*  The file does exist, this is a lower level error, I can't do anything. */
					_synctex_error("SyncTeX: could not open %s, error %i\n",synctex_name,errno);
				}
				goto return_on_error;
			}
		}
		/*	At this point, the file is properly open.
		 *  If we are in the add_quotes mode, we change the file name by removing the quotes. */
		if (quoteless_synctex_name) {
			gzclose(the_file);
			if (rename(synctex_name,quoteless_synctex_name)) {
				_synctex_error("SyncTeX: could not rename %s to %s, error %i\n",synctex_name,quoteless_synctex_name,errno);
				/*	We could not rename, reopen the file with the quoted name. */
				if (NULL == (the_file = gzopen(synctex_name,mode))) {
					/*  No luck, could not re open this file, something has happened meanwhile */
					if (errno != ENOENT) {
						/*  The file does not exist any more, it has certainly be removed somehow
                         *  this is a lower level error, I can't do anything. */
						_synctex_error("SyncTeX: could not open again %s, error %i\n",synctex_name,errno);
					}
					goto return_on_error;
				}
			} else {
                /*  The file has been successfully renamed */
				if (NULL == (the_file = gzopen(quoteless_synctex_name,mode))) {
					/*  Could not open this file */
					if (errno != ENOENT) {
						/*  The file does exist, this is a lower level error, I can't do anything. */
						_synctex_error("SyncTeX: could not open renamed %s, error %i\n",quoteless_synctex_name,errno);
					}
					goto return_on_error;
				}
				/*  The quote free file name should replace the old one:*/
				free(synctex_name);
				synctex_name = quoteless_synctex_name;
				quoteless_synctex_name = NULL;
			}
		}
        /*  The operation is successfull, return the arguments by value.    */
        * file_ref = the_file;
        * io_mode_ref = io_mode;
        * synctex_name_ref = synctex_name;
		return 0;
	}
	return 3;	/*	Bad parameter.	*/
}

/*	Opens the ouput file, taking into account the eventual build_directory.
 *	0 on success, non 0 on error. */
int _synctex_open(const char * output, const char * build_directory, char ** synctex_name_ref, gzFile * file_ref, synctex_bool_t add_quotes, synctex_io_mode_t * io_mode_ref) {
#	define synctex_name (*synctex_name_ref)
#	define the_file (*file_ref)
	int result = __synctex_open(output,synctex_name_ref,file_ref,add_quotes,io_mode_ref);
	if ((result || !*file_ref) && build_directory && strlen(build_directory)) {
		char * build_output;
		const char *lpc;
		size_t size;
		synctex_bool_t is_absolute;
		build_output = NULL;
		lpc = _synctex_last_path_component(output);
		size = strlen(build_directory)+strlen(lpc)+2;   /*  One for the '/' and one for the '\0'.   */
		is_absolute = _synctex_path_is_absolute(build_directory);
		if (!is_absolute) {
			size += strlen(output);
		}
		if ((build_output = (char *)malloc(size))) {
			if (is_absolute) {
				build_output[0] = '\0';
			} else {
				if (build_output != strcpy(build_output,output)) {
					return -4;
				}
				build_output[lpc-output]='\0';
			}
			if (build_output == strcat(build_output,build_directory)) {
				/*	Append a path separator if necessary. */
				if (!SYNCTEX_IS_PATH_SEPARATOR(build_output[strlen(build_directory)-1])) {
					if (build_output != strcat(build_output,"/")) {
						return -2;
					}
				}
				/*	Append the last path component of the output. */
				if (build_output != strcat(build_output,lpc)) {
					return -3;
				}
				return __synctex_open(build_output,synctex_name_ref,file_ref,add_quotes,io_mode_ref);
			}
		}
		return -1;
	}
	return result;
#	undef synctex_name
#	undef the_file
}

/*  The scanner destructor
 */
void synctex_scanner_free(synctex_scanner_t scanner) {
	if (NULL == scanner) {
		return;
	}
	if (SYNCTEX_FILE) {
		gzclose(SYNCTEX_FILE);
		SYNCTEX_FILE = NULL;
	}
	SYNCTEX_FREE(scanner->sheet);
	SYNCTEX_FREE(scanner->input);
	free(SYNCTEX_START);
	free(scanner->output_fmt);
	free(scanner->output);
	free(scanner->synctex);
	free(scanner->lists_of_friends);
	free(scanner);
}

/*  Where the synctex scanner parses the contents of the file. */
synctex_scanner_t synctex_scanner_parse(synctex_scanner_t scanner) {
	synctex_status_t status = 0;
	if (!scanner || scanner->flags.has_parsed) {
		return scanner;
	}
	scanner->flags.has_parsed=1;
	scanner->pre_magnification = 1000;
	scanner->pre_unit = 8192;
	scanner->pre_x_offset = scanner->pre_y_offset = 578;
	/*  initialize the offset with a fake unprobable value,
	 *  If there is a post scriptum section, this value will be overriden by the real life value */
	scanner->x_offset = scanner->y_offset = 6.027e23f;
	scanner->class[synctex_node_type_sheet] = synctex_class_sheet;
	scanner->class[synctex_node_type_input] = synctex_class_input;
	(scanner->class[synctex_node_type_input]).scanner = scanner;
	(scanner->class[synctex_node_type_sheet]).scanner = scanner;
	scanner->class[synctex_node_type_vbox] = synctex_class_vbox;
	(scanner->class[synctex_node_type_vbox]).scanner = scanner;
	scanner->class[synctex_node_type_void_vbox] = synctex_class_void_vbox;
	(scanner->class[synctex_node_type_void_vbox]).scanner = scanner;
	scanner->class[synctex_node_type_hbox] = synctex_class_hbox;
	(scanner->class[synctex_node_type_hbox]).scanner = scanner;
	scanner->class[synctex_node_type_void_hbox] = synctex_class_void_hbox;
	(scanner->class[synctex_node_type_void_hbox]).scanner = scanner;
	scanner->class[synctex_node_type_kern] = synctex_class_kern;
	(scanner->class[synctex_node_type_kern]).scanner = scanner;
	scanner->class[synctex_node_type_glue] = synctex_class_glue;
	(scanner->class[synctex_node_type_glue]).scanner = scanner;
	scanner->class[synctex_node_type_math] = synctex_class_math;
	(scanner->class[synctex_node_type_math]).scanner = scanner;
	scanner->class[synctex_node_type_boundary] = synctex_class_boundary;
	(scanner->class[synctex_node_type_boundary]).scanner = scanner;
	SYNCTEX_START = (char *)malloc(SYNCTEX_BUFFER_SIZE+1); /*  one more character for null termination */
	if (NULL == SYNCTEX_START) {
		_synctex_error("SyncTeX: malloc error");
		synctex_scanner_free(scanner);
		return NULL;
	}
	SYNCTEX_END = SYNCTEX_START+SYNCTEX_BUFFER_SIZE;
	/*  SYNCTEX_END always points to a null terminating character.
	 *  Maybe there is another null terminating character between SYNCTEX_CUR and SYNCTEX_END-1.
	 *  At least, we are sure that SYNCTEX_CUR points to a string covering a valid part of the memory. */
	*SYNCTEX_END = '\0';
	SYNCTEX_CUR = SYNCTEX_END;
	status = _synctex_scan_preamble(scanner);
	if (status<SYNCTEX_STATUS_OK) {
		_synctex_error("SyncTeX Error: Bad preamble\n");
bailey:
		synctex_scanner_free(scanner);
		return NULL;
	}
	status = _synctex_scan_content(scanner);
	if (status<SYNCTEX_STATUS_OK) {
		_synctex_error("SyncTeX Error: Bad content\n");
		goto bailey;
	}
	/*  Everything is finished, free the buffer, close the file */
	free((void *)SYNCTEX_START);
	SYNCTEX_START = SYNCTEX_CUR = SYNCTEX_END = NULL;
	gzclose(SYNCTEX_FILE);
	SYNCTEX_FILE = NULL;
	/*  Final tuning: set the default values for various parameters */
	/*  1 pre_unit = (scanner->pre_unit)/65536 pt = (scanner->pre_unit)/65781.76 bp
	 * 1 pt = 65536 sp */
	if (scanner->pre_unit<=0) {
		scanner->pre_unit = 8192;
	}
	if (scanner->pre_magnification<=0) {
		scanner->pre_magnification = 1000;
	}
	if (scanner->unit <= 0) {
		/*  no post magnification */
		scanner->unit = scanner->pre_unit / 65781.76;/*  65781.76 or 65536.0*/
	} else {
		/*  post magnification */
		scanner->unit *= scanner->pre_unit / 65781.76;
	}
	scanner->unit *= scanner->pre_magnification / 1000.0;
	if (scanner->x_offset > 6e23) {
		/*  no post offset */
		scanner->x_offset = scanner->pre_x_offset * (scanner->pre_unit / 65781.76);
		scanner->y_offset = scanner->pre_y_offset * (scanner->pre_unit / 65781.76);
	} else {
		/*  post offset */
		scanner->x_offset /= 65781.76f;
		scanner->y_offset /= 65781.76f;
	}
	return scanner;
	#undef SYNCTEX_FILE
}

/*  Scanner accessors.
 */
int synctex_scanner_pre_x_offset(synctex_scanner_t scanner){
	return scanner?scanner->pre_x_offset:0;
}
int synctex_scanner_pre_y_offset(synctex_scanner_t scanner){
	return scanner?scanner->pre_y_offset:0;
}
int synctex_scanner_x_offset(synctex_scanner_t scanner){
	return scanner?scanner->x_offset:0;
}
int synctex_scanner_y_offset(synctex_scanner_t scanner){
	return scanner?scanner->y_offset:0;
}
float synctex_scanner_magnification(synctex_scanner_t scanner){
	return scanner?scanner->unit:1;
}
void synctex_scanner_display(synctex_scanner_t scanner) {
	if (NULL == scanner) {
		return;
	}
	printf("The scanner:\noutput:%s\noutput_fmt:%s\nversion:%i\n",scanner->output,scanner->output_fmt,scanner->version);
	printf("pre_unit:%i\nx_offset:%i\ny_offset:%i\n",scanner->pre_unit,scanner->pre_x_offset,scanner->pre_y_offset);
	printf("count:%i\npost_magnification:%f\npost_x_offset:%f\npost_y_offset:%f\n",
		scanner->count,scanner->unit,scanner->x_offset,scanner->y_offset);
	printf("The input:\n");
	SYNCTEX_DISPLAY(scanner->input);
	if (scanner->count<1000) {
		printf("The sheets:\n");
		SYNCTEX_DISPLAY(scanner->sheet);
		printf("The friends:\n");
		if (scanner->lists_of_friends) {
			int i = scanner->number_of_lists;
			synctex_node_t node;
			while(i--) {
				printf("Friend index:%i\n",i);
				node = (scanner->lists_of_friends)[i];
				while(node) {
					printf("%s:%i,%i\n",
						synctex_node_isa(node),
						SYNCTEX_TAG(node),
						SYNCTEX_LINE(node)
					);
					node = SYNCTEX_FRIEND(node);
				}
			}
		}
	} else {
		printf("SyncTeX Warning: Too many objects\n");
	}
}
/*  Public*/
const char * synctex_scanner_get_name(synctex_scanner_t scanner,int tag) {
	synctex_node_t input = NULL;
	if (NULL == scanner) {
		return NULL;
	}
	input = scanner->input;
	do {
		if (tag == SYNCTEX_TAG(input)) {
			return (SYNCTEX_NAME(input));
		}
	} while((input = SYNCTEX_SIBLING(input)) != NULL);
	return NULL;
}

int _synctex_scanner_get_tag(synctex_scanner_t scanner,const char * name);
int _synctex_scanner_get_tag(synctex_scanner_t scanner,const char * name) {
	synctex_node_t input = NULL;
	if (NULL == scanner) {
		return 0;
	}
	input = scanner->input;
	do {
		if (_synctex_is_equivalent_file_name(name,(SYNCTEX_NAME(input)))) {
			return SYNCTEX_TAG(input);
		}
	} while((input = SYNCTEX_SIBLING(input)) != NULL);
	return 0;
}

int synctex_scanner_get_tag(synctex_scanner_t scanner,const char * name) {
	size_t char_index = strlen(name);
	if ((scanner = synctex_scanner_parse(scanner)) && (0 < char_index)) {
		/*  the name is not void */
		char_index -= 1;
		if (!SYNCTEX_IS_PATH_SEPARATOR(name[char_index])) {
			/*  the last character of name is not a path separator */
			int result = _synctex_scanner_get_tag(scanner,name);
			if (result) {
				return result;
			} else {
				/*  the given name was not the one known by TeX
				 *  try a name relative to the enclosing directory of the scanner->output file */
				const char * relative = name;
				const char * ptr = scanner->output;
				while((strlen(relative) > 0) && (strlen(ptr) > 0) && (*relative == *ptr))
				{
					relative += 1;
					ptr += 1;
				}
				/*  Find the last path separator before relative */
				while(relative > name) {
					if (SYNCTEX_IS_PATH_SEPARATOR(*(relative-1))) {
						break;
					}
					relative -= 1;
				}
				if ((relative > name) && (result = _synctex_scanner_get_tag(scanner,relative))) {
					return result;
				}
				if (SYNCTEX_IS_PATH_SEPARATOR(name[0])) {
					/*  No tag found for the given absolute name,
					 *  Try each relative path starting from the shortest one */
					while(0<char_index) {
						char_index -= 1;
						if (SYNCTEX_IS_PATH_SEPARATOR(name[char_index])
								&& (result = _synctex_scanner_get_tag(scanner,name+char_index+1))) {
							return result;
						}
					}
				}
			}
			return result;
		}
	}
	return 0;
}
synctex_node_t synctex_scanner_input(synctex_scanner_t scanner) {
	return scanner?scanner->input:NULL;
}
const char * synctex_scanner_get_output_fmt(synctex_scanner_t scanner) {
	return NULL != scanner && scanner->output_fmt?scanner->output_fmt:"";
}
const char * synctex_scanner_get_output(synctex_scanner_t scanner) {
	return NULL != scanner && scanner->output?scanner->output:"";
}
const char * synctex_scanner_get_synctex(synctex_scanner_t scanner) {
	return NULL != scanner && scanner->synctex?scanner->synctex:"";
}
#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark Public node attributes
#   endif
int synctex_node_h(synctex_node_t node){
	if (!node) {
		return 0;
	}
	return SYNCTEX_HORIZ(node);
}
int synctex_node_v(synctex_node_t node){
	if (!node) {
		return 0;
	}
	return SYNCTEX_VERT(node);
}
int synctex_node_width(synctex_node_t node){
	if (!node) {
		return 0;
	}
	return SYNCTEX_WIDTH(node);
}
int synctex_node_box_h(synctex_node_t node){
	if (!node) {
		return 0;
	}
	if (SYNCTEX_IS_BOX(node)) {
result:
		return SYNCTEX_HORIZ(node);
	}
	if ((node = SYNCTEX_PARENT(node)) && (node->class->type != synctex_node_type_sheet)) {
		goto result;
	}
	return 0;
}
int synctex_node_box_v(synctex_node_t node){
	if (!node) {
		return 0;
	}
	if (SYNCTEX_IS_BOX(node)) {
result:
		return SYNCTEX_VERT(node);
	}
	if ((node = SYNCTEX_PARENT(node)) && (node->class->type != synctex_node_type_sheet)) {
		goto result;
	}
	return 0;
}
int synctex_node_box_width(synctex_node_t node){
	if (!node) {
		return 0;
	}
	if (SYNCTEX_IS_BOX(node)) {
result:
		return SYNCTEX_WIDTH(node);
	}
	if ((node = SYNCTEX_PARENT(node)) && (node->class->type != synctex_node_type_sheet)) {
		goto result;
	}
	return 0;
}
int synctex_node_box_height(synctex_node_t node){
	if (!node) {
		return 0;
	}
	if (SYNCTEX_IS_BOX(node)) {
result:
		return SYNCTEX_HEIGHT(node);
	}
	if ((node = SYNCTEX_PARENT(node)) && (node->class->type != synctex_node_type_sheet)) {
		goto result;
	}
	return 0;
}
int synctex_node_box_depth(synctex_node_t node){
	if (!node) {
		return 0;
	}
	if (SYNCTEX_IS_BOX(node)) {
result:
		return SYNCTEX_DEPTH(node);
	}
	if ((node = SYNCTEX_PARENT(node)) && (node->class->type != synctex_node_type_sheet)) {
		goto result;
	}
	return 0;
}
#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark Public node visible attributes
#   endif
float synctex_node_visible_h(synctex_node_t node){
	if (!node) {
		return 0;
	}
	return SYNCTEX_HORIZ(node)*node->class->scanner->unit+node->class->scanner->x_offset;
}
float synctex_node_visible_v(synctex_node_t node){
	if (!node) {
		return 0;
	}
	return SYNCTEX_VERT(node)*node->class->scanner->unit+node->class->scanner->y_offset;
}
float synctex_node_visible_width(synctex_node_t node){
	if (!node) {
		return 0;
	}
	return SYNCTEX_WIDTH(node)*node->class->scanner->unit;
}
float synctex_node_box_visible_h(synctex_node_t node){
	if (!node) {
		return 0;
	}
	switch(node->class->type) {
		case synctex_node_type_vbox:
		case synctex_node_type_void_vbox:
		case synctex_node_type_void_hbox:
			return SYNCTEX_HORIZ(node)*node->class->scanner->unit+node->class->scanner->x_offset;
		case synctex_node_type_hbox:
result:
			return SYNCTEX_HORIZ_V(node)*node->class->scanner->unit+node->class->scanner->x_offset;
	}
	if ((node = SYNCTEX_PARENT(node)) && (node->class->type != synctex_node_type_sheet)) {
		goto result;
	}
	return 0;
}
float synctex_node_box_visible_v(synctex_node_t node){
	if (!node) {
		return 0;
	}
	switch(node->class->type) {
		case synctex_node_type_vbox:
		case synctex_node_type_void_vbox:
		case synctex_node_type_void_hbox:
			return SYNCTEX_VERT(node)*node->class->scanner->unit+node->class->scanner->y_offset;
		case synctex_node_type_hbox:
result:
			return SYNCTEX_VERT_V(node)*node->class->scanner->unit+node->class->scanner->y_offset;
	}
	if ((node = SYNCTEX_PARENT(node)) && (node->class->type != synctex_node_type_sheet)) {
		goto result;
	}
	return 0;
}
float synctex_node_box_visible_width(synctex_node_t node){
	if (!node) {
		return 0;
	}
	switch(node->class->type) {
		case synctex_node_type_vbox:
		case synctex_node_type_void_vbox:
		case synctex_node_type_void_hbox:
			return SYNCTEX_WIDTH(node)*node->class->scanner->unit;
		case synctex_node_type_hbox:
result:
			return SYNCTEX_WIDTH_V(node)*node->class->scanner->unit;
	}
	if ((node = SYNCTEX_PARENT(node)) && (node->class->type != synctex_node_type_sheet)) {
		goto result;
	}
	return 0;
}
float synctex_node_box_visible_height(synctex_node_t node){
	if (!node) {
		return 0;
	}
	switch(node->class->type) {
		case synctex_node_type_vbox:
		case synctex_node_type_void_vbox:
		case synctex_node_type_void_hbox:
			return SYNCTEX_HEIGHT(node)*node->class->scanner->unit;
		case synctex_node_type_hbox:
result:
			return SYNCTEX_HEIGHT_V(node)*node->class->scanner->unit;
	}
	if ((node = SYNCTEX_PARENT(node)) && (node->class->type != synctex_node_type_sheet)) {
		goto result;
	}
	return 0;
}
float synctex_node_box_visible_depth(synctex_node_t node){
	if (!node) {
		return 0;
	}
	switch(node->class->type) {
		case synctex_node_type_vbox:
		case synctex_node_type_void_vbox:
		case synctex_node_type_void_hbox:
			return SYNCTEX_DEPTH(node)*node->class->scanner->unit;
		case synctex_node_type_hbox:
result:
			return SYNCTEX_DEPTH_V(node)*node->class->scanner->unit;
	}
	if ((node = SYNCTEX_PARENT(node)) && (node->class->type != synctex_node_type_sheet)) {
		goto result;
	}
	return 0;
}
#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark Other public node attributes
#   endif

int synctex_node_page(synctex_node_t node){
	synctex_node_t parent = NULL;
	if (!node) {
		return -1;
	}
	parent = SYNCTEX_PARENT(node);
	while(parent) {
		node = parent;
		parent = SYNCTEX_PARENT(node);
	}
	if (node->class->type == synctex_node_type_sheet) {
		return SYNCTEX_PAGE(node);
	}
	return -1;
}
int synctex_node_tag(synctex_node_t node) {
	return node?SYNCTEX_TAG(node):-1;
}
int synctex_node_line(synctex_node_t node) {
	return node?SYNCTEX_LINE(node):-1;
}
int synctex_node_column(synctex_node_t node) {
#	ifdef __DARWIN_UNIX03
#       pragma unused(node)
#   endif
	return -1;
}
#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark Sheet
#   endif

synctex_node_t synctex_sheet_content(synctex_scanner_t scanner,int page) {
	if (scanner) {
		synctex_node_t sheet = scanner->sheet;
		while(sheet) {
			if (page == SYNCTEX_PAGE(sheet)) {
				return SYNCTEX_CHILD(sheet);
			}
			sheet = SYNCTEX_SIBLING(sheet);
		}
	}
	return NULL;
}

#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark Query
#   endif

int synctex_display_query(synctex_scanner_t scanner,const char * name,int line,int column) {
#	ifdef __DARWIN_UNIX03
#       pragma unused(column)
#   endif
	int tag = synctex_scanner_get_tag(scanner,name);
	size_t size = 0;
	int friend_index = 0;
	int max_line = 0;
	synctex_node_t node = NULL;
	if (tag == 0) {
		printf("SyncTeX Warning: No tag for %s\n",name);
		return -1;
	}
	free(SYNCTEX_START);
	SYNCTEX_CUR = SYNCTEX_END = SYNCTEX_START = NULL;
	max_line = line < INT_MAX-scanner->number_of_lists ? line+scanner->number_of_lists:INT_MAX;
	while(line<max_line) {
		/*  This loop will only be performed once for advanced viewers */
		friend_index = (tag+line)%(scanner->number_of_lists);
		if ((node = (scanner->lists_of_friends)[friend_index])) {
			do {
				if ((synctex_node_type(node)>=synctex_node_type_boundary)
					&& (tag == SYNCTEX_TAG(node))
						&& (line == SYNCTEX_LINE(node))) {
					if (SYNCTEX_CUR == SYNCTEX_END) {
						size += 16;
						SYNCTEX_END = realloc(SYNCTEX_START,size*sizeof(synctex_node_t *));
						SYNCTEX_CUR += SYNCTEX_END - SYNCTEX_START;
						SYNCTEX_START = SYNCTEX_END;
						SYNCTEX_END = SYNCTEX_START + size*sizeof(synctex_node_t *);
					}			
					*(synctex_node_t *)SYNCTEX_CUR = node;
					SYNCTEX_CUR += sizeof(synctex_node_t);
				}
			} while((node = SYNCTEX_FRIEND(node)));
			if (SYNCTEX_START == NULL) {
				/*  We did not find any matching boundary, retry with glue or kern */
				node = (scanner->lists_of_friends)[friend_index];/*  no need to test it again, already done */
				do {
					if ((synctex_node_type(node)>=synctex_node_type_kern)
						&& (tag == SYNCTEX_TAG(node))
							&& (line == SYNCTEX_LINE(node))) {
						if (SYNCTEX_CUR == SYNCTEX_END) {
							size += 16;
							SYNCTEX_END = realloc(SYNCTEX_START,size*sizeof(synctex_node_t *));
							SYNCTEX_CUR += SYNCTEX_END - SYNCTEX_START;
							SYNCTEX_START = SYNCTEX_END;
							SYNCTEX_END = SYNCTEX_START + size*sizeof(synctex_node_t *);
						}			
						*(synctex_node_t *)SYNCTEX_CUR = node;
						SYNCTEX_CUR += sizeof(synctex_node_t);
					}
				} while((node = SYNCTEX_FRIEND(node)));
				if (SYNCTEX_START == NULL) {
					/*  We did not find any matching glue or kern, retry with boxes */
					node = (scanner->lists_of_friends)[friend_index];/*  no need to test it again, already done */
					do {
						if ((tag == SYNCTEX_TAG(node))
								&& (line == SYNCTEX_LINE(node))) {
							if (SYNCTEX_CUR == SYNCTEX_END) {
								size += 16;
								SYNCTEX_END = realloc(SYNCTEX_START,size*sizeof(synctex_node_t *));
								SYNCTEX_CUR += SYNCTEX_END - SYNCTEX_START;
								SYNCTEX_START = SYNCTEX_END;
								SYNCTEX_END = SYNCTEX_START + size*sizeof(synctex_node_t *);
							}			
							*(synctex_node_t *)SYNCTEX_CUR = node;
							SYNCTEX_CUR += sizeof(synctex_node_t);
						}
					} while((node = SYNCTEX_FRIEND(node)));
				}
			}
			SYNCTEX_END = SYNCTEX_CUR;
			/*  Now reverse the order to have nodes in display order, and keep just a few nodes */
			if ((SYNCTEX_START) && (SYNCTEX_END))
			{
				synctex_node_t * start_ref = (synctex_node_t *)SYNCTEX_START;
				synctex_node_t * end_ref   = (synctex_node_t *)SYNCTEX_END;
				end_ref -= 1;
				while(start_ref < end_ref) {
					node = *start_ref;
					*start_ref = *end_ref;
					*end_ref = node;
					start_ref += 1;
					end_ref -= 1;
				}
				/*  Basically, we keep the first node for each parent.
				 *  More precisely, we keep only nodes that are not descendants of
				 *  their predecessor's parent. */
				start_ref = (synctex_node_t *)SYNCTEX_START;
				end_ref   = (synctex_node_t *)SYNCTEX_START;
		next_end:
				end_ref += 1; /*  we allways have start_ref<= end_ref*/
				if (end_ref < (synctex_node_t *)SYNCTEX_END) {
					node = *end_ref;
					while((node = SYNCTEX_PARENT(node))) {
						if (SYNCTEX_PARENT(*start_ref) == node) {
							goto next_end;
						}
					}
					start_ref += 1;
					*start_ref = *end_ref;
					goto next_end;
				}
				start_ref += 1;
                SYNCTEX_END = (char *)start_ref;
                SYNCTEX_CUR = NULL;// added on behalf of Jose Alliste
				return (SYNCTEX_END-SYNCTEX_START)/sizeof(synctex_node_t);// added on behalf Jan Sundermeyer
            }
			SYNCTEX_CUR = NULL;
			// return (SYNCTEX_END-SYNCTEX_START)/sizeof(synctex_node_t); removed on behalf Jan Sundermeyer
		}
#       if defined(__SYNCTEX_STRONG_DISPLAY_QUERY__)
		break;
#       else
		++line;
#       endif
	}
	return 0;
}

synctex_node_t synctex_next_result(synctex_scanner_t scanner) {
	if (NULL == SYNCTEX_CUR) {
		SYNCTEX_CUR = SYNCTEX_START;
	} else {
		SYNCTEX_CUR+=sizeof(synctex_node_t);
	}
	if (SYNCTEX_CUR<SYNCTEX_END) {
		return *(synctex_node_t*)SYNCTEX_CUR;
	} else {
		return NULL;
	}
}

/*  This struct records a point in TeX coordinates.*/
typedef struct {
	int h;
	int v;
} synctex_point_t;

/*  This struct records distances, the left one is positive or 0 and the right one is negative or 0.
 *  When comparing the locations of 2 different graphical objects on the page, we will have to also record the
 *  horizontal distance as signed to keep track of the typesetting order.*/
typedef struct {
	int left;
	int right;
} synctex_distances_t;

typedef struct {
	synctex_point_t left;
	synctex_point_t right;
} synctex_offsets_t;


typedef struct {
	synctex_node_t left;
	synctex_node_t right;
} synctex_node_set_t;

/*  The smallest container between two has the smallest width or height.
 *  This comparison is used when there are 2 overlapping boxes that contain the hit point.
 *  For ConTeXt, the problem appears at each page.
 *  The chosen box is the one with the smallest height, then the smallest width. */
SYNCTEX_INLINE static synctex_node_t _synctex_smallest_container(synctex_node_t node, synctex_node_t other_node);

/*  Returns the distance between the hit point hitPoint=(H,V) and the given node. */
synctex_bool_t _synctex_point_in_box(synctex_point_t hitPoint, synctex_node_t node, synctex_bool_t visible);
int _synctex_node_distance_to_point(synctex_point_t hitPoint, synctex_node_t node, synctex_bool_t visible);

/*  The best container is the deeper box that contains the hit point (H,V).
 *  _synctex_eq_deepest_container starts with node whereas
 *  _synctex_box_child_deepest starts with node's children, if any
 *  if node is not a box, or a void box, NULL is returned.
 *  We traverse the node tree in a deep first manner and stop as soon as a result is found. */
static synctex_node_t _synctex_eq_deepest_container(synctex_point_t hitPoint,synctex_node_t node, synctex_bool_t visible);

/*  Once a best container is found, the closest children are the closest nodes to the left or right of the hit point.
 *  Only horizontal and vertical offsets are used to compare the positions of the nodes. */
SYNCTEX_INLINE static int _synctex_eq_get_closest_children_in_box(synctex_point_t hitPoint, synctex_node_t node, synctex_node_set_t*  bestNodesRef,synctex_distances_t*  bestDistancesRef, synctex_bool_t visible);

/*  The closest container is the box that is the one closest to the given point.
 *  The "visible" version takes into account the visible dimensions instead of the real ones given by TeX. */
SYNCTEX_INLINE static synctex_node_t _synctex_eq_closest_child(synctex_point_t hitPoint,synctex_node_t node, synctex_bool_t visible);

#define SYNCTEX_MASK_LEFT 1
#define SYNCTEX_MASK_RIGHT 2

int synctex_edit_query(synctex_scanner_t scanner,int page,float h,float v) {
	synctex_node_t sheet = NULL;
	synctex_node_t node = NULL; /*  placeholder */
	synctex_node_t other_node = NULL; /*  placeholder */
	synctex_point_t hitPoint = {0,0}; /*  placeholder */
	synctex_node_set_t bestNodes = {NULL,NULL}; /*  holds the best node */
	synctex_distances_t bestDistances = {INT_MAX,INT_MAX}; /*  holds the best distances for the best node */
	synctex_node_t bestContainer = NULL; /*  placeholder */
	if (NULL == (scanner = synctex_scanner_parse(scanner)) || 0 >= scanner->unit) {/*  scanner->unit must be >0 */
		return 0;
	}
	/*  Convert the given point to scanner integer coordinates */
	hitPoint.h = (h-scanner->x_offset)/scanner->unit;
	hitPoint.v = (v-scanner->y_offset)/scanner->unit;
	/*  We will store in the scanner's buffer the result of the query. */
	free(SYNCTEX_START);
	SYNCTEX_START = SYNCTEX_END = SYNCTEX_CUR = NULL;
	/*  Find the proper sheet */
	sheet = scanner->sheet;
	while((sheet) && SYNCTEX_PAGE(sheet) != page) {
		sheet = SYNCTEX_SIBLING(sheet);
	}
	if (NULL == sheet) {
		return -1;
	}
	/*  Now sheet points to the sheet node with proper page number */
	/*  Here is how we work:
	 *  At first we do not consider the visible box dimensions. This will cover the most frequent cases.
	 *  Then we try with the visible box dimensions.
	 *  We try to find a non void box containing the hit point.
	 *  We browse all the horizontal boxes until we find one containing the hit point. */
	if ((node = SYNCTEX_NEXT_HORIZ_BOX(sheet))) {
		do {
			if (_synctex_point_in_box(hitPoint,node,synctex_YES)) {
				/*  Maybe the hitPoint belongs to a contained vertical box. */
end:
				/*  This trick is for catching overlapping boxes */
				if ((other_node = SYNCTEX_NEXT_HORIZ_BOX(node))) {
					do {
						if (_synctex_point_in_box(hitPoint,other_node,synctex_YES)) {
							node = _synctex_smallest_container(other_node,node); 
						}
					} while((other_node = SYNCTEX_NEXT_HORIZ_BOX(other_node)));
				}
                /*  node is the smallest horizontal box that contains hitPoint. */
				if ((bestContainer = _synctex_eq_deepest_container(hitPoint,node,synctex_YES))) {
					node = bestContainer;
				}
				_synctex_eq_get_closest_children_in_box(hitPoint,node,&bestNodes,&bestDistances,synctex_YES);
				if (bestNodes.right && bestNodes.left) {
					if ((SYNCTEX_TAG(bestNodes.right)!=SYNCTEX_TAG(bestNodes.left))
							|| (SYNCTEX_LINE(bestNodes.right)!=SYNCTEX_LINE(bestNodes.left))
								|| (SYNCTEX_COLUMN(bestNodes.right)!=SYNCTEX_COLUMN(bestNodes.left))) {
						if ((SYNCTEX_START = malloc(2*sizeof(synctex_node_t)))) {
							if (bestDistances.left>bestDistances.right) {
								((synctex_node_t *)SYNCTEX_START)[0] = bestNodes.right;
								((synctex_node_t *)SYNCTEX_START)[1] = bestNodes.left;
							} else {
								((synctex_node_t *)SYNCTEX_START)[0] = bestNodes.left;
								((synctex_node_t *)SYNCTEX_START)[1] = bestNodes.right;
							}
							SYNCTEX_END = SYNCTEX_START + 2*sizeof(synctex_node_t);
							SYNCTEX_CUR = NULL;
							return (SYNCTEX_END-SYNCTEX_START)/sizeof(synctex_node_t);
						}
						return SYNCTEX_STATUS_ERROR;
					}
					/*  both nodes have the same input coordinates
					 *  We choose the one closest to the hit point  */
					if (bestDistances.left>bestDistances.right) {
						bestNodes.left = bestNodes.right;
					}
					bestNodes.right = NULL;
				} else if (bestNodes.right) {
					bestNodes.left = bestNodes.right;
				} else if (!bestNodes.left){
					bestNodes.left = node;
				}
				if ((SYNCTEX_START = malloc(sizeof(synctex_node_t)))) {
					* (synctex_node_t *)SYNCTEX_START = bestNodes.left;
					SYNCTEX_END = SYNCTEX_START + sizeof(synctex_node_t);
					SYNCTEX_CUR = NULL;
					return (SYNCTEX_END-SYNCTEX_START)/sizeof(synctex_node_t);
				}
				return SYNCTEX_STATUS_ERROR;
			}
		} while ((node = SYNCTEX_NEXT_HORIZ_BOX(node)));
		/*  All the horizontal boxes have been tested,
		 *  None of them contains the hit point.
		 */
	}
	/*  We are not lucky */
	if ((node = SYNCTEX_CHILD(sheet))) {
		goto end;
	}
	return 0;
}

#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark Utilities
#   endif

int _synctex_bail(void) {
		_synctex_error("SyncTeX ERROR\n");
		return -1;
}
/*  Rougly speaking, this is:
 *  node's h coordinate - hitPoint's h coordinate.
 *  If node is to the right of the hit point, then this distance is positive,
 *  if node is to the left of the hit point, this distance is negative.*/
int _synctex_point_h_distance(synctex_point_t hitPoint, synctex_node_t node, synctex_bool_t visible);
int _synctex_point_h_distance(synctex_point_t hitPoint, synctex_node_t node, synctex_bool_t visible) {
	if (node) {
		int min,med,max;
		switch(node->class->type) {
			/*  The distance between a point and a box is special.
			 *  It is not the euclidian distance, nor something similar.
			 *  We have to take into account the particular layout,
			 *  and the box hierarchy.
			 *  Given a box, there are 9 regions delimited by the lines of the edges of the box.
			 *  The origin being at the top left corner of the page,
			 *  we also give names to the vertices of the box.
			 *
			 *   1 | 2 | 3
			 *  ---A---B--->
			 *   4 | 5 | 6
			 *  ---C---D--->
			 *   7 | 8 | 9
			 *     v   v
			 */
			case synctex_node_type_hbox:
				/*  getting the box bounds, taking into account negative width, height and depth. */
				min = visible?SYNCTEX_HORIZ_V(node):SYNCTEX_HORIZ(node);
				max = min + (visible?SYNCTEX_ABS_WIDTH_V(node):SYNCTEX_ABS_WIDTH(node));
				/*  We allways have min <= max */
				if (hitPoint.h<min) {
					return min - hitPoint.h; /*  regions 1+4+7, result is > 0 */
				} else if (hitPoint.h>max) {
					return max - hitPoint.h; /*  regions 3+6+9, result is < 0 */
				} else {
					return 0; /*  regions 2+5+8, inside the box, except for vertical coordinates */
				}
				break;
			case synctex_node_type_vbox:
			case synctex_node_type_void_vbox:
			case synctex_node_type_void_hbox:
				/*  getting the box bounds, taking into account negative width, height and depth.
				 *  For these boxes, no visible dimension available */
				min = SYNCTEX_HORIZ(node);
				max = min + SYNCTEX_ABS_WIDTH(node);
				/*  We allways have min <= max */
				if (hitPoint.h<min) {
					return min - hitPoint.h; /*  regions 1+4+7, result is > 0 */
				} else if (hitPoint.h>max) {
					return max - hitPoint.h; /*  regions 3+6+9, result is < 0 */
				} else {
					return 0; /*  regions 2+5+8, inside the box, except for vertical coordinates */
				}
				break;
			case synctex_node_type_kern:
				/*  IMPORTANT NOTICE: the location of the kern is recorded AFTER the move.
				 *  The distance to the kern is very special,
				 *  in general, there is no text material in the kern,
				 *  this is why we compute the offset relative to the closest edge of the kern.*/
				max = SYNCTEX_WIDTH(node);
				if (max<0) {
					min = SYNCTEX_HORIZ(node);
					max = min - max;
				} else {
					min = -max;
					max = SYNCTEX_HORIZ(node);
					min += max;
				}
				med = (min+max)/2;
				/*  positive kern: '.' means text, '>' means kern offset
				 *      .............
				 *                   min>>>>med>>>>max
				 *                                    ...............
				 *  negative kern: '.' means text, '<' means kern offset
				 *      ............................
				 *                 min<<<<med<<<<max
				 *                 .................................
				 *  Actually, we do not take into account negative widths.
				 *  There is a problem for such situation when there is efectively overlapping text.
				 *  But this should be extremely rare. I guess that in that case, many different choices
				 *  could be made, one being in contradiction of the other.
				 *  It means that the best choice should be made according to the situation that occurs
				 *  most frequently.
				 */
				if (hitPoint.h<min) {
					return min - hitPoint.h + 1; /*  penalty to ensure other nodes are chosen first in case of overlapping ones */
				} else if (hitPoint.h>max) {
					return max - hitPoint.h - 1; /*  same kind of penalty */
				} else if (hitPoint.h>med) {
					/*  do things like if the node had 0 width and was placed at the max edge + 1*/
					return max - hitPoint.h + 1; /*  positive, the kern is to the right of the hitPoint */
				} else {
					return min - hitPoint.h - 1; /*  negative, the kern is to the left of the hitPoint */
				}
			case synctex_node_type_glue:
			case synctex_node_type_math:
				return SYNCTEX_HORIZ(node) - hitPoint.h;
		}
	}
	return INT_MAX;/*  We always assume that the node is faraway to the right*/
}
/*  Rougly speaking, this is:
 *  node's v coordinate - hitPoint's v coordinate.
 *  If node is at the top of the hit point, then this distance is positive,
 *  if node is at the bottom of the hit point, this distance is negative.*/
int _synctex_point_v_distance(synctex_point_t hitPoint, synctex_node_t node,synctex_bool_t visible);
int _synctex_point_v_distance(synctex_point_t hitPoint, synctex_node_t node,synctex_bool_t visible) {
#	ifdef __DARWIN_UNIX03
#       pragma unused(visible)
#   endif
	if (node) {
		int min,max;
		switch(node->class->type) {
			/*  The distance between a point and a box is special.
			 *  It is not the euclidian distance, nor something similar.
			 *  We have to take into account the particular layout,
			 *  and the box hierarchy.
			 *  Given a box, there are 9 regions delimited by the lines of the edges of the box.
			 *  The origin being at the top left corner of the page,
			 *  we also give names to the vertices of the box.
			 *
			 *   1 | 2 | 3
			 *  ---A---B--->
			 *   4 | 5 | 6
			 *  ---C---D--->
			 *   7 | 8 | 9
			 *     v   v
			 */
			case synctex_node_type_hbox:
				/*  getting the box bounds, taking into account negative width, height and depth. */
				min = SYNCTEX_VERT_V(node);
				max = min + SYNCTEX_ABS_DEPTH_V(node);
				min -= SYNCTEX_ABS_HEIGHT_V(node);
				/*  We allways have min <= max */
				if (hitPoint.v<min) {
					return min - hitPoint.v; /*  regions 1+2+3, result is > 0 */
				} else if (hitPoint.v>max) {
					return max - hitPoint.v; /*  regions 7+8+9, result is < 0 */
				} else {
					return 0; /*  regions 4.5.6, inside the box, except for horizontal coordinates */
				}
				break;
			case synctex_node_type_vbox:
			case synctex_node_type_void_vbox:
			case synctex_node_type_void_hbox:
				/*  getting the box bounds, taking into account negative width, height and depth. */
				min = SYNCTEX_VERT(node);
				max = min + SYNCTEX_ABS_DEPTH(node);
				min -= SYNCTEX_ABS_HEIGHT(node);
				/*  We allways have min <= max */
				if (hitPoint.v<min) {
					return min - hitPoint.v; /*  regions 1+2+3, result is > 0 */
				} else if (hitPoint.v>max) {
					return max - hitPoint.v; /*  regions 7+8+9, result is < 0 */
				} else {
					return 0; /*  regions 4.5.6, inside the box, except for horizontal coordinates */
				}
				break;
			case synctex_node_type_kern:
			case synctex_node_type_glue:
			case synctex_node_type_math:
				return SYNCTEX_VERT(node) - hitPoint.v;
		}
	}
	return INT_MAX;/*  We always assume that the node is faraway to the top*/
}

SYNCTEX_INLINE static synctex_node_t _synctex_smallest_container(synctex_node_t node, synctex_node_t other_node) {
	float height, other_height;
	if (SYNCTEX_ABS_WIDTH(node)<SYNCTEX_ABS_WIDTH(other_node)) {
		return node;
	}
	if (SYNCTEX_ABS_WIDTH(node)>SYNCTEX_ABS_WIDTH(other_node)) {
		return other_node;
	}
	height = SYNCTEX_ABS_DEPTH(node) + SYNCTEX_ABS_HEIGHT(node);
	other_height = SYNCTEX_ABS_DEPTH(other_node) + SYNCTEX_ABS_HEIGHT(other_node);
	if (height<other_height) {
		return node;
	}
	if (height>other_height) {
		return other_node;
	}
	return node;
}

synctex_bool_t _synctex_point_in_box(synctex_point_t hitPoint, synctex_node_t node, synctex_bool_t visible) {
	if (node) {
		if (0 == _synctex_point_h_distance(hitPoint,node,visible)
				&& 0 == _synctex_point_v_distance(hitPoint,node,visible)) {
			return synctex_YES;
		}
	}
	return synctex_NO;	
}

int _synctex_node_distance_to_point(synctex_point_t hitPoint, synctex_node_t node, synctex_bool_t visible) {
#	ifdef __DARWIN_UNIX03
#       pragma unused(visible)
#   endif
	int result = INT_MAX; /*  when the distance is meaning less (sheet, input...)  */
	if (node) {
		int minH,maxH,minV,maxV;
		switch(node->class->type) {
			/*  The distance between a point and a box is special.
			 *  It is not the euclidian distance, nor something similar.
			 *  We have to take into account the particular layout,
			 *  and the box hierarchy.
			 *  Given a box, there are 9 regions delimited by the lines of the edges of the box.
			 *  The origin being at the top left corner of the page,
			 *  we also give names to the vertices of the box.
			 *
			 *   1 | 2 | 3
			 *  ---A---B--->
			 *   4 | 5 | 6
			 *  ---C---D--->
			 *   7 | 8 | 9
			 *     v   v
			 *  In each region, there is a different formula.
			 *  In the end we have a continuous distance which may not be a mathematical distance but who cares. */
			case synctex_node_type_vbox:
			case synctex_node_type_void_vbox:
			case synctex_node_type_hbox:
			case synctex_node_type_void_hbox:
				/*  getting the box bounds, taking into account negative widths. */
				minH = SYNCTEX_HORIZ(node);
				maxH = minH + SYNCTEX_ABS_WIDTH(node);
				minV = SYNCTEX_VERT(node);
				maxV = minV + SYNCTEX_ABS_DEPTH(node);
				minV -= SYNCTEX_ABS_HEIGHT(node);
				/*  In what region is the point hitPoint=(H,V) ? */
				if (hitPoint.v<minV) {
					if (hitPoint.h<minH) {
						/*  This is region 1. The distance to the box is the L1 distance PA. */
						result = minV - hitPoint.v + minH - hitPoint.h;/*  Integer overflow? probability epsilon */
					} else if (hitPoint.h<=maxH) {
						/*  This is region 2. The distance to the box is the geometrical distance to the top edge.  */
						result = minV - hitPoint.v;
					} else {
						/*  This is region 3. The distance to the box is the L1 distance PB. */
						result = minV - hitPoint.v + hitPoint.h - maxH;
					}
				} else if (hitPoint.v<=maxV) {
					if (hitPoint.h<minH) {
						/*  This is region 4. The distance to the box is the geometrical distance to the left edge.  */
						result = minH - hitPoint.h;
					} else if (hitPoint.h<=maxH) {
						/*  This is region 4. We are inside the box.  */
						result = 0;
					} else {
						/*  This is region 6. The distance to the box is the geometrical distance to the right edge.  */
						result = hitPoint.h - maxH;
					}
				} else {
					if (hitPoint.h<minH) {
						/*  This is region 7. The distance to the box is the L1 distance PC. */
						result = hitPoint.v - maxV + minH - hitPoint.h;
					} else if (hitPoint.h<=maxH) {
						/*  This is region 8. The distance to the box is the geometrical distance to the top edge.  */
						result = hitPoint.v - maxV;
					} else {
						/*  This is region 9. The distance to the box is the L1 distance PD. */
						result = hitPoint.v - maxV + hitPoint.h - maxH;
					}
				}
				break;
			case synctex_node_type_kern:
				maxH = SYNCTEX_WIDTH(node);
				if (maxH<0) {
					minH = SYNCTEX_HORIZ(node);
					maxH = minH - maxH;
				} else {
					minH = -maxH;
					maxH = SYNCTEX_HORIZ(node);
					minH += maxH;
				}
				minV = SYNCTEX_VERT(node);
				if (hitPoint.h<minH) {
					if (hitPoint.v>minV) {
						result = hitPoint.v - minV + minH - hitPoint.h;
					} else {
						result = minV - hitPoint.v + minH - hitPoint.h;
					}
				} else if (hitPoint.h>maxH) {
					if (hitPoint.v>minV) {
						result = hitPoint.v - minV + hitPoint.h - maxH;
					} else {
						result = minV - hitPoint.v + hitPoint.h - maxH;
					}
				} else if (hitPoint.v>minV) {
					result = hitPoint.v - minV;
				} else {
					result = minV - hitPoint.v;
				}
				break;
			case synctex_node_type_glue:
			case synctex_node_type_math:
				minH = SYNCTEX_HORIZ(node);
				minV = SYNCTEX_VERT(node);
				if (hitPoint.h<minH) {
					if (hitPoint.v>minV) {
						result = hitPoint.v - minV + minH - hitPoint.h;
					} else {
						result = minV - hitPoint.v + minH - hitPoint.h;
					}
				} else if (hitPoint.v>minV) {
					result = hitPoint.v - minV + hitPoint.h - minH;
				} else {
					result = minV - hitPoint.v + hitPoint.h - minH;
				}
				break;
		}
	}
	return result;
}

static synctex_node_t _synctex_eq_deepest_container(synctex_point_t hitPoint,synctex_node_t node, synctex_bool_t visible) {
	if (node) {
		synctex_node_t result = NULL;
		synctex_node_t child = NULL;
		switch(node->class->type) {
			case synctex_node_type_vbox:
			case synctex_node_type_hbox:
				/*  test the deep nodes first */
				if ((child = SYNCTEX_CHILD(node))) {
					do {
						if ((result = _synctex_eq_deepest_container(hitPoint,child,visible))) {
							return result;
						}
					} while((child = SYNCTEX_SIBLING(child)));
				}
				/*  is the hit point inside the box? */
				if (_synctex_point_in_box(hitPoint,node,visible)) {
					/*  for vboxes we try to use some node inside.
					 *  Walk through the list of siblings until we find the closest one.
					 *  Only consider siblings with children. */
					if ((node->class->type == synctex_node_type_vbox) && (child = SYNCTEX_CHILD(node))) {
						int bestDistance = INT_MAX;
						do {
							if (SYNCTEX_CHILD(child)) {
								int distance = _synctex_node_distance_to_point(hitPoint,child,visible);
								if (distance < bestDistance) {
									bestDistance = distance;
									node = child;
								}
							}
						} while((child = SYNCTEX_SIBLING(child)));
					}
					return node;
				}
		}
	}
	return NULL;
}

/*  Compares the locations of the hitPoint with the locations of the various nodes contained in the box.
 *  As it is an horizontal box, we only compare horizontal coordinates. */
SYNCTEX_INLINE static int __synctex_eq_get_closest_children_in_hbox(synctex_point_t hitPoint, synctex_node_t node, synctex_node_set_t*  bestNodesRef,synctex_distances_t*  bestDistancesRef, synctex_bool_t visible);
SYNCTEX_INLINE static int __synctex_eq_get_closest_children_in_hbox(synctex_point_t hitPoint, synctex_node_t node, synctex_node_set_t*  bestNodesRef,synctex_distances_t*  bestDistancesRef, synctex_bool_t visible) {
	int result = 0;
	if ((node = SYNCTEX_CHILD(node))) {
		do {
			int off7 = _synctex_point_h_distance(hitPoint,node,visible);
			if (off7 > 0) {
				/*  node is to the right of the hit point.
				 *  We compare node and the previously recorded one, through the recorded distance.
				 *  If the nodes have the same tag, prefer the one with the smallest line number,
				 *  if the nodes also have the same line number, prefer the one with the smallest column. */
				if (bestDistancesRef->right > off7) {
					bestDistancesRef->right = off7;
					bestNodesRef->right = node;
					result |= SYNCTEX_MASK_RIGHT;
				} else if (bestDistancesRef->right == off7 && bestNodesRef->right) {
					if (SYNCTEX_TAG(bestNodesRef->right) == SYNCTEX_TAG(node)
						&& (SYNCTEX_LINE(bestNodesRef->right) > SYNCTEX_LINE(node)
							|| (SYNCTEX_LINE(bestNodesRef->right) == SYNCTEX_LINE(node)
								&& SYNCTEX_COLUMN(bestNodesRef->right) > SYNCTEX_COLUMN(node)))) {
						bestNodesRef->right = node;
						result |= SYNCTEX_MASK_RIGHT;
					}
				}
			} else if (off7 == 0) {
				/*  hitPoint is inside node. */ 
				bestDistancesRef->left = bestDistancesRef->right = 0;
				bestNodesRef->left = node;
				bestNodesRef->right = NULL;
				result |= SYNCTEX_MASK_LEFT;
			} else { /*  here off7 < 0, hitPoint is to the right of node */
				off7 = -off7;
				if (bestDistancesRef->left > off7) {
					bestDistancesRef->left = off7;
					bestNodesRef->left = node;
					result |= SYNCTEX_MASK_LEFT;
				} else if (bestDistancesRef->left == off7 && bestNodesRef->left) {
					if (SYNCTEX_TAG(bestNodesRef->left) == SYNCTEX_TAG(node)
						&& (SYNCTEX_LINE(bestNodesRef->left) > SYNCTEX_LINE(node)
							|| (SYNCTEX_LINE(bestNodesRef->left) == SYNCTEX_LINE(node)
								&& SYNCTEX_COLUMN(bestNodesRef->left) > SYNCTEX_COLUMN(node)))) {
						bestNodesRef->left = node;
						result |= SYNCTEX_MASK_LEFT;
					}
				}
			}
		} while((node = SYNCTEX_SIBLING(node)));
		if (result & SYNCTEX_MASK_LEFT) {
			/*  the left node is new, try to narrow the result */
			if ((node = _synctex_eq_deepest_container(hitPoint,bestNodesRef->left,visible))) {
				bestNodesRef->left = node;
			} 
			if ((node = _synctex_eq_closest_child(hitPoint,bestNodesRef->left,visible))) {
				bestNodesRef->left = node;
			} 
		}
		if (result & SYNCTEX_MASK_RIGHT) {
			/*  the right node is new, try to narrow the result */
			if ((node = _synctex_eq_deepest_container(hitPoint,bestNodesRef->right,visible))) {
				bestNodesRef->right = node;
			} 
			if ((node = _synctex_eq_closest_child(hitPoint,bestNodesRef->right,visible))) {
				bestNodesRef->right = node;
			} 
		}
	}
	return result;
}
SYNCTEX_INLINE static int __synctex_eq_get_closest_children_in_vbox(synctex_point_t hitPoint, synctex_node_t node, synctex_node_set_t*  bestNodesRef,synctex_distances_t*  bestDistancesRef,synctex_bool_t visible);
SYNCTEX_INLINE static int __synctex_eq_get_closest_children_in_vbox(synctex_point_t hitPoint, synctex_node_t node, synctex_node_set_t*  bestNodesRef,synctex_distances_t*  bestDistancesRef,synctex_bool_t visible) {
	int result = 0;
	if ((node = SYNCTEX_CHILD(node))) {
		do {
			int off7 = _synctex_point_v_distance(hitPoint,node,visible);/*  this is what makes the difference with the h version above */
			if (off7 > 0) {
				/*  node is to the top of the hit point (below because TeX is oriented from top to bottom.
				 *  We compare node and the previously recorded one, through the recorded distance.
				 *  If the nodes have the same tag, prefer the one with the smallest line number,
				 *  if the nodes also have the same line number, prefer the one with the smallest column. */
				if (bestDistancesRef->right > off7) {
					bestDistancesRef->right = off7;
					bestNodesRef->right = node;
					result |= SYNCTEX_MASK_RIGHT;
				} else if (bestDistancesRef->right == off7 && bestNodesRef->right) {
					if (SYNCTEX_TAG(bestNodesRef->right) == SYNCTEX_TAG(node)
						&& (SYNCTEX_LINE(bestNodesRef->right) > SYNCTEX_LINE(node)
							|| (SYNCTEX_LINE(bestNodesRef->right) == SYNCTEX_LINE(node)
								&& SYNCTEX_COLUMN(bestNodesRef->right) > SYNCTEX_COLUMN(node)))) {
						bestNodesRef->right = node;
						result |= SYNCTEX_MASK_RIGHT;
					}
				}
			} else if (off7 == 0) {
				bestDistancesRef->left = bestDistancesRef->right = 0;
				bestNodesRef->left = node;
				bestNodesRef->right = NULL;
				result |= SYNCTEX_MASK_LEFT;
			} else { /*  here off7 < 0 */
				off7 = -off7;
				if (bestDistancesRef->left > off7) {
					bestDistancesRef->left = off7;
					bestNodesRef->left = node;
					result |= SYNCTEX_MASK_LEFT;
				} else if (bestDistancesRef->left == off7 && bestNodesRef->left) {
					if (SYNCTEX_TAG(bestNodesRef->left) == SYNCTEX_TAG(node)
						&& (SYNCTEX_LINE(bestNodesRef->left) > SYNCTEX_LINE(node)
							|| (SYNCTEX_LINE(bestNodesRef->left) == SYNCTEX_LINE(node)
								&& SYNCTEX_COLUMN(bestNodesRef->left) > SYNCTEX_COLUMN(node)))) {
						bestNodesRef->left = node;
						result |= SYNCTEX_MASK_LEFT;
					}
				}
			}
		} while((node = SYNCTEX_SIBLING(node)));
		if (result & SYNCTEX_MASK_LEFT) {
			/*  the left node is new, try to narrow the result */
			if ((node = _synctex_eq_deepest_container(hitPoint,bestNodesRef->left,visible))) {
				bestNodesRef->left = node;
			} 
			if ((node = _synctex_eq_closest_child(hitPoint,bestNodesRef->left,visible))) {
				bestNodesRef->left = node;
			} 
		}
		if (result & SYNCTEX_MASK_RIGHT) {
			/*  the right node is new, try to narrow the result */
			if ((node = _synctex_eq_deepest_container(hitPoint,bestNodesRef->right,visible))) {
				bestNodesRef->right = node;
			} 
			if ((node = _synctex_eq_closest_child(hitPoint,bestNodesRef->right,visible))) {
				bestNodesRef->right = node;
			} 
		}
	}
	return result;
}
SYNCTEX_INLINE static int _synctex_eq_get_closest_children_in_box(synctex_point_t hitPoint, synctex_node_t node, synctex_node_set_t*  bestNodesRef,synctex_distances_t*  bestDistancesRef,synctex_bool_t visible) {
	if (node) {
		switch(node->class->type) {
			case synctex_node_type_hbox:
				return __synctex_eq_get_closest_children_in_hbox(hitPoint, node, bestNodesRef, bestDistancesRef,visible);
			case synctex_node_type_vbox:
				return __synctex_eq_get_closest_children_in_vbox(hitPoint, node, bestNodesRef, bestDistancesRef,visible);
		}
	}
	return 0;
}

SYNCTEX_INLINE static synctex_node_t __synctex_eq_closest_child(synctex_point_t hitPoint, synctex_node_t node,int*  distanceRef, synctex_bool_t visible);
SYNCTEX_INLINE static synctex_node_t __synctex_eq_closest_child(synctex_point_t hitPoint, synctex_node_t node,int*  distanceRef, synctex_bool_t visible) {
	synctex_node_t best_node = NULL;
	if ((node = SYNCTEX_CHILD(node))) {
		do {
			int distance = _synctex_node_distance_to_point(hitPoint,node,visible);
			synctex_node_t candidate = NULL;
			if (distance<=*distanceRef) {
				*distanceRef = distance;
				best_node = node;
			}
			switch(node->class->type) {
				case synctex_node_type_vbox:
				case synctex_node_type_hbox:
					if ((candidate = __synctex_eq_closest_child(hitPoint,node,distanceRef,visible))) {
						best_node = candidate;
					}
			}
		} while((node = SYNCTEX_SIBLING(node)));
	}
	return best_node;
}
SYNCTEX_INLINE static synctex_node_t _synctex_eq_closest_child(synctex_point_t hitPoint,synctex_node_t node, synctex_bool_t visible) {
	if (node) {
		switch(node->class->type) {
			case synctex_node_type_hbox:
			case synctex_node_type_vbox:
			{
				int best_distance = INT_MAX;
				synctex_node_t best_node = __synctex_eq_closest_child(hitPoint,node,&best_distance,visible);
				if ((best_node)) {
					synctex_node_t child = NULL;
					switch(best_node->class->type) {
						case synctex_node_type_vbox:
						case synctex_node_type_hbox:
							if ((child = SYNCTEX_CHILD(best_node))) {
								best_distance = _synctex_node_distance_to_point(hitPoint,child,visible);
								while((child = SYNCTEX_SIBLING(child))) {
									int distance = _synctex_node_distance_to_point(hitPoint,child,visible);
									if (distance<=best_distance) {
										best_distance = distance;
										best_node = child;
									}
								}
							}
					}
				}
				return best_node;
			}
		}
	}
	return NULL;
}

#	ifdef SYNCTEX_NOTHING
#       pragma mark -
#       pragma mark Updater
#   endif

typedef int (*synctex_fprintf_t)(void *, const char * , ...); /*  print formatted to either FILE *  or gzFile */

#   define SYNCTEX_BITS_PER_BYTE 8

struct __synctex_updater_t {
    void *file;                 /*  the foo.synctex or foo.synctex.gz I/O identifier  */
	synctex_fprintf_t fprintf;  /*  either fprintf or gzprintf */
	int length;                 /*  the number of chars appended */
    struct _flags {
        unsigned int no_gz:1;   /*  Whether zlib is used or not */
        unsigned int reserved:SYNCTEX_BITS_PER_BYTE*sizeof(int)-1; /*  Align */
	} flags;
};
#   define SYNCTEX_FILE updater->file
#   define SYNCTEX_NO_GZ ((updater->flags).no_gz)
#   define SYNCTEX_fprintf (*(updater->fprintf))

synctex_updater_t synctex_updater_new_with_output_file(const char * output, const char * build_directory) {
	synctex_updater_t updater = NULL;
	char * synctex = NULL;
	synctex_io_mode_t io_mode = 0;
	const char * mode = NULL;
	/*  prepare the updater, the memory is the only one dynamically allocated */
	updater = (synctex_updater_t)_synctex_malloc(sizeof(synctex_updater_t));
	if (NULL == updater) {
		_synctex_error("!  synctex_updater_new_with_file: malloc problem");
		return NULL;
	}
	if (_synctex_open(output,build_directory,&synctex,&SYNCTEX_FILE,synctex_ADD_QUOTES,&io_mode)
		&& _synctex_open(output,build_directory,&synctex,&SYNCTEX_FILE,synctex_DONT_ADD_QUOTES,&io_mode)) {
return_on_error:
		free(updater);
        updater = NULL;
		return NULL;
	}
	/*  OK, the file exists, we close it and reopen it with the correct mode.
     *  The receiver is now the owner of the "synctex" variable. */
	gzclose(SYNCTEX_FILE);
	SYNCTEX_FILE = NULL;
	SYNCTEX_NO_GZ = (io_mode&synctex_io_gz_mask)?synctex_NO:synctex_YES;
    mode = _synctex_get_io_mode_name(io_mode|synctex_io_append_mask);/* either "a" or "ab", depending on the file extension */
	if (SYNCTEX_NO_GZ) {
		if (NULL == (SYNCTEX_FILE = (void *)fopen(synctex,mode))) {
no_write_error:
			_synctex_error("!  synctex_updater_new_with_file: Can't append to %s",synctex);
			free(synctex);
			goto return_on_error;
		}
		updater->fprintf = (synctex_fprintf_t)(&fprintf);
	} else {
		if (NULL == (SYNCTEX_FILE = (void *)gzopen(synctex,mode))) {
			goto no_write_error;
		}
		updater->fprintf = (synctex_fprintf_t)(&gzprintf);
	}
	printf("SyncTeX: updating %s...",synctex);
	free(synctex);
	return updater;
}


void synctex_updater_append_magnification(synctex_updater_t updater, char * magnification){
	if (NULL==updater) {
		return;
	}
	if (magnification && strlen(magnification)) {
		updater->length += SYNCTEX_fprintf(SYNCTEX_FILE,"Magnification:%s\n",magnification);
	}
}

void synctex_updater_append_x_offset(synctex_updater_t updater, char * x_offset){
	if (NULL==updater) {
		return;
	}
	if (x_offset && strlen(x_offset)) {
		updater->length += SYNCTEX_fprintf(SYNCTEX_FILE,"X Offset:%s\n",x_offset);
	}
}

void synctex_updater_append_y_offset(synctex_updater_t updater, char * y_offset){
	if (NULL==updater) {
		return;
	}
	if (y_offset && strlen(y_offset)) {
		updater->length += SYNCTEX_fprintf(SYNCTEX_FILE,"Y Offset:%s\n",y_offset);
	}
}

void synctex_updater_free(synctex_updater_t updater){
	if (NULL==updater) {
		return;
	}
	if (updater->length>0) {
		SYNCTEX_fprintf(SYNCTEX_FILE,"!%i\n",updater->length);
	}
	if (SYNCTEX_NO_GZ) {
		fclose((FILE *)SYNCTEX_FILE);
	} else {
		gzclose((gzFile)SYNCTEX_FILE);
	}
	free(updater);
	printf("... done.\n");
	return;
}
