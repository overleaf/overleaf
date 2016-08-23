package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.insert;

import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;

/**
 * Created by winston on 23/08/2016.
 */
public class SetProjectLastAccessedTime implements SQLUpdate {

    private static final String SET_PROJECT_LAST_ACCESSED_TIME =
            "INSERT OR REPLACE INTO `swap_table`(\n" +
            "        `project_name`,\n" +
            "        `last_accessed`\n" +
            ") VALUES (\n" +
            "        ?,\n" +
            "        ?\n" +
            ")";

    private final String projectName;
    private final Timestamp lastAccessed;

    public SetProjectLastAccessedTime(
            String projectName,
            Timestamp lastAccessed
    ) {
        this.projectName = projectName;
        this.lastAccessed = lastAccessed;
    }

    @Override
    public String getSQL() {
        return SET_PROJECT_LAST_ACCESSED_TIME;
    }

    @Override
    public void addParametersToStatement(
            PreparedStatement statement
    ) throws SQLException {
        statement.setString(1, projectName);
        statement.setTimestamp(2, lastAccessed);
    }

}
