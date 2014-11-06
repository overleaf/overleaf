package uk.ac.ic.wlgitbridge.writelatex;

import com.google.gson.JsonElement;

/**
 * Created by Winston on 06/11/14.
 */
public interface JSONSource {

    public void updateFromJSON(JsonElement json);

}
