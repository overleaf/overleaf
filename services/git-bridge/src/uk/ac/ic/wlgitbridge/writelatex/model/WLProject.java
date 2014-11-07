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
public class WLProject {

    private final String name;
    private final Map<Integer, Snapshot> snapshots;
    private final SortedSet<Integer> versions;
    private List<Snapshot> snapshotsToAdd;

    public WLProject(String name) {
        this.name = name;
        snapshots = new HashMap<Integer, Snapshot>();
        versions = new TreeSet<Integer>();
    }

    public void update() throws Throwable {
        getNew();
    }

    private boolean getNew() throws Throwable {
        SnapshotGetDocRequest getDoc = new SnapshotGetDocRequest(name);
        SnapshotGetSavedVersRequest getSavedVers = new SnapshotGetSavedVersRequest(name);

        getDoc.request();
        getSavedVers.request();

        Set<Integer> fetchedIDs = new HashSet<Integer>();
        Map<Integer, SnapshotInfo> fetchedSnapshotInfos = new HashMap<Integer, SnapshotInfo>();

        int latestVersionID = getDoc.getResult().getVersionID();
        fetchedSnapshotInfos.put(latestVersionID, new SnapshotInfo(latestVersionID));
        fetchedIDs.add(latestVersionID);

        for (SnapshotInfo snapshotInfo : getSavedVers.getResult().getSavedVers()) {
            int versionId = snapshotInfo.getVersionId();
            fetchedSnapshotInfos.put(versionId, snapshotInfo);
            fetchedIDs.add(versionId);
        }

        boolean result = false;

        List<Integer> idsToUpdate = new LinkedList<Integer>();

        boolean hasNew = false;
        for (Integer id : fetchedIDs) {
            boolean contains = versions.contains(id);
            result = result || contains;
            if (!contains) {
                idsToUpdate.add(id);
            }
        }

        versions.addAll(fetchedIDs);
        versions.add(latestVersionID);

        updateIDs(idsToUpdate, fetchedSnapshotInfos);

        return result;
    }

    private void updateIDs(List<Integer> idsToUpdate, Map<Integer, SnapshotInfo> fetchedSnapshotInfos) throws Throwable {
        System.out.println(idsToUpdate);
        List<SnapshotGetForVersionRequest> requests = new LinkedList<SnapshotGetForVersionRequest>();
        for (int id : idsToUpdate) {
            SnapshotGetForVersionRequest request = new SnapshotGetForVersionRequest(name, id);
            requests.add(request);
            request.request();
        }
        for (SnapshotGetForVersionRequest request : requests) {
            SnapshotGetForVersionResult result = request.getResult();
            SnapshotData data = result.getSnapshotData();
            Snapshot snapshot = new Snapshot(fetchedSnapshotInfos.get(request.getVersionID()), data);
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
