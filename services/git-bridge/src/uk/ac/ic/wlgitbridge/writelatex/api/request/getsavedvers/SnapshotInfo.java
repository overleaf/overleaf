package uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotInfo implements JSONSource {

    private int versionId;
    private String comment;
    private WLUser user;
    private String createdAt;

    @Override
    public void fromJSON(JsonElement json) {

    }

}
