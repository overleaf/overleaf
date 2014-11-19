package uk.ac.ic.wlgitbridge.writelatex.model.db;

import uk.ac.ic.wlgitbridge.writelatex.filestore.node.AttachmentNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.BlobNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;

import java.io.File;
import java.sql.*;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 17/11/14.
 */
public class SQLiteWLDatabase {

    private static final String[] CREATE_TABLE_STATEMENTS = {
            "CREATE TABLE IF NOT EXISTS `projects` (\n" +
            "  `name` varchar(10) NOT NULL DEFAULT '',\n" +
            "  PRIMARY KEY (`name`)\n" +
            ")",
            "CREATE TABLE IF NOT EXISTS `snapshots` (\n" +
            "  `project_name` varchar(10) NOT NULL DEFAULT '',\n" +
            "  `version_id` int(11) NOT NULL,\n" +
            "  PRIMARY KEY (`project_name`,`version_id`),\n" +
            "  CONSTRAINT `snapshots_ibfk_1` FOREIGN KEY (`project_name`) REFERENCES `projects` (`name`) ON DELETE CASCADE ON UPDATE CASCADE\n" +
            ")",
            "CREATE TABLE IF NOT EXISTS `file_node_table` (\n" +
            "  `project_name` varchar(10) NOT NULL DEFAULT '',\n" +
            "  `file_name` varchar(255) NOT NULL DEFAULT '',\n" +
            "  `changed` tinyint(1) NOT NULL,\n" +
            "  `is_blob` tinyint(1) NOT NULL,\n" +
            "  `blob` blob,\n" +
            "  `url` varchar(128) DEFAULT NULL,\n" +
            "  PRIMARY KEY (`project_name`,`file_name`),\n" +
            "  CONSTRAINT `file_node_table_ibfk_1` FOREIGN KEY (`project_name`) REFERENCES `projects` (`name`) ON DELETE CASCADE ON UPDATE CASCADE\n" +
            ")",
            "CREATE TABLE IF NOT EXISTS `url_index_store` (\n"+
            "  `project_name` varchar(10) NOT NULL DEFAULT '',\n"+
            "  `url` varchar(128) NOT NULL,\n"+
            "  `blob` blob NOT NULL,\n"+
            "  PRIMARY KEY (`project_name`,`url`),\n"+
            "  CONSTRAINT `url_index_store_ibfk_1` FOREIGN KEY (`project_name`) REFERENCES `projects` (`name`) ON DELETE CASCADE ON UPDATE CASCADE\n"+
            ")"
    };

    private static final String ADD_PROJECT =
            "INSERT INTO `projects` (`name`) VALUES (?);\n";
    private static final String ADD_SNAPSHOT =
            "INSERT INTO `snapshots` (`project_name`, `version_id`) VALUES (?, ?);\n";
    private static final String ADD_FILE_NODE_BLOB =
            "INSERT INTO `file_node_table` (`project_name`, `file_name`, `changed`, `is_blob`, `blob`, `url`) VALUES (?, ?, ?, '1', ?, NULL);\n";
    private static final String ADD_FILE_NODE_EXTERNAL =
            "INSERT INTO `file_node_table` (`project_name`, `file_name`, `changed`, `is_blob`, `blob`, `url`) VALUES (?, ?, ?, '0', NULL, ?);\n";
    private static final String ADD_URL_INDEX =
            "INSERT INTO `url_index_store` (`project_name`, `url`, `blob`) VALUES (?, ?, ?);\n";

    private static final String GET_PROJECT_NAMES =
            "SELECT * FROM `projects`;\n";
    private static final String GET_VERSION_IDS_FOR_PROJECT_NAME =
            "SELECT `version_id` FROM `snapshots` WHERE `project_name` = ?";
    private static final String GET_FILE_NODES_FOR_PROJECT_NAME =
            "SELECT `file_name`, `changed`, `is_blob`, `blob`, `url` FROM `file_node_table` WHERE `project_name` = ?";
    private static final String GET_URL_INDEXES_FOR_PROJECT_NAME =
            "SELECT `url`, `blob` FROM `url_index_store` WHERE `project_name` = ?";

