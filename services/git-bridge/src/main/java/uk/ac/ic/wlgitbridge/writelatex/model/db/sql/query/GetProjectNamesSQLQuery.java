package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query;

import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLQuery;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedList;
import java.util.List;

/**
 * Created by Winston on 21/02/15.
 */
public class GetProjectNamesSQLQuery implements SQLQuery<List<String>> {

    private static final String GET_URL_INDEXES_FOR_PROJECT_NAME =
            "SELECT `name` FROM `projects`";

    @Override
    public List<String> processResultSet(ResultSet resultSet) throws SQLException {
        List<String> projectNames = new LinkedList<String>();
        while (resultSet.next()) {
            projectNames.add(resultSet.getString("name"));
        }
        return projectNames;
    }

    @Override
    public String getSQL() {
        return GET_URL_INDEXES_FOR_PROJECT_NAME;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {

    }

}
