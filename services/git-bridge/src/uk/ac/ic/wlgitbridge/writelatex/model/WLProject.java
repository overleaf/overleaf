package uk.ac.ic.wlgitbridge.writelatex.model;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocResult;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotGetForVersionRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotGetForVersionResult;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.SnapshotGetSavedVersRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.SnapshotInfo;

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
    private List<Snapshot> snapshotsToAdd;
    private SortedSet<Integer> idsToUpdate;
    private HashMap<Integer, SnapshotInfo> msg;

    public WLProject(String name) {
        this.name = name;
        snapshots = new HashMap<Integer, Snapshot>();
        versions = new TreeSet<Integer>();
        latestVersionID = VERSION_ID_INVALID;
    }

    @Override
    public void updateFromJSON(JsonElement json) {

    }

    public void update() throws Throwable {
        getNew();
    }

    private boolean getNew() throws Throwable {
        SnapshotGetDocRequest getDoc = new SnapshotGetDocRequest(name);
        SnapshotGetSavedVersRequest getSavedVers = new SnapshotGetSavedVersRequest(name);

        getDoc.request();
        getSavedVers.request();

        List<Integer> fetchedIDs = new LinkedList<Integer>();
        fetchedIDs.add(getDoc.getResult().getVersionID());

        for (SnapshotInfo snapshotInfo : getSavedVers.getResult().getSavedVers()) {
            msg = new HashMap<Integer, SnapshotInfo>();
            msg.put(snapshotInfo.getVersionId(), snapshotInfo);
            fetchedIDs.add(snapshotInfo.getVersionId());
        }

        boolean result = false;

//        ids.add(getLatestVersionID(getDoc.getResult()));

//        ids.addAll(getLatestVersionIDs(getSavedVers.getResult()));

        idsToUpdate = new TreeSet<Integer>();

        boolean hasNew = false;
        for (Integer id : fetchedIDs) {
            boolean contains = versions.contains(id);
            result = result || contains;
            if (!contains) {
                idsToUpdate.add(id);
            }
        }

        updateIDs(idsToUpdate);

        return result;
    }

    private void updateIDs(SortedSet<Integer> idsToUpdate) throws Throwable {
        List<SnapshotGetForVersionRequest> requests = new LinkedList<SnapshotGetForVersionRequest>();
        for (int id : idsToUpdate) {
            SnapshotGetForVersionRequest request = new SnapshotGetForVersionRequest(name, id);
            requests.add(request);
            request.request();
        }
        for (SnapshotGetForVersionRequest request : requests) {
            SnapshotGetForVersionResult result = request.getResult();
            SnapshotData data = result.getSnapshotData();
            Snapshot snapshot = new Snapshot(request.getVersionID(), data);
            snapshots.put(request.getVersionID(), snapshot);
        }
        snapshotsToAdd = new LinkedList<Snapshot>();
        for (int id : idsToUpdate) {
            snapshotsToAdd.add(snapshots.get(id));
        }
    }

    public List<Snapshot> getSnapshotsToAdd() {
        return snapshotsToAdd;
    }

}