    private static final String DELETE_FILE_NODES_FOR_PROJECT_NAME =
            "DELETE FROM `file_node_table` WHERE `project_name` = ?";
    private static final String DELETE_URL_INDEXES_FOR_PROJECT_NAME =
            "DELETE FROM `url_index_store` WHERE `project_name` = ?";

    private final File rootGitDirectory;
    private final Connection connection;

    private PreparedStatement addProjectStatement;
    private PreparedStatement addSnapshotStatement;
    private PreparedStatement addFileNodeBlobStatement;
    private PreparedStatement addFileNodeExternalStatement;
    private PreparedStatement addURLIndexStatement;

    private PreparedStatement getProjectNamesStatement;
    private PreparedStatement getVersionIDsForProjectNameStatement;
    private PreparedStatement getFileNodesForProjectNameStatement;
    private PreparedStatement getURLIndexesForProjectNameStatement;

    private PreparedStatement deleteFileNodesForProjectNameStatement;
    private PreparedStatement deleteURLIndexesForProjectNameStatement;

    public SQLiteWLDatabase(File rootGitDirectory) throws SQLException, ClassNotFoundException {
        this.rootGitDirectory = rootGitDirectory;
        File databaseFile = new File(rootGitDirectory, "/.wlgb/wlgb.db");
        System.out.println("Loading data...");
        Class.forName("org.sqlite.JDBC");
        connection = DriverManager.getConnection("jdbc:sqlite:" + databaseFile.getAbsolutePath());
        createTables();
        prepareStatements();
    }

    private void createTables() throws SQLException {
        for (String createTableStatement : CREATE_TABLE_STATEMENTS) {
            PreparedStatement preparedStatement = connection.prepareStatement(createTableStatement);
            preparedStatement.executeUpdate();
        }
    }

    private void prepareStatements() throws SQLException {
        addProjectStatement = connection.prepareStatement(ADD_PROJECT);
        addSnapshotStatement = connection.prepareStatement(ADD_SNAPSHOT);
        addFileNodeBlobStatement = connection.prepareStatement(ADD_FILE_NODE_BLOB);
        addFileNodeExternalStatement = connection.prepareStatement(ADD_FILE_NODE_EXTERNAL);
        addURLIndexStatement = connection.prepareStatement(ADD_URL_INDEX);

        getProjectNamesStatement = connection.prepareStatement(GET_PROJECT_NAMES);
        getVersionIDsForProjectNameStatement = connection.prepareStatement(GET_VERSION_IDS_FOR_PROJECT_NAME);
        getFileNodesForProjectNameStatement = connection.prepareStatement(GET_FILE_NODES_FOR_PROJECT_NAME);
        getURLIndexesForProjectNameStatement = connection.prepareStatement(GET_URL_INDEXES_FOR_PROJECT_NAME);

        deleteFileNodesForProjectNameStatement = connection.prepareStatement(DELETE_FILE_NODES_FOR_PROJECT_NAME);
        deleteURLIndexesForProjectNameStatement = connection.prepareStatement(DELETE_URL_INDEXES_FOR_PROJECT_NAME);
    }

    public void addProject(String name) throws SQLException {
        addProjectStatement.clearParameters();
        addProjectStatement.setString(1, name);
        addProjectStatement.executeUpdate();
    }

    public void addSnapshot(String projectName, int versionID) throws SQLException {
        addSnapshotStatement.clearParameters();
        addSnapshotStatement.setString(1, projectName);
        addSnapshotStatement.setInt(2, versionID);
        addSnapshotStatement.executeUpdate();
    }

    public void addFileNodeBlob(String projectName, String fileName, int changed, byte[] blob) throws SQLException {
        addFileNodeBlobStatement.clearParameters();
        addFileNodeBlobStatement.setString(1, projectName);
        addFileNodeBlobStatement.setString(2, fileName);
        addFileNodeBlobStatement.setInt(3, changed);
        addFileNodeBlobStatement.setBytes(4, blob);
        addFileNodeBlobStatement.executeUpdate();
    }

