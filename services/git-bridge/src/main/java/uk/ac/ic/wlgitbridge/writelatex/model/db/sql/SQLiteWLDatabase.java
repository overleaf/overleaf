package uk.ac.ic.wlgitbridge.writelatex.model.db.sql;

import uk.ac.ic.wlgitbridge.util.Util;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query.GetLatestVersionForProjectSQLQuery;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query.GetPathForURLInProjectSQLQuery;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.query.GetProjectNamesSQLQuery;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create.CreateIndexURLIndexStore;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create.CreateProjectsTableSQLUpdate;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.create.CreateURLIndexStoreSQLUpdate;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.delete.DeleteFilesForProjectSQLUpdate;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.insert.AddURLIndexSQLUpdate;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.update.insert.SetProjectSQLUpdate;

import java.io.File;
import java.sql.*;
import java.util.List;

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

    public void setVersionIDForProject(String projectName, int versionID) throws SQLException {
        update(new SetProjectSQLUpdate(projectName, versionID));
    }

    public void addURLIndex(String projectName, String url, String path) throws SQLException {
        update(new AddURLIndexSQLUpdate(projectName, url, path));
    }

    public void deleteFilesForProject(String projectName, String... paths) throws SQLException {
        update(new DeleteFilesForProjectSQLUpdate(projectName, paths));
    }

    public int getVersionIDForProjectName(String projectName) throws SQLException {
        return query(new GetLatestVersionForProjectSQLQuery(projectName));
    }

    public String getPathForURLInProject(String projectName, String url) throws SQLException {
        return query(new GetPathForURLInProjectSQLQuery(projectName, url));
    }

    public List<String> getProjectNames() throws SQLException {
        return query(new GetProjectNamesSQLQuery());
    }

    private void createTables() throws SQLException {
        final SQLUpdate[] createTableUpdates = {
                new CreateProjectsTableSQLUpdate(),
                new CreateURLIndexStoreSQLUpdate(),
                new CreateIndexURLIndexStore()
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
