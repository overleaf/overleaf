package uk.ac.ic.wlgitbridge.writelatex.filestore;

import uk.ac.ic.wlgitbridge.writelatex.model.WLProject;

import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 08/11/14.
 */
public class WLFileStore {

    private final Map<String, WLDirectoryNode> fileStore;
    private final String rootGitDirectoryPath;

    public WLFileStore(String rootGitDirectoryPath) {
        fileStore = new HashMap<String, WLDirectoryNode>();
        this.rootGitDirectoryPath = rootGitDirectoryPath;
    }

    public void updateForProject(WLProject project) {
        String projectName = project.getName();
        WLDirectoryNode directoryNode = fileStore.get(projectName);
        if (directoryNode == null) {
            directoryNode = new WLDirectoryNode(rootGitDirectoryPath, projectName);
            fileStore.put(projectName, directoryNode);
        }
        directoryNode.updateFromProject(project);
    }

}
