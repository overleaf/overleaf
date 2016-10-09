package uk.ac.ic.wlgitbridge.bridge.snapshot;

import com.google.api.client.auth.oauth2.Credential;
import uk.ac.ic.wlgitbridge.data.model.Snapshot;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocRequest;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.GetForVersionRequest;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.GetSavedVersRequest;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.SnapshotInfo;

import java.util.*;

/**
 * Created by winston on 20/08/2016.
 */
public class NetSnapshotAPI implements SnapshotAPI {

    @Override
    public Deque<Snapshot> getSnapshotsForProjectAfterVersion(
            Credential oauth2,
            String projectName,
            int version
    ) throws FailedConnectionException, GitUserException {
        List<SnapshotInfo> snapshotInfos = getSnapshotInfosAfterVersion(
                oauth2,
                projectName,
                version
        );
        List<SnapshotData> snapshotDatas = getMatchingSnapshotData(
                oauth2,
                projectName,
                snapshotInfos
        );
        return combine(snapshotInfos, snapshotDatas);
    }

    private List<SnapshotInfo> getSnapshotInfosAfterVersion(
            Credential oauth2,
            String projectName,
            int version
    ) throws FailedConnectionException, GitUserException {
        SortedSet<SnapshotInfo> versions = new TreeSet<>();
        GetDocRequest getDoc = new GetDocRequest(oauth2, projectName);
        GetSavedVersRequest getSavedVers = new GetSavedVersRequest(
                oauth2,
                projectName
        );
        getDoc.request();
        getSavedVers.request();
        GetDocResult latestDoc = getDoc.getResult();
        int latest = latestDoc.getVersionID();
        if (latest > version) {
            for (
                    SnapshotInfo snapshotInfo :
                    getSavedVers.getResult().getSavedVers()
            ) {
                if (snapshotInfo.getVersionId() > version) {
                    versions.add(snapshotInfo);
                }
            }
            versions.add(new SnapshotInfo(
                    latest,
                    latestDoc.getCreatedAt(),
                    latestDoc.getName(),
                    latestDoc.getEmail()
            ));

        }
        return new LinkedList<SnapshotInfo>(versions);
    }

    private List<SnapshotData> getMatchingSnapshotData(
            Credential oauth2,
            String projectName,
            List<SnapshotInfo> snapshotInfos
    ) throws FailedConnectionException, ForbiddenException {
        List<GetForVersionRequest> firedRequests = fireDataRequests(
                oauth2,
                projectName,
                snapshotInfos
        );
        List<SnapshotData> snapshotDataList = new ArrayList<>();
        for (GetForVersionRequest fired : firedRequests) {
            snapshotDataList.add(fired.getResult().getSnapshotData());
        }
        return snapshotDataList;
    }

    private List<GetForVersionRequest> fireDataRequests(
            Credential oauth2,
            String projectName,
            List<SnapshotInfo> snapshotInfos
    ) {
        List<GetForVersionRequest> requests = new ArrayList<>();
        for (SnapshotInfo snapshotInfo : snapshotInfos) {
            GetForVersionRequest request = new GetForVersionRequest(
                    oauth2,
                    projectName,
                    snapshotInfo.getVersionId()
            );
            requests.add(request);
            request.request();
        }
        return requests;
    }

    private Deque<Snapshot> combine(
            List<SnapshotInfo> snapshotInfos,
            List<SnapshotData> snapshotDatas
    ) {
        Deque<Snapshot> snapshots = new LinkedList<>();
        Iterator<SnapshotInfo> infos = snapshotInfos.iterator();
        Iterator<SnapshotData> datas = snapshotDatas.iterator();
        while (infos.hasNext()) {
            snapshots.add(new Snapshot(infos.next(), datas.next()));
        }
        return snapshots;
    }

}
