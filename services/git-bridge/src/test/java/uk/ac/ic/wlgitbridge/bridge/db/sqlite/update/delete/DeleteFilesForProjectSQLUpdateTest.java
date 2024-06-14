package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.delete;

import static org.junit.Assert.*;

import org.junit.Test;

public class DeleteFilesForProjectSQLUpdateTest {

  @Test
  public void testGetSQL() {
    DeleteFilesForProjectSQLUpdate update =
        new DeleteFilesForProjectSQLUpdate("projname", "path1", "path2");
    assertEquals(
        "DELETE FROM `url_index_store` " + "WHERE `project_name` = ? " + "AND path IN (?, ?);\n",
        update.getSQL());
  }
}
