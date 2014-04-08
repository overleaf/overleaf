This file is part of the SyncTeX package.

The Synchronization TeXnology named SyncTeX is a new feature
of recent TeX engines designed by Jerome Laurens.
It allows to synchronize between input and output, which means to
navigate from the source document to the typeset material and vice versa.
More informations on http://itexmac2.sourceforge.net/SyncTeX.html

This package is mainly for developers, it mainly contains the following files:

synctex_parser_readme.txt
synctex_parser_version.txt
synctex_parser_utils.c
synctex_parser_utils.h
synctex_parser_local.h
synctex_parser.h
synctex_parser.c

The file you are reading contains more informations about the SyncTeX parser history.

In order to support SyncTeX in a viewer, it is sufficient to include
in the source the files synctex_parser.h and synctex_parser.c.
The synctex parser usage is described in synctex_parser.h header file.

The other files are used by tex engines or by the synctex command line utility:

ChangeLog
README.txt
am
man1
man5
synctex-common.h
synctex-convert.sh
synctex-e-mem.ch0
synctex-e-mem.ch1
synctex-e-rec.ch0
synctex-e-rec.ch1
synctex-etex.h
synctex-mem.ch0
synctex-mem.ch1
synctex-mem.ch2
synctex-pdf-rec.ch2
synctex-pdftex.h
synctex-rec.ch0
synctex-rec.ch1
synctex-rec.ch2
synctex-tex.h
synctex-xe-mem.ch2
synctex-xe-rec.ch2
synctex-xe-rec.ch3
synctex-xetex.h
synctex.c
synctex.defines
synctex.h
synctex_main.c
tests


Version:
--------
This is version 1, which refers to the synctex output file format.
The files are identified by a build number.
In order to help developers to automatically manage the version and build numbers
and download the parser only when necessary, the synctex_parser.version
is an ASCII text file just containing the current version and build numbers.

History:
--------
1.1: Thu Jul 17 09:28:13 UTC 2008
- First official version available in TeXLive 2008 DVD.
  Unfortunately, the backwards synchronization is not working properly mainly for ConTeXt users, see below.
1.2: Tue Sep  2 10:28:32 UTC 2008
- Correction for ConTeXt support in the edit query.
  The previous method was assuming that TeX boxes do not overlap,
  which is reasonable for LaTeX but not for ConTeXt.
  This assumption is no longer considered.
1.3: Fri Sep  5 09:39:57 UTC 2008
- Local variable "read" renamed to "already_read" to avoid conflicts.
- "inline" compiler directive renamed to "SYNCTEX_INLINE" for code support and maintenance
- _synctex_error cannot be inlined due to variable arguments (thanks Christiaan Hofman)
- Correction in the display query, extra boundary nodes are used for a more precise forwards synchronization
1.4: Fri Sep 12 08:12:34 UTC 2008
- For an unknown reason, the previous version was not the real 1.3 (as used in iTeXMac2 build 747).
  As a consequence, a crash was observed.
- Some typos are fixed.
1.6: Mon Nov  3 20:20:02 UTC 2008
- The bug that prevented synchronization with compressed files on windows has been fixed.
- New interface to allow system specific customization.
- Note that some APIs have changed.
1.8: Mer  8 jul 2009 11:32:38 UTC
Note that version 1.7 was delivered privately.
- bug fix: synctex was causing a memory leak in pdftex and xetex, thus some processing speed degradation
- bug fix: the synctex command line tool was broken when updating a .synctex file
- enhancement: better accuracy of the synchronization process
- enhancement: the pdf output file and the associated .synctex file no longer need to live in the same directory.
               The new -d option of the synctex command line tool manages this situation.
               This is handy when using something like tex -output-directory=DIR ...
1.9: Wed Nov  4 11:52:35 UTC 2009
- Various typo fixed
- OutputDebugString replaced by OutputDebugStringA to deliberately disable unicode preprocessing
- New conditional created because OutputDebugStringA is only available since Windows 2K professional
1.10: Sun Jan  10 10:12:32 UTC 2010 
- Bug fix in synctex_parser.c to solve a synchronization problem with amsmath's gather environment.
  Concerns the synctex tool.
1.11: Sun Jan  17 09:12:31 UTC 2010
- Bug fix in synctex_parser.c, function synctex_node_box_visible_v: 'x' replaced by 'y'.
  Only 3rd party tools are concerned.
1.12: Mon Jul 19 21:52:10 UTC 2010
- Bug fix in synctex_parser.c, function __synctex_open: the io_mode was modified even in case of a non zero return,
causing a void .synctex.gz file to be created even if it was not expected. Reported by Marek Kasik concerning a bug on evince.
1.13: Fri Mar 11 07:39:12 UTC 2011
- Bug fix in synctex_parser.c, better synchronization as suggested by Jan Sundermeyer (near line 3388).
- Stronger code design in synctex_parser_utils.c, function _synctex_get_name (really neutral behavior).
  Only 3rd party tools are concerned.
1.14: Fri Apr 15 19:10:57 UTC 2011
- taking output_directory into account
- Replaced FOPEN_WBIN_MODE by FOPEN_W_MODE when opening the text version of the .synctex file.
- Merging with LuaTeX's version of synctex.c
1.15: Fri Jun 10 14:10:17 UTC 2011
This concerns the synctex command line tool and 3rd party developers.
TeX and friends are not concerned by these changes.
- Bug fixed in _synctex_get_io_mode_name, sometimes the wrong mode was returned
- Support for LuaTeX convention of './' file prefixing
1.16: Tue Jun 14 08:23:30 UTC 2011
This concerns the synctex command line tool and 3rd party developers.
TeX and friends are not concerned by these changes.
- Better forward search (thanks Jose Alliste)
- Support for LuaTeX convention of './' file prefixing now for everyone, not only for Windows

Acknowledgments:
----------------
The author received useful remarks from the pdfTeX developers, especially Hahn The Thanh,
and significant help from XeTeX developer Jonathan Kew

Nota Bene:
----------
If you include or use a significant part of the synctex package into a software,
I would appreciate to be listed as contributor and see "SyncTeX" highlighted.

Copyright (c) 2008-2011 jerome DOT laurens AT u-bourgogne DOT fr

