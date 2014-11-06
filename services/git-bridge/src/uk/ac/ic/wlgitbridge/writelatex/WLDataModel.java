package uk.ac.ic.wlgitbridge.writelatex;

import com.google.gson.JsonElement;
import com.ning.http.client.AsyncHttpClient;
import com.ning.http.client.Realm;

import java.util.Map;

/**
 * Created by Winston on 06/11/14.
 */
public class WLDataModel implements JSONSource {

    private final Map<String, WLProject> projects;

    public WLDataModel(Map<String, WLProject> projects) {
        this.projects = projects;
    }

    @Override
    public void updateFromJSON(JsonElement json) {

    }
}
