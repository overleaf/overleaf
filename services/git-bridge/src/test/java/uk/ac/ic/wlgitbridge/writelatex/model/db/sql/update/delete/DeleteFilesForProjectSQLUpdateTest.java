package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.delete;

import org.junit.Test;
import static org.junit.Assert.*;

public class DeleteFilesForProjectSQLUpdateTest {

    @Test
    public void testGetSQL() {
        DeleteFilesForProjectSQLUpdate update = new DeleteFilesForProjectSQLUpdate("projname", "path1", "path2");
        assertEquals("DELETE FROM `url_index_store` WHERE `project_name` = ? AND path IN ('path1', 'path2');\n", update.getSQL());
    }

}