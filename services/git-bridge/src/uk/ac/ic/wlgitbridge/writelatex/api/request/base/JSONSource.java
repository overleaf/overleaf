package uk.ac.ic.wlgitbridge.writelatex.api.request.base;

import com.google.gson.JsonElement;

/**
 * Created by Winston on 06/11/14.
 */
public interface JSONSource {

    public abstract void fromJSON(JsonElement json);

}
