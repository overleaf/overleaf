package uk.ac.ic.wlgitbridge.writelatex.model;

import com.google.gson.JsonElement;

import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 06/11/14.
 */
public class WLProject implements JSONModel {

    public static final int VERSION_ID_INVALID = -1;
    private final Map<Integer, Snapshot> snapshots;
    private int latestVersionID;

    public WLProject() {
        snapshots = new HashMap<Integer, Snapshot>();
        latestVersionID = VERSION_ID_INVALID;
    }

    @Override
    public void updateFromJSON(JsonElement json) {

    }

}
