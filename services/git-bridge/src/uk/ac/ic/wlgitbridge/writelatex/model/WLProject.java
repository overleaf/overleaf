package uk.ac.ic.wlgitbridge.writelatex.model;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.sun.javafx.collections.transformation.SortedList;
import uk.ac.ic.wlgitbridge.writelatex.api.request.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.SnapshotGetForVersionRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.SnapshotGetSavedVersRequest;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 06/11/14.
 */
public class WLProject implements JSONModel {

    private final String name;
    public static final int VERSION_ID_INVALID = -1;
    private final Map<Integer, Snapshot> snapshots;
    private final SortedSet<Integer> versions;
    private int latestVersionID;

    public WLProject(String name) {
        this.name = name;
        snapshots = new HashMap<Integer, Snapshot>();
        versions = new TreeSet<Integer>();
        latestVersionID = VERSION_ID_INVALID;
    }

    @Override
    public void updateFromJSON(JsonElement json) {

    }

    public void update() throws InterruptedException, ExecutionException, IOException {
        getNew();
    }

    private boolean getNew() throws InterruptedException, ExecutionException, IOException {
        Request getDoc = new SnapshotGetDocRequest(name);
        Request getSavedVers = new SnapshotGetSavedVersRequest(name);

        getDoc.request();
        getSavedVers.request();

        List<Integer> ids = new LinkedList<Integer>();

        boolean result = false;

        ids.add(getLatestVersionID(getDoc.getResponse()));

        ids.addAll(getLatestVersionIDs(getSavedVers.getResponse()));

        List<Integer> idsToUpdate = new LinkedList<Integer>();

        boolean hasNew = false;
        for (Integer id : ids) {
            boolean contains = versions.contains(id);
            result = result || contains;
            if (!contains) {
                idsToUpdate.add(id);
            }
        }

        updateIDs(idsToUpdate);

        return result;
    }

    private void updateIDs(List<Integer> idsToUpdate) {
        List<Request> requests = new LinkedList<Request>();
        for (int id : idsToUpdate) {
            SnapshotGetForVersionRequest request = new SnapshotGetForVersionRequest(name, id);
            requests.add(request);
            request.request();
        }
        
    }

    private int getLatestVersionID(String response) {
        Gson gson = new Gson();
        JsonObject responseObject = gson.fromJson(response, JsonObject.class);
        return responseObject.get("latestVerId").getAsInt();
    }

    private Collection<? extends Integer> getLatestVersionIDs(String response) {
        List<Integer> ids = new LinkedList<Integer>();
        Gson gson = new Gson();
        JsonArray responseArray = gson.fromJson(response, JsonArray.class);
        for (JsonElement elem : responseArray) {
            ids.add(getVersionID(elem.getAsJsonObject()));
        }
        return ids;
    }

    private Integer getVersionID(JsonObject object) {
        return object.get("versionId").getAsInt();
    }

}
