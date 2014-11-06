package uk.ac.ic.wlgitbridge.writelatex.model;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotGetForVersionRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.SnapshotGetSavedVersRequest;

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

//        ids.add(getLatestVersionID(getDoc.getResult()));

//        ids.addAll(getLatestVersionIDs(getSavedVers.getResult()));

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

}
