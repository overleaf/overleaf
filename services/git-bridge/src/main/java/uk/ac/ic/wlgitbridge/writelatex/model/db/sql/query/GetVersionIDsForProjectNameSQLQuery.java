package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLQuery;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedList;
import java.util.List;

/**
 * Created by Winston on 20/11/14.
 */
public class GetVersionIDsForProjectNameSQLQuery implements SQLQuery<List<Integer>> {

    private static final String GET_VERSION_IDS_FOR_PROJECT_NAME =
            "SELECT `version_id` FROM `snapshots` WHERE `project_name` = ?";

    private final String projectName;

    public GetVersionIDsForProjectNameSQLQuery(String projectName) {
        this.projectName = projectName;
    }

    @Override
    public List<Integer> processResultSet(ResultSet resultSet) throws SQLException {
        List<Integer> versionIDs = new LinkedList<Integer>();
        while (resultSet.next()) {
            versionIDs.add(resultSet.getInt("version_id"));
        }
        return versionIDs;
    }

    @Override
    public String getSQL() {
        return GET_VERSION_IDS_FOR_PROJECT_NAME;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {
        statement.setString(1, projectName);
    }
}
