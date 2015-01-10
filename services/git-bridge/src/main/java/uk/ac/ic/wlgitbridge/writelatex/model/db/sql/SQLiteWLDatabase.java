package uk.ac.ic.wlgitbridge.writelatex.model.db.sql;

import uk.ac.ic.wlgitbridge.util.Util;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.FileIndexStore;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query.GetFileNodesForProjectNameSQLQuery;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query.GetProjectNamesSQLQuery;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query.GetURLIndexTableForProjectNameSQLQuery;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query.GetVersionIDsForProjectNameSQLQuery;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create.CreateFileNodeTableSQLUpdate;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create.CreateProjectsTableSQLUpdate;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create.CreateSnapshotsTableSQLUpdate;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create.CreateURLIndexStoreSQLUpdate;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.delete.DeleteFileNodesForProjectNameSQLUpdate;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.delete.DeleteURLIndexesForProjectNameSQLUpdate;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.insert.*;

import java.io.File;
import java.sql.*;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 17/11/14.
 */
public class SQLiteWLDatabase {

    private final Connection connection;

    public SQLiteWLDatabase(File rootGitDirectory) throws SQLException, ClassNotFoundException {
        File databaseFile = new File(rootGitDirectory, "/.wlgb/wlgb.db");
        databaseFile.getParentFile().mkdirs();
        Util.sout("Loading data...");
        Class.forName("org.sqlite.JDBC");
        connection = DriverManager.getConnection("jdbc:sqlite:" + databaseFile.getAbsolutePath());
        createTables();
    }

    public void addProject(String projectName) throws SQLException {
        update(new AddProjectSQLUpdate(projectName));
    }

    public void addSnapshot(String projectName, int versionID) throws SQLException {
        update(new AddSnapshotSQLUpdate(projectName, versionID));
    }

    public void addFileNodeBlob(String projectName, String fileName, int changed, byte[] blob) throws SQLException {
        update(new AddFileNodeBlobSQLUpdate(projectName, fileName, changed, blob));
    }

    public void addFileNodeExternal(String projectName, String fileName, int changed, String url) throws SQLException {
        update(new AddFileNodeExternalSQLUpdate(projectName, fileName, changed, url));
    }

    public void addURLIndex(String projectName, String url, byte[] blob) throws SQLException {
        update(new AddURLIndexSQLUpdate(projectName, url, blob));

    }

    public List<String> getProjectNames() throws SQLException {
        return query(new GetProjectNamesSQLQuery());
    }

    public List<Integer> getVersionIDsForProjectName(String projectName) throws SQLException {
        return query(new GetVersionIDsForProjectNameSQLQuery(projectName));
    }

    public List<FileNode> getFileNodesForProjectName(String projectName, FileIndexStore fileIndexStore) throws SQLException {
        return query(new GetFileNodesForProjectNameSQLQuery(projectName, fileIndexStore));
    }

    public Map<String, FileNode> getURLIndexTableForProjectName(String projectName) throws SQLException {
        return query(new GetURLIndexTableForProjectNameSQLQuery(projectName));
    }

    public void deleteFileNodesForProjectName(String projectName) throws SQLException {
        update(new DeleteFileNodesForProjectNameSQLUpdate(projectName));
    }

    public void deleteURLIndexesForProjectName(String projectName) throws SQLException {
        update(new DeleteURLIndexesForProjectNameSQLUpdate(projectName));
    }

    private void createTables() throws SQLException {
        final SQLUpdate[] createTableUpdates = {
                new CreateProjectsTableSQLUpdate(),
                new CreateSnapshotsTableSQLUpdate(),
                new CreateFileNodeTableSQLUpdate(),
                new CreateURLIndexStoreSQLUpdate()
        };

        for (SQLUpdate update : createTableUpdates) {
            update(update);
        }
    }

    private void update(SQLUpdate update) throws SQLException {
        PreparedStatement statement = null;
        try {
            statement = connection.prepareStatement(update.getSQL());
            update.addParametersToStatement(statement);
            statement.executeUpdate();
        } catch (SQLException e) {
            throw e;
        } finally {
            statement.close();
        }
    }

    private <T> T query(SQLQuery<T> query) throws SQLException {
        PreparedStatement statement = null;
        ResultSet results = null;
        try {
            statement = connection.prepareStatement(query.getSQL());
            query.addParametersToStatement(statement);
            results = statement.executeQuery();
            return query.processResultSet(results);
        } catch (SQLException e) {
            throw e;
        } finally {
            if (statement != null) {
                statement.close();
            }
            if (results != null) {
                results.close();
            }
        }
    }

}
