package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.insert;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public class AddURLIndexSQLUpdate implements SQLUpdate {

    private static final String ADD_URL_INDEX =
            "INSERT INTO `url_index_store` (`project_name`, `url`, `blob`) VALUES (?, ?, ?);\n";

    private final String projectName;
    private final String url;
    private final byte[] blob;

    public AddURLIndexSQLUpdate(String projectName, String url, byte[] blob) {
        this.projectName = projectName;
        this.url = url;
        this.blob = blob;
    }

    @Override
    public String getSQL() {
        return ADD_URL_INDEX;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {
        statement.setString(1, projectName);
        statement.setString(2, url);
        statement.setBytes(3, blob);
    }

}
