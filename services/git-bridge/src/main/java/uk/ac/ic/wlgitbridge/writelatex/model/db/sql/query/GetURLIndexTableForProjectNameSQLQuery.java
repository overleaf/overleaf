package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query;

import uk.ac.ic.wlgitbridge.writelatex.filestore.node.AttachmentNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLQuery;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 20/11/14.
 */
public class GetURLIndexTableForProjectNameSQLQuery implements SQLQuery<Map<String, FileNode>> {

    private static final String GET_URL_INDEXES_FOR_PROJECT_NAME =
            "SELECT `url`, `blob` FROM `url_index_store` WHERE `project_name` = ?";

    private final String projectName;

    public GetURLIndexTableForProjectNameSQLQuery(String projectName) {
        this.projectName = projectName;
    }

    @Override
    public Map<String, FileNode> processResultSet(ResultSet resultSet) throws SQLException {
        Map<String, FileNode> urlIndexTable = new HashMap<String, FileNode>();
        while (resultSet.next()) {
            String url = resultSet.getString("url");
            byte[] blob = resultSet.getBytes("blob");
            urlIndexTable.put(url, new AttachmentNode(url, blob));
        }
        return urlIndexTable;
    }

    @Override
    public String getSQL() {
        return GET_URL_INDEXES_FOR_PROJECT_NAME;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {
        statement.setString(1, projectName);
    }

}
