package uk.ac.ic.wlgitbridge.writelatex.model;

import com.google.gson.JsonElement;

import java.util.Map;

/**
 * Created by Winston on 06/11/14.
 */
public class WLDataModel implements JSONModel {

    private final Map<String, WLProject> projects;

    public WLDataModel(Map<String, WLProject> projects) {
        this.projects = projects;
    }

    @Override
    public void updateFromJSON(JsonElement json) {

    }
}
