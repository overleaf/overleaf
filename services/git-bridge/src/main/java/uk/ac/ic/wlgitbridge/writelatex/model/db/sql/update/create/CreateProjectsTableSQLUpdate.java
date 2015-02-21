package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public class CreateProjectsTableSQLUpdate implements SQLUpdate {

    private static final String CREATE_PROJECTS_TABLE =
            "CREATE TABLE IF NOT EXISTS `projects` (\n" +
            "  `name` varchar(10) NOT NULL DEFAULT '',\n" +
            "  `version_id` int(11) NOT NULL DEFAULT 0,\n" +
            "  PRIMARY KEY (`name`)\n" +
            ")";
    @Override
    public String getSQL() {
        return CREATE_PROJECTS_TABLE;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {

    }

}
