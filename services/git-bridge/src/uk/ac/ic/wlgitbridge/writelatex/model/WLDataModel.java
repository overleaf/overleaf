package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.writelatex.SnapshotPostException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.WLDirectoryNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.WLFileStore;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 06/11/14.
 */
public class WLDataModel {

    private final Map<String, WLProject> projects;
    private final WLFileStore fileStore;

    public WLDataModel(String rootGitDirectoryPath) {
        projects = new HashMap<String, WLProject>();
        fileStore = new WLFileStore(rootGitDirectoryPath);
    }

    public List<WritableRepositoryContents> updateProjectWithName(String name) throws FailedConnectionException, InvalidProjectException {
        return fileStore.updateForProject(getProjectWithName(name));
    }

    public WLProject getProjectWithName(String name) {
        WLProject project;
        if (projects.containsKey(name)) {
            project = projects.get(name);
        } else {
            project = new WLProject(name);
            projects.put(name, project);
        }
        return project;
    }

    public void put(String projectName, RawDirectoryContents directoryContents) throws SnapshotPostException {
        WLDirectoryNode dn = fileStore.createCandidateDirectoryNodeForProjectWithContents(getProjectWithName(projectName), directoryContents);
        System.out.println("Pushing project with name: " + projectName);
        System.out.println(dn);
        throw new SnapshotPostException() {

            @Override
            public String getMessage() {
                return "unimplemented";
            }

            @Override
            public List<String> getDescriptionLines() {
                return Arrays.asList("Not currently implemented");
            }
        };
    }

}
