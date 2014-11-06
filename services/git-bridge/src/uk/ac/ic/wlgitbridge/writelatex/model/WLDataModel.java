package uk.ac.ic.wlgitbridge.writelatex.model;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 06/11/14.
 */
public class WLDataModel {

    private final Map<String, WLProject> projects;

    public WLDataModel(Map<String, WLProject> projects) {
        this.projects = projects;
    }

    public void updateProjectWithName(String name) throws InterruptedException, ExecutionException, IOException {
        projects.get(name).update();
    }

}
