package uk.ac.ic.wlgitbridge.bridge.snapshot;

import com.google.api.client.auth.oauth2.Credential;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocRequest;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.GetForVersionRequest;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.GetForVersionResult;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.GetSavedVersRequest;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.GetSavedVersResult;
import uk.ac.ic.wlgitbridge.snapshot.push.PushRequest;
import uk.ac.ic.wlgitbridge.snapshot.push.PushResult;

/*
 * Created by winston on 20/08/2016.
 */
public class NetSnapshotApi implements SnapshotApi {

  @Override
  public CompletableFuture<GetDocResult> getDoc(Optional<Credential> oauth2, String projectName) {
    return new GetDocRequest(opt(oauth2), projectName).request();
  }

  @Override
  public CompletableFuture<GetForVersionResult> getForVersion(
      Optional<Credential> oauth2, String projectName, int versionId) {
    return new GetForVersionRequest(opt(oauth2), projectName, versionId).request();
  }

  @Override
  public CompletableFuture<GetSavedVersResult> getSavedVers(
      Optional<Credential> oauth2, String projectName) {
    return new GetSavedVersRequest(opt(oauth2), projectName).request();
  }

  @Override
  public CompletableFuture<PushResult> push(
      Optional<Credential> oauth2, CandidateSnapshot candidateSnapshot, String postbackKey) {
    return new PushRequest(opt(oauth2), candidateSnapshot, postbackKey).request();
  }

  private static Credential opt(Optional<Credential> oauth2) {
    return oauth2.orElse(null);
  }
}
