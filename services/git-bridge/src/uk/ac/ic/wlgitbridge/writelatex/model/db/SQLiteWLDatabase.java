package uk.ac.ic.wlgitbridge.writelatex.model.db;

import uk.ac.ic.wlgitbridge.writelatex.filestore.store.WLFileStore;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProjectStore;

import java.io.File;
import java.sql.*;

/**
 * Created by Winston on 17/11/14.
 */
public class SQLiteWLDatabase implements WLDatabase {

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

    private static final String addProject =
            "INSERT INTO `projects` (`name`) VALUES (?);\n";

    private final File rootGitDirectory;
    private final Connection connection;
    private PreparedStatement addProjectStatement;

    public SQLiteWLDatabase(File rootGitDirectory) throws SQLException, ClassNotFoundException {
        this.rootGitDirectory = rootGitDirectory;
        File databaseFile = new File(rootGitDirectory, "/.wlgb/wlgb.db");
        System.out.println("Loading data...");
        Class.forName("org.sqlite.JDBC");
        connection = DriverManager.getConnection("jdbc:sqlite:" + databaseFile.getAbsolutePath());
        createTables();
        prepareStatements();
        test();
    }

    private void createTables() throws SQLException {
        for (String createTableStatement : CREATE_TABLE_STATEMENTS) {
            PreparedStatement preparedStatement = connection.prepareStatement(createTableStatement);
            preparedStatement.executeUpdate();
        }
    }

    private void prepareStatements() throws SQLException {
        addProjectStatement = connection.prepareStatement(addProject);
    }

    public void addProject(String name) throws SQLException {
        addProjectStatement.setString(1, name);
        addProjectStatement.executeUpdate();
        addProjectStatement.clearParameters();
    }

    private void test() throws SQLException {
        addProject("testproj12");
        
    }

    @Override
    public WLProjectStore loadProjectStore() {
        return new WLProjectStore();
    }

    @Override
    public WLFileStore loadFileStore() {
        return new WLFileStore(rootGitDirectory);
    }

}
