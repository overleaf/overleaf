package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreAPI;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreSource;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 17/11/14.
 */
public class WLProjectStore implements PersistentStoreSource {

    private PersistentStoreAPI persistentStore;
    private final Map<String, WLProject> projects;

    public WLProjectStore() {
        projects = new HashMap<String, WLProject>();
    }

    public WLProjectStore(PersistentStoreAPI persistentStore) {
        this();
        initFromPersistentStore(persistentStore);
    }

    public WLProject getProjectWithName(String name) {
        WLProject project;
        if (projects.containsKey(name)) {
            project = projects.get(name);
        } else {
            project = new WLProject(name, persistentStore);
            projects.put(name, project);
            persistentStore.addProject(name);
        }
        return project;
    }

    public List<String> getProjectNames() {
        return new ArrayList<String>(projects.keySet());
    }

    @Override
    public void initFromPersistentStore(PersistentStoreAPI persistentStore) {
        this.persistentStore = persistentStore;
        for (String projectName : persistentStore.getProjectNames()) {
            projects.put(projectName, new WLProject(projectName, persistentStore));
        }
    }

}
