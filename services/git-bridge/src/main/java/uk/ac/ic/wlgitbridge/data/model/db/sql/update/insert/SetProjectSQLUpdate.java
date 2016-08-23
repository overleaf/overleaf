package uk.ac.ic.wlgitbridge.data.model.db.sql.update.insert;

import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public class SetProjectSQLUpdate implements SQLUpdate {

    private static final String SET_PROJECT =
            "INSERT OR REPLACE INTO `projects`(`name`, `version_id`) VALUES (?, ?);\n";

    private final String projectName;
    private final int versionID;

    public SetProjectSQLUpdate(String projectName, int versionID) {
        this.projectName = projectName;
        this.versionID = versionID;
    }

    @Override
    public String getSQL() {
        return SET_PROJECT;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {
        statement.setString(1, projectName);
        statement.setInt(2, versionID);
    }

}
