package uk.ac.ic.wlgitbridge.writelatex.model;

import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStoreAPI;
import uk.ac.ic.wlgitbridge.writelatex.model.db.WLDatabaseSource;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by Winston on 17/11/14.
 */
public class WLProjectStore implements WLDatabaseSource {

    private final Map<String, WLProject> projects;

    public WLProjectStore() {
        projects = new HashMap<String, WLProject>();
    }

    public WLProjectStore(PersistentStoreAPI persistentStore) {
        this();
        initFromDatabase(persistentStore);
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

    public List<String> getProjectNames() {
        return new ArrayList<String>(projects.keySet());
    }

    @Override
    public void initFromDatabase(PersistentStoreAPI database) {

    }
}
