#include <stdlib.h>
#include <stdio.h>
#include <errno.h>
#include <string.h>

#include "synctex/synctex_parser.h"


void print_usage() {
  fprintf (stderr, "Usage: synctex code <synctex_file> <filename> <line> <column>\n");
  fprintf (stderr, "       synctex pdf  <synctex_file> <page> <h> <v>\n");
}

int main(int argc, char *argv[], char *envp[]) {
  synctex_scanner_t scanner;

  if (argc < 6 || (strcmp(argv[1], "code") != 0 && strcmp(argv[1], "pdf") != 0))  {
    print_usage();
    return EXIT_FAILURE;
  }

  const char* direction = argv[1];
  const char* synctex_file = argv[2];

  scanner = synctex_scanner_new_with_output_file(synctex_file, NULL, 1);

  if(!(scanner = synctex_scanner_parse(scanner))) {
    fprintf (stderr, "Could not parse output file\n");
    return EXIT_FAILURE;
  }

  if (strcmp(direction, "code") == 0) {
    const char* name = argv[3];
    int line = atoi(argv[4]);
    int column = atoi(argv[5]);

    if(synctex_display_query(scanner, name, line, column) > 0) {
      synctex_node_t node;
      while((node = synctex_next_result(scanner))) {
        int page     = synctex_node_page(node);
        float h      = synctex_node_box_visible_h(node);
        float v      = synctex_node_box_visible_v(node);
        float width  = synctex_node_box_visible_width(node);
        float height = synctex_node_box_visible_height(node);
        printf ("NODE\t%d\t%.2f\t%.2f\t%.2f\t%.2f\n", page, h, v, width, height);
      }
    }
  } else if (strcmp(direction, "pdf") == 0) {
    int page = atoi(argv[3]);
    float h = atof(argv[4]);
    float v = atof(argv[5]);

    if(synctex_edit_query(scanner, page, h, v) > 0) {
      synctex_node_t node;
      while((node = synctex_next_result(scanner))) {
        int tag          = synctex_node_tag(node);
        const char* name = synctex_scanner_get_name(scanner, tag);
        int line         = synctex_node_line(node);
        int column       = synctex_node_column(node);
        printf ("NODE\t%s\t%d\t%d\n", name, line, column);
      }
    }
  }

  return 0;
}