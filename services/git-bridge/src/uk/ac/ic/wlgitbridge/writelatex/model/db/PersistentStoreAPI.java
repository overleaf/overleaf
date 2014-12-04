package uk.ac.ic.wlgitbridge.writelatex.model.db;

import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.FileIndexStore;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.WLFileStore;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProjectStore;

import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 17/11/14.
 */
public interface PersistentStoreAPI {

    public WLProjectStore loadProjectStore();
    public WLFileStore loadFileStore();

    public void addProject(String name);
    public void addSnapshot(String projectName, int versionID);
    public void addFileNodeBlob(String projectName, String fileName, boolean changed, byte[] blob);
    public void addFileNodeExternal(String projectName, String fileName, boolean changed, String url);
    public void addURLIndex(String projectName, String url, byte[] blob);

    public List<String> getProjectNames();
    public List<Integer> getVersionIDsForProjectName(String projectName);
    public List<FileNode> getFileNodesForProjectName(String projectName, FileIndexStore fileIndexStore);
    public Map<String, FileNode> getURLIndexTableForProjectName(String projectName);

    public void deleteFileNodesForProjectName(String projectName);
    public void deleteURLIndexesForProjectName(String projectName);

}
