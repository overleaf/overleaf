package uk.ac.ic.wlgitbridge.data;

import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.SnapshotGetDocResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotGetForVersionRequest;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.SnapshotGetSavedVersRequest;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.SnapshotInfo;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.data.model.Snapshot;

import java.util.*;

/**
 * Created by Winston on 07/11/14.
 */
public class SnapshotFetcher {

    public LinkedList<Snapshot> getSnapshotsForProjectAfterVersion(String projectName, int version) throws FailedConnectionException, SnapshotPostException {
        List<SnapshotInfo> snapshotInfos = getSnapshotInfosAfterVersion(projectName, version);
        List<SnapshotData> snapshotDatas = getMatchingSnapshotData(projectName, snapshotInfos);
        LinkedList<Snapshot> snapshots = combine(snapshotInfos, snapshotDatas);
        return snapshots;
    }

    private List<SnapshotInfo> getSnapshotInfosAfterVersion(String projectName, int version) throws FailedConnectionException, SnapshotPostException {
        SortedSet<SnapshotInfo> versions = new TreeSet<SnapshotInfo>();
        SnapshotGetDocRequest getDoc = new SnapshotGetDocRequest(projectName);
        SnapshotGetSavedVersRequest getSavedVers = new SnapshotGetSavedVersRequest(projectName);
        getDoc.request();
        getSavedVers.request();
        SnapshotGetDocResult latestDoc = getDoc.getResult();
        int latest = latestDoc.getVersionID();
        if (latest > version) {
            for (SnapshotInfo snapshotInfo : getSavedVers.getResult().getSavedVers()) {
                if (snapshotInfo.getVersionId() > version) {
                    versions.add(snapshotInfo);
                }
            }
            versions.add(new SnapshotInfo(latest, latestDoc.getCreatedAt(), latestDoc.getName(), latestDoc.getEmail()));

        }
        return new LinkedList<SnapshotInfo>(versions);
    }

    private List<SnapshotData> getMatchingSnapshotData(String projectName, List<SnapshotInfo> snapshotInfos) throws FailedConnectionException {
        List<SnapshotGetForVersionRequest> firedRequests = fireDataRequests(projectName, snapshotInfos);
        List<SnapshotData> snapshotDataList = new LinkedList<SnapshotData>();
        for (SnapshotGetForVersionRequest fired : firedRequests) {
            snapshotDataList.add(fired.getResult().getSnapshotData());
        }
        return snapshotDataList;
    }

    private List<SnapshotGetForVersionRequest> fireDataRequests(String projectName, List<SnapshotInfo> snapshotInfos) {
        List<SnapshotGetForVersionRequest> requests = new LinkedList<SnapshotGetForVersionRequest>();
        for (SnapshotInfo snapshotInfo : snapshotInfos) {
            SnapshotGetForVersionRequest request = new SnapshotGetForVersionRequest(projectName, snapshotInfo.getVersionId());
            requests.add(request);
            request.request();
        }
        return requests;
    }

    private LinkedList<Snapshot> combine(List<SnapshotInfo> snapshotInfos, List<SnapshotData> snapshotDatas) {
        LinkedList<Snapshot> snapshots = new LinkedList<Snapshot>();
        Iterator<SnapshotInfo> infos = snapshotInfos.iterator();
        Iterator<SnapshotData> datas = snapshotDatas.iterator();
        while (infos.hasNext()) {
            snapshots.add(new Snapshot(infos.next(), datas.next()));
        }
        return snapshots;
    }

}
