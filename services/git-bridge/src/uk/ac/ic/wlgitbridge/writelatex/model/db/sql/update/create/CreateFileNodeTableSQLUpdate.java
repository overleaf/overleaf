package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public class CreateFileNodeTableSQLUpdate implements SQLUpdate {

    private static final String CREATE_FILE_NODE_TABLE =
            "CREATE TABLE IF NOT EXISTS `file_node_table` (\n" +
            "  `project_name` varchar(10) NOT NULL DEFAULT '',\n" +
            "  `file_name` varchar(255) NOT NULL DEFAULT '',\n" +
            "  `changed` tinyint(1) NOT NULL,\n" +
            "  `is_blob` tinyint(1) NOT NULL,\n" +
            "  `blob` blob,\n" +
            "  `url` varchar(128) DEFAULT NULL,\n" +
            "  PRIMARY KEY (`project_name`,`file_name`),\n" +
            "  CONSTRAINT `file_node_table_ibfk_1` FOREIGN KEY (`project_name`) REFERENCES `projects` (`name`) ON DELETE CASCADE ON UPDATE CASCADE\n" +
            ")";

    @Override
    public String getSQL() {
        return CREATE_FILE_NODE_TABLE;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {

    }

}
