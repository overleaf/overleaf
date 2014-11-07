package uk.ac.ic.wlgitbridge.writelatex.model;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.WLUser;

/**
 * Created by Winston on 03/11/14.
 */
public class Snapshot implements JSONModel {

    private int versionID;
    private String comment;
    private WLUser user;
    private SnapshotData data;

    public Snapshot(int versionID, SnapshotData data) {
        this.comment = comment;

        this.data = data;
    }

    @Override
    public void updateFromJSON(JsonElement json) {

    }

    public void writeToDisk() {

    }

    public SnapshotData getData() {
        return data;
    }

    public String getComment() {
        return comment;
    }
}
