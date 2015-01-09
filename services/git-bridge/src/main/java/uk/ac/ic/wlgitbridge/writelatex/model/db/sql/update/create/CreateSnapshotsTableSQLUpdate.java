package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public class CreateSnapshotsTableSQLUpdate implements SQLUpdate {

    private static final String CREATE_SNAPSHOTS_TABLE =
            "CREATE TABLE IF NOT EXISTS `snapshots` (\n" +
            "  `project_name` varchar(10) NOT NULL DEFAULT '',\n" +
            "  `version_id` int(11) NOT NULL,\n" +
            "  PRIMARY KEY (`project_name`,`version_id`),\n" +
            "  CONSTRAINT `snapshots_ibfk_1` FOREIGN KEY (`project_name`) REFERENCES `projects` (`name`) ON DELETE CASCADE ON UPDATE CASCADE\n" +
            ")";

    @Override
    public String getSQL() {
        return CREATE_SNAPSHOTS_TABLE;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {

    }

}
