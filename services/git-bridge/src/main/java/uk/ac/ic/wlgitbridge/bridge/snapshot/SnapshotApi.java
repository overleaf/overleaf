package uk.ac.ic.wlgitbridge.bridge.snapshot;

import com.google.api.client.auth.oauth2.Credential;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.snapshot.base.MissingRepositoryException;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.GetForVersionResult;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.GetSavedVersResult;
import uk.ac.ic.wlgitbridge.snapshot.push.PushResult;

/*
 * Created by winston on 20/08/2016.
 */
public interface SnapshotApi {

  CompletableFuture<GetDocResult> getDoc(Optional<Credential> oauth2, String projectName);

  CompletableFuture<GetForVersionResult> getForVersion(
      Optional<Credential> oauth2, String projectName, int versionId);

  CompletableFuture<GetSavedVersResult> getSavedVers(
      Optional<Credential> oauth2, String projectName);

  CompletableFuture<PushResult> push(
      Optional<Credential> oauth2, CandidateSnapshot candidateSnapshot, String postbackKey);

  static <T> T getResult(CompletableFuture<T> result)
      throws MissingRepositoryException, FailedConnectionException, ForbiddenException {
    try {
      return result.join();
    } catch (CompletionException e) {
      try {
        throw e.getCause();
      } catch (MissingRepositoryException
          | FailedConnectionException
          | ForbiddenException
          | RuntimeException r) {
        throw r;
      } catch (Throwable __) {
        throw e;
      }
    }
  }
}
