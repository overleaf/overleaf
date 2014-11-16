package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.store.WLFileStore;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 06/11/14.
 */
public class WLDataModel implements WriteLatexDataSource {

    private final Map<String, WLProject> projects;
    private final WLFileStore fileStore;

    public WLDataModel(String rootGitDirectoryPath) {
        projects = new HashMap<String, WLProject>();
        fileStore = new WLFileStore(rootGitDirectoryPath);
    }

    @Override
    public boolean repositoryExists(String name) throws FailedConnectionException {
        SnapshotGetDocRequest snapshotGetDocRequest = new SnapshotGetDocRequest(name);
        snapshotGetDocRequest.request();
        try {
            snapshotGetDocRequest.getResult().getVersionID();
        } catch (InvalidProjectException e) {
            return false;
        }
        return true;
    }

    @Override
    public List<WritableRepositoryContents> getWritableRepositories(String name) throws FailedConnectionException, InvalidProjectException {
        return updateProjectWithName(name);
    }

    @Override
    public void putDirectoryContentsToProjectWithName(String name, RawDirectoryContents directoryContents) throws SnapshotPostException {
        System.out.println("Pushing project with name: " + name);
        System.out.println(directoryContents.getFileContentsTable());
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

    private List<WritableRepositoryContents> updateProjectWithName(String name) throws FailedConnectionException, InvalidProjectException {
        return fileStore.updateForProject(getProjectWithName(name));
    }

    private WLProject getProjectWithName(String name) {
        WLProject project;
        if (projects.containsKey(name)) {
            project = projects.get(name);
        } else {
            project = new WLProject(name);
            projects.put(name, project);
        }
        return project;
    }

}
