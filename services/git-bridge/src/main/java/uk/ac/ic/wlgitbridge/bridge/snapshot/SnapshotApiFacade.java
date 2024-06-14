package uk.ac.ic.wlgitbridge.bridge.snapshot;

import com.google.api.client.auth.oauth2.Credential;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.data.model.Snapshot;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.snapshot.base.MissingRepositoryException;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.GetForVersionResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.GetSavedVersResult;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.SnapshotInfo;
import uk.ac.ic.wlgitbridge.snapshot.push.PushResult;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.InvalidProjectException;

/*
 * Created by winston on 02/07/2017.
 */
public class SnapshotApiFacade {

  private final SnapshotApi api;

  public SnapshotApiFacade(SnapshotApi api) {
    this.api = api;
  }

  public boolean projectExists(Optional<Credential> oauth2, String projectName)
      throws FailedConnectionException, GitUserException {
    try {
      SnapshotApi.getResult(api.getDoc(oauth2, projectName)).getVersionID();
      return true;
    } catch (InvalidProjectException e) {
      return false;
    }
  }

  public Optional<GetDocResult> getDoc(Optional<Credential> oauth2, String projectName)
      throws FailedConnectionException, GitUserException {
    try {
      GetDocResult doc = SnapshotApi.getResult(api.getDoc(oauth2, projectName));
      doc.getVersionID();
      return Optional.of(doc);
    } catch (InvalidProjectException e) {
      return Optional.empty();
    }
  }

  public Deque<Snapshot> getSnapshots(
      Optional<Credential> oauth2, String projectName, int afterVersionId)
      throws GitUserException, FailedConnectionException {
    List<SnapshotInfo> snapshotInfos =
        getSnapshotInfosAfterVersion(oauth2, projectName, afterVersionId);
    List<SnapshotData> snapshotDatas = getMatchingSnapshotData(oauth2, projectName, snapshotInfos);
    return combine(snapshotInfos, snapshotDatas);
  }

  public PushResult push(
      Optional<Credential> oauth2, CandidateSnapshot candidateSnapshot, String postbackKey)
      throws MissingRepositoryException, FailedConnectionException, ForbiddenException {
    return SnapshotApi.getResult(api.push(oauth2, candidateSnapshot, postbackKey));
  }

  private List<SnapshotInfo> getSnapshotInfosAfterVersion(
      Optional<Credential> oauth2, String projectName, int version)
      throws FailedConnectionException, GitUserException {
    SortedSet<SnapshotInfo> versions = new TreeSet<>();
    CompletableFuture<GetDocResult> getDoc = api.getDoc(oauth2, projectName);
    CompletableFuture<GetSavedVersResult> savedVers = api.getSavedVers(oauth2, projectName);
    GetDocResult latestDoc = SnapshotApi.getResult(getDoc);
    int latest = latestDoc.getVersionID();
    // Handle edge-case for projects with no changes, that were imported
    // to v2. In which case both `latest` and `version` will be zero.
    // See: https://github.com/overleaf/writelatex-git-bridge/pull/50
    if (latest > version || (latest == 0 && version == 0)) {
      for (SnapshotInfo snapshotInfo : SnapshotApi.getResult(savedVers).getSavedVers()) {
        if (snapshotInfo.getVersionId() > version) {
          versions.add(snapshotInfo);
        }
      }
      versions.add(
          new SnapshotInfo(
              latest, latestDoc.getCreatedAt(), latestDoc.getName(), latestDoc.getEmail()));
    }
    return new ArrayList<>(versions);
  }

  private List<SnapshotData> getMatchingSnapshotData(
      Optional<Credential> oauth2, String projectName, List<SnapshotInfo> snapshotInfos)
      throws FailedConnectionException, ForbiddenException {
    List<CompletableFuture<GetForVersionResult>> firedRequests =
        fireDataRequests(oauth2, projectName, snapshotInfos);
    List<SnapshotData> snapshotDataList = new ArrayList<>();
    for (CompletableFuture<GetForVersionResult> fired : firedRequests) {
      snapshotDataList.add(fired.join().getSnapshotData());
    }
    return snapshotDataList;
  }

  private List<CompletableFuture<GetForVersionResult>> fireDataRequests(
      Optional<Credential> oauth2, String projectName, List<SnapshotInfo> snapshotInfos) {
    return snapshotInfos.stream()
        .map(snap -> api.getForVersion(oauth2, projectName, snap.getVersionId()))
        .collect(Collectors.toList());
  }

  private static Deque<Snapshot> combine(
      List<SnapshotInfo> snapshotInfos, List<SnapshotData> snapshotDatas) {
    Deque<Snapshot> snapshots = new LinkedList<>();
    Iterator<SnapshotInfo> infos = snapshotInfos.iterator();
    Iterator<SnapshotData> datas = snapshotDatas.iterator();
    while (infos.hasNext()) {
      snapshots.add(new Snapshot(infos.next(), datas.next()));
    }
    return snapshots;
  }
}
