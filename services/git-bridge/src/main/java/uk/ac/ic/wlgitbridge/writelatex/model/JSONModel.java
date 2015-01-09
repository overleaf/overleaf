package uk.ac.ic.wlgitbridge.writelatex.model;

import com.google.gson.JsonElement;

/**
 * Created by Winston on 06/11/14.
 */
public interface JSONModel {

    public void updateFromJSON(JsonElement json);

}
