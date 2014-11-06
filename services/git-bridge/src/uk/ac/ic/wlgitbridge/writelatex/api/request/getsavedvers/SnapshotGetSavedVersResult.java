package uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Result;

import java.util.LinkedList;
import java.util.List;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetSavedVersResult extends Result {

    private List<SnapshotInfo> savedVers;

    public SnapshotGetSavedVersResult(Request request, JsonElement json) {
        super(request, json);
    }

    @Override
    public void fromJSON(JsonElement json) {
        savedVers = new Gson().fromJson(json, LinkedList.class);
    }

    public List<SnapshotInfo> getSavedVers() {
        return savedVers;
    }

}
