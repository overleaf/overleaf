package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.insert;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLUpdate;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public class AddProjectSQLUpdate implements SQLUpdate {

    private static final String ADD_PROJECT =
            "INSERT INTO `projects` (`name`) VALUES (?);\n";

    private final String projectName;

    public AddProjectSQLUpdate(String projectName) {
        this.projectName = projectName;
    }

    @Override
    public String getSQL() {
        return ADD_PROJECT;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {
        statement.setString(1, projectName);
    }

}
