package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.insert;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public class AddSnapshotSQLUpdate implements SQLUpdate {

    private static final String ADD_SNAPSHOT =
            "INSERT INTO `snapshots` (`project_name`, `version_id`) VALUES (?, ?);\n";

    private final String projectName;
    private final int versionID;

    public AddSnapshotSQLUpdate(String projectName, int versionID) {
        this.projectName = projectName;
        this.versionID = versionID;
    }

    @Override
    public String getSQL() {
        return ADD_SNAPSHOT;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {
        statement.setString(1, projectName);
        statement.setInt(2, versionID);
    }

}
