package uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query;

import uk.ac.ic.wlgitbridge.util.Util;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.AttachmentNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.BlobNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLQuery;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedList;
import java.util.List;

/**
 * Created by Winston on 20/11/14.
 */
public class GetFileNodesForProjectNameSQLQuery implements SQLQuery<List<FileNode>> {

    private static final String GET_FILE_NODES_FOR_PROJECT_NAME =
            "SELECT `file_name`, `changed`, `is_blob`, `blob`, `url` FROM `file_node_table` WHERE `project_name` = ?";

    private final String projectName;

    public GetFileNodesForProjectNameSQLQuery(String projectName) {
        this.projectName = projectName;
    }

    @Override
    public List<FileNode> processResultSet(ResultSet resultSet) throws SQLException {
        List<FileNode> fileNodes = new LinkedList<FileNode>();
        while (resultSet.next()) {
            boolean isBlob = Util.intToBoolean(resultSet.getInt("is_blob"));
            FileNode fileNode;
            String fileName = resultSet.getString("file_name");
            boolean changed = Util.intToBoolean(resultSet.getInt("changed"));
            if (isBlob) {
                fileNode = new BlobNode(fileName, changed, resultSet.getBytes("blob"));
            } else {
                fileNode = new AttachmentNode(fileName, changed, resultSet.getString("url"));
            }
            fileNodes.add(fileNode);
        }
        return fileNodes;
    }

    @Override
    public String getSQL() {
        return GET_FILE_NODES_FOR_PROJECT_NAME;
    }

    @Override
    public void addParametersToStatement(PreparedStatement statement) throws SQLException {
        statement.setString(1, projectName);
    }

}
