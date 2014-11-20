package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.insert;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public class AddFileNodeExternalSQLUpdate implements SQLUpdate {

    private static final String ADD_FILE_NODE_EXTERNAL =
            "INSERT INTO `file_node_table` (`project_name`, `file_name`, `changed`, `is_blob`, `blob`, `url`) VALUES (?, ?, ?, '0', NULL, ?);\n";

    private final String projectName;
    private final String fileName;
    private final int changed;
    private final String url;

    public AddFileNodeExternalSQLUpdate(String projectName, String fileName, int changed, String url) {
        this.projectName = projectName;
        this.fileName = fileName;
        this.changed = changed;
        this.url = url;
    }

    @Override
    public String getSQL() {
        return ADD_FILE_NODE_EXTERNAL;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {
        statement.setString(1, projectName);
        statement.setString(2, fileName);
        statement.setInt(3, changed);
        statement.setString(4, url);
    }

}
