package uk.ac.ic.wlgitbridge.writelatex.model.db;

import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.WLFileStore;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProjectStore;

import java.io.File;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 19/11/14.
 */
public class WLGBPersistentStore implements PersistentStoreAPI {

    private final File rootGitDirectory;
    private final SQLiteWLDatabase database;

    public WLGBPersistentStore(File rootGitDirectory) {
        this.rootGitDirectory = rootGitDirectory;
        try {
            database = new SQLiteWLDatabase(rootGitDirectory);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        } catch (ClassNotFoundException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public WLProjectStore loadProjectStore() {
        return new WLProjectStore(this);
    }

    @Override
    public WLFileStore loadFileStore() {
        return new WLFileStore(rootGitDirectory, this);
    }

    @Override
    public void addProject(String name) {
        try {
            database.addProject(name);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void addSnapshot(String projectName, int versionID) {
        try {
            database.addSnapshot(projectName, versionID);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void addFileNodeBlob(String projectName, String fileName, int changed, byte[] blob) {
        try {
            database.addFileNodeBlob(projectName, fileName, changed, blob);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void addFileNodeExternal(String projectName, String fileName, int changed, String url) {
        try {
            database.addFileNodeExternal(projectName, fileName, changed, url);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void addURLIndex(String projectName, String url, byte[] blob) {
        try {
            database.addURLIndex(projectName, url, blob);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public List<String> getProjectNames() {
        try {
            return database.getProjectNames();
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public List<Integer> getVersionIDsForProjectName(String projectName) {
        try {
            return database.getVersionIDsForProjectName(projectName);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public List<FileNode> getFileNodesForProjectName(String projectName) {
        try {
            return database.getFileNodesForProjectName(projectName);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public Map<String, FileNode> getURLIndexTableForProjectName(String projectName) {
        try {
            return database.getURLIndexTableForProjectName(projectName);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

}
