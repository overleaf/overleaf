package uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;

/**
 * Created by Winston on 06/11/14.
 */
public class WLUser implements JSONSource {

    private String name;
    private String email;

    @Override
    public void fromJSON(JsonElement json) {

    }

}
