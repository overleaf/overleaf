package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.writelatex.api.SnapshotDBAPI;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 06/11/14.
 */
public class WLDataModel implements SnapshotDBAPI {

    private final Map<String, WLProject> projects;

    public WLDataModel(Map<String, WLProject> projects) {
        this.projects = projects;
    }

    public WLDataModel() {
        projects = new HashMap<String, WLProject>();
    }

    private List<Snapshot> updateProjectWithName(String name) throws Throwable {
        if (!projects.containsKey(name)) {
            projects.put(name, new WLProject(name));
        }
        return projects.get(name).fetchNewSnapshots();
    }

    @Override
    public boolean repositoryExists(String name) {
        if (!projects.containsKey(name)) {
            projects.put(name, new WLProject(name));
        }
        return projects.containsKey(name);
    }

    @Override
    public List<Snapshot> getSnapshotsToAddToProject(String name) throws Throwable {
        return updateProjectWithName(name);
    }

}
