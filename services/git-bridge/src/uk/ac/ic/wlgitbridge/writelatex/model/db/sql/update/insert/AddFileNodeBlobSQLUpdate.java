package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.insert;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public class AddFileNodeBlobSQLUpdate implements SQLUpdate {

    private static final String ADD_FILE_NODE_BLOB =
            "INSERT INTO `file_node_table` (`project_name`, `file_name`, `changed`, `is_blob`, `blob`, `url`) VALUES (?, ?, ?, '1', ?, NULL);\n";

    private final String projectName;
    private final String fileName;
    private final int changed;
    private final byte[] blob;

    public AddFileNodeBlobSQLUpdate(String projectName, String fileName, int changed, byte[] blob) {
        this.projectName = projectName;
        this.fileName = fileName;
        this.changed = changed;
        this.blob = blob;
    }

    @Override
    public String getSQL() {
        return ADD_FILE_NODE_BLOB;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {
        statement.setString(1, projectName);
        statement.setString(2, fileName);
        statement.setInt(3, changed);
        statement.setBytes(4, blob);
    }

}
