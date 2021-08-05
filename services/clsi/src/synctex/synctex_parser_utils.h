/* 
Copyright (c) 2008, 2009, 2010, 2011 jerome DOT laurens AT u-bourgogne DOT fr

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

*/

/*  The utilities declared here are subject to conditional implementation.
 *  All the operating system special stuff goes here.
 *  The problem mainly comes from file name management: path separator, encoding...
 */

#	define synctex_bool_t int
#	define synctex_YES -1
#	define synctex_ADD_QUOTES -1
#	define synctex_COMPRESS -1
#	define synctex_NO 0
#	define synctex_DONT_ADD_QUOTES 0
#	define synctex_DONT_COMPRESS 0

#ifndef __SYNCTEX_PARSER_UTILS__
#   define __SYNCTEX_PARSER_UTILS__

#include <stdlib.h>

#ifdef __cplusplus
extern "C" {
#endif

#	if _WIN32
#		define SYNCTEX_IS_PATH_SEPARATOR(c) ('/' == c || '\\' == c)
#	else
#		define SYNCTEX_IS_PATH_SEPARATOR(c) ('/' == c)
#	endif
    
#	if _WIN32
#		define SYNCTEX_IS_DOT(c) ('.' == c)
#	else
#		define SYNCTEX_IS_DOT(c) ('.' == c)
#	endif
    
/*  This custom malloc functions initializes to 0 the newly allocated memory.
 *  There is no bzero function on windows. */
void *_synctex_malloc(size_t size);

/*  This is used to log some informational message to the standard error stream.
 *  On Windows, the stderr stream is not exposed and another method is used.
 *	The return value is the number of characters printed.	*/
int _synctex_error(const char * reason,...);

/*  strip the last extension of the given string, this string is modified!
 *  This function depends on the OS because the path separator may differ.
 *  This should be discussed more precisely. */
void _synctex_strip_last_path_extension(char * string);

/*  Compare two file names, windows is sometimes case insensitive...
 *  The given strings may differ stricto sensu, but represent the same file name.
 *  It might not be the real way of doing things.
 *  The return value is an undefined non 0 value when the two file names are equivalent.
 *  It is 0 otherwise. */
synctex_bool_t _synctex_is_equivalent_file_name(const char *lhs, const char *rhs);

/*	Description forthcoming.*/
synctex_bool_t _synctex_path_is_absolute(const char * name);

/*	Description forthcoming...*/
const char * _synctex_last_path_component(const char * name);

/*	If the core of the last path component of src is not already enclosed with double quotes ('"')
 *  and contains a space character (' '), then a new buffer is created, the src is copied and quotes are added.
 *	In all other cases, no destination buffer is created and the src is not copied.
 *  0 on success, which means no error, something non 0 means error, mainly due to memory allocation failure, or bad parameter.
 *  This is used to fix a bug in the first version of pdftex with synctex (1.40.9) for which names with spaces
 *  were not managed in a standard way.
 *  On success, the caller owns the buffer pointed to by dest_ref (is any) and
 *  is responsible of freeing the memory when done.
 *	The size argument is the size of the src buffer. On return the dest_ref points to a buffer sized size+2.*/
int _synctex_copy_with_quoting_last_path_component(const char * src, char ** dest_ref, size_t size);

/*  These are the possible extensions of the synctex file */
extern const char * synctex_suffix;
extern const char * synctex_suffix_gz;

typedef unsigned int synctex_io_mode_t;

typedef enum {
	synctex_io_append_mask = 1,
    synctex_io_gz_mask = synctex_io_append_mask<<1
} synctex_io_mode_masks_t;

typedef enum {
	synctex_compress_mode_none = 0,
	synctex_compress_mode_gz = 1
} synctex_compress_mode_t;

int _synctex_get_name(const char * output, const char * build_directory, char ** synctex_name_ref, synctex_io_mode_t * io_mode_ref);

/*  returns the correct mode required by fopen and gzopen from the given io_mode */
const char * _synctex_get_io_mode_name(synctex_io_mode_t io_mode);

const char * synctex_ignore_leading_dot_slash(const char * name);
    
#ifdef __cplusplus
}
#endif

#endif