    public void addFileNodeExternal(String projectName, String fileName, int changed, String url) throws SQLException {
        addFileNodeExternalStatement.clearParameters();
        addFileNodeExternalStatement.setString(1, projectName);
        addFileNodeExternalStatement.setString(2, fileName);
        addFileNodeExternalStatement.setInt(3, changed);
        addFileNodeExternalStatement.setString(4, url);
        addFileNodeExternalStatement.executeUpdate();
    }

    public void addURLIndex(String projectName, String url, byte[] blob) throws SQLException {
        addURLIndexStatement.clearParameters();
        addURLIndexStatement.setString(1, projectName);
        addURLIndexStatement.setString(2, url);
        addURLIndexStatement.setBytes(3, blob);
        addURLIndexStatement.executeUpdate();
    }

    public List<String> getProjectNames() throws SQLException {
        List<String> projectNames = new LinkedList<String>();
        ResultSet results = getProjectNamesStatement.executeQuery();
        while (results.next()) {
            projectNames.add(results.getString("name"));
        }
        return projectNames;
    }

    public List<Integer> getVersionIDsForProjectName(String projectName) throws SQLException {
        List<Integer> versionIDs = new LinkedList<Integer>();
        getVersionIDsForProjectNameStatement.clearParameters();
        getVersionIDsForProjectNameStatement.setString(1, projectName);
        ResultSet results = getVersionIDsForProjectNameStatement.executeQuery();
        while (results.next()) {
            versionIDs.add(results.getInt("version_id"));
        }
        return versionIDs;
    }

    public List<FileNode> getFileNodesForProjectName(String projectName) throws SQLException {
        List<FileNode> fileNodes = new LinkedList<FileNode>();
        getFileNodesForProjectNameStatement.clearParameters();
        getFileNodesForProjectNameStatement.setString(1, projectName);
        ResultSet results = getFileNodesForProjectNameStatement.executeQuery();
        while (results.next()) {
            boolean isBlob = intToBoolean(results.getInt("is_blob"));
            FileNode fileNode;
            String fileName = results.getString("file_name");
            boolean changed = intToBoolean(results.getInt("changed"));
            if (isBlob) {
                fileNode = new BlobNode(fileName, changed, results.getBytes("blob"));
            } else {
                fileNode = new AttachmentNode(fileName, changed, results.getString("url"));
            }
            fileNodes.add(fileNode);
        }
        return fileNodes;
    }

    public Map<String, FileNode> getURLIndexTableForProjectName(String projectName) throws SQLException {
        Map<String, FileNode> urlIndexTable = new HashMap<String, FileNode>();
        getURLIndexesForProjectNameStatement.clearParameters();
        getURLIndexesForProjectNameStatement.setString(1, projectName);
        ResultSet results = getURLIndexesForProjectNameStatement.executeQuery();
        while (results.next()) {
            String url = results.getString("url");
            byte[] blob = results.getBytes("blob");
            urlIndexTable.put(url, new AttachmentNode(url, blob));
        }
        return urlIndexTable;
    }

    public void deleteFileNodesForProjectName(String projectName) throws SQLException {
        deleteFileNodesForProjectNameStatement.clearParameters();
        deleteFileNodesForProjectNameStatement.setString(1, projectName);
        deleteFileNodesForProjectNameStatement.executeUpdate();
    }

    public void deleteURLIndexesForProjectName(String projectName) throws SQLException {
        deleteURLIndexesForProjectNameStatement.clearParameters();
        deleteURLIndexesForProjectNameStatement.setString(1, projectName);
        deleteURLIndexesForProjectNameStatement.executeUpdate();
    }

    private void test() throws SQLException {
        addProject("testproj12");
        addSnapshot("testproj12", 0);
        addSnapshot("testproj12", 1);
        addFileNodeBlob("testproj12", "filename.tex", 1, "hello".getBytes());
        addFileNodeExternal("testproj12", "urlname.jpg", 1, "http://someurl.com/urlname.jpg");
        addURLIndex("testproj12", "http://someurl.com/urlname.jpg", "thebytes".getBytes());
    }

    public static int booleanToInt(boolean b) {
        if (b) {
            return 1;
        } else {
            return 0;
        }
    }

    public static boolean intToBoolean(int i) {
        return i != 0;
    }

}
