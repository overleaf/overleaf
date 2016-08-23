package uk.ac.ic.wlgitbridge.bridge;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.resource.ResourceCache;
import uk.ac.ic.wlgitbridge.bridge.resource.UrlResourceCache;
import uk.ac.ic.wlgitbridge.bridge.snapshot.NetSnapshotAPI;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotAPI;
import uk.ac.ic.wlgitbridge.bridge.swap.SwapJob;
import uk.ac.ic.wlgitbridge.bridge.swap.SwapJobConfig;
import uk.ac.ic.wlgitbridge.bridge.swap.SwapJobImpl;
import uk.ac.ic.wlgitbridge.bridge.swap.SwapStore;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.data.ProjectLockImpl;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.model.Snapshot;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocRequest;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.snapshot.push.PostbackManager;
import uk.ac.ic.wlgitbridge.snapshot.push.PushRequest;
import uk.ac.ic.wlgitbridge.snapshot.push.PushResult;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.*;
import uk.ac.ic.wlgitbridge.util.Log;

import java.io.IOException;
import java.time.Duration;
import java.util.*;

/**
 * Created by Winston on 16/11/14.
 */
public class Bridge {

    private final ProjectLock lock;

    private final RepoStore repoStore;
    private final DBStore dbStore;
    private final SwapStore swapStore;
    private final SwapJob swapJob;

    private final SnapshotAPI snapshotAPI;
    private final ResourceCache resourceCache;


    private final PostbackManager postbackManager;

    public static Bridge make(
            RepoStore repoStore,
            DBStore dbStore,
            SwapStore swapStore,
            SwapJobConfig swapJobConfig
    ) {
        ProjectLock lock = new ProjectLockImpl((int threads) ->
                Log.info("Waiting for " + threads + " projects...")
        );
        return new Bridge(
                lock,
                repoStore,
                dbStore,
                swapStore,
                new SwapJobImpl(
                        swapJobConfig,
                        lock,
                        repoStore,
                        dbStore,
                        swapStore
                ),
                new NetSnapshotAPI(),
                new UrlResourceCache(dbStore)
        );
    }

    Bridge(
            ProjectLock lock,
            RepoStore repoStore,
            DBStore dbStore,
            SwapStore swapStore,
            SwapJob swapJob,
            SnapshotAPI snapshotAPI,
            ResourceCache resourceCache
    ) {
        this.lock = lock;
        this.repoStore = repoStore;
        this.dbStore = dbStore;
        this.swapStore = swapStore;
        this.snapshotAPI = snapshotAPI;
        this.resourceCache = resourceCache;
        this.swapJob = swapJob;
        postbackManager = new PostbackManager();
        Runtime.getRuntime().addShutdownHook(new Thread(this::doShutdown));
        repoStore.purgeNonexistentProjects(dbStore.getProjectNames());
    }

    void doShutdown() {
        Log.info("Shutdown received.");
        Log.info("Stopping SwapJob");
        swapJob.stop();
        Log.info("Waiting for projects");
        lock.lockAll();
        Log.info("Bye");
    }

    public void startSwapJob(Duration interval) {
        swapJob.start(interval);
    }

    /* TODO: Remove these when WLBridged is moved into RepoStore */
    public void lockForProject(String projectName) {
        lock.lockForProject(projectName);
    }

    public void unlockForProject(String projectName) {
        lock.unlockForProject(projectName);
    }

    public boolean repositoryExists(Credential oauth2, String projectName)
            throws ServiceMayNotContinueException, GitUserException {
        lockForProject(projectName);
        GetDocRequest getDocRequest = new GetDocRequest(oauth2, projectName);
        getDocRequest.request();
        try {
            getDocRequest.getResult().getVersionID();
        } catch (InvalidProjectException e) {
            return false;
        } finally {
            unlockForProject(projectName);
        }
        return true;
    }

    public void getWritableRepositories(
            Credential oauth2,
            ProjectRepo repo
    ) throws IOException,
             GitUserException {
        Log.info("[{}] Fetching", repo.getProjectName());
        updateProjectWithName(oauth2, repo);
    }

    public void
    putDirectoryContentsToProjectWithName(Credential oauth2,
                                          String projectName,
                                          RawDirectory directoryContents,
                                          RawDirectory oldDirectoryContents,
                                          String hostname)
            throws SnapshotPostException, IOException, ForbiddenException {
        lock.lockForProject(projectName);
        CandidateSnapshot candidate = null;
        try {
            Log.info("[{}] Pushing", projectName);
            String postbackKey = postbackManager.makeKeyForProject(projectName);
            Log.info(
                    "[{}] Created postback key: {}",
                    projectName,
                    postbackKey
            );
            candidate =
                    createCandidateSnapshot(
                            projectName,
                            directoryContents,
                            oldDirectoryContents
                    );
            Log.info(
                    "[{}] Candindate snapshot created: {}",
                    projectName,
                    candidate
            );
            PushRequest pushRequest = new PushRequest(
                    oauth2,
                    candidate,
                    postbackKey
            );
            pushRequest.request();
            PushResult result = pushRequest.getResult();
            if (result.wasSuccessful()) {
                Log.info(
                        "[{}] Push to Overleaf successful",
                        projectName
                );
                Log.info("[{}] Waiting for postback...", projectName);
                int versionID =
                        postbackManager.waitForVersionIdOrThrow(projectName);
                Log.info(
                        "[{}] Got version ID for push: {}",
                        projectName,
                        versionID
                );
                approveSnapshot(versionID, candidate);
                Log.info(
                        "[{}] Approved version ID: {}",
                        projectName,
                        versionID
                );
            } else {
                Log.warn(
                        "[{}] Went out of date while waiting for push",
                        projectName
                );
                throw new OutOfDateException();
            }
        } catch (SevereSnapshotPostException e) {
            Log.warn("[" + projectName + "] Failed to put to Overleaf", e);
            throw e;
        } catch (SnapshotPostException e) {
            /* Stack trace should be printed further up */
            Log.warn(
                    "[{}] Exception when waiting for postback: {}",
                    projectName,
                    e.getClass().getSimpleName()
            );
            throw e;
        } catch (IOException e) {
            Log.warn("[{}] IOException on put", projectName);
            throw e;
        } finally {
            if (candidate != null) {
                candidate.deleteServletFiles();
            } else {
                Log.error(
                        "[{}] Candidate snapshot was null: " +
                                "this should never happen.",
                        projectName
                );
            }
            lock.unlockForProject(projectName);
        }
    }

    public void checkPostbackKey(String projectName, String postbackKey)
            throws InvalidPostbackKeyException {
        postbackManager.checkPostbackKey(projectName, postbackKey);
    }

    /* Called by postback thread. */
    public void postbackReceivedSuccessfully(String projectName,
                                             String postbackKey,
                                             int versionID)
            throws UnexpectedPostbackException {
        Log.info(
                "[{}]" +
                        " Postback received by postback thread, version: {}",
                projectName,
                versionID);
        postbackManager.postVersionIDForProject(
                projectName,
                versionID,
                postbackKey
        );
    }

    public void postbackReceivedWithException(String projectName,
                                              String postbackKey,
                                              SnapshotPostException exception)
            throws UnexpectedPostbackException {
        Log.warn("[{}] Postback received with exception", projectName);
        postbackManager.postExceptionForProject(
                projectName,
                exception,
                postbackKey
        );
    }

    /* PRIVATE */

    private void updateProjectWithName(
            Credential oauth2,
            ProjectRepo repo
    ) throws IOException, GitUserException {
        String projectName = repo.getProjectName();
        Deque<Snapshot> snapshots =
                snapshotAPI.getSnapshotsForProjectAfterVersion(
                        oauth2,
                        projectName,
                        dbStore.getLatestVersionForProject(projectName)
                );

        makeCommitsFromSnapshots(repo, snapshots);

        if (!snapshots.isEmpty()) {
            dbStore.setLatestVersionForProject(
                    projectName,
                    snapshots.getLast().getVersionID()
            );
        }
    }

    private void makeCommitsFromSnapshots(ProjectRepo repo,
                                          Collection<Snapshot> snapshots)
            throws IOException, GitUserException {
        String name = repo.getProjectName();
        for (Snapshot snapshot : snapshots) {
            Map<String, RawFile> fileTable = repo.getFiles();
            List<RawFile> files = new LinkedList<>();
            files.addAll(snapshot.getSrcs());
            Map<String, byte[]> fetchedUrls = new HashMap<>();
            for (SnapshotAttachment snapshotAttachment : snapshot.getAtts()) {
                files.add(
                        resourceCache.get(
                                name,
                                snapshotAttachment.getUrl(),
                                snapshotAttachment.getPath(),
                                fileTable,
                                fetchedUrls
                        )
                );
            }
            Log.info(
                    "[{}] Committing version ID: {}",
                    name,
                    snapshot.getVersionID()
            );
            Collection<String> missingFiles = repo.commitAndGetMissing(
                    new GitDirectoryContents(
                            files,
                            repoStore.getRootDirectory(),
                            name,
                            snapshot
                    )
            );
            dbStore.deleteFilesForProject(
                    name,
                    missingFiles.toArray(new String[missingFiles.size()])
            );
        }
    }

    private CandidateSnapshot createCandidateSnapshot(
            String projectName,
            RawDirectory directoryContents,
            RawDirectory oldDirectoryContents
    ) throws IOException {
        CandidateSnapshot candidateSnapshot = new CandidateSnapshot(
                projectName,
                dbStore.getLatestVersionForProject(projectName),
                directoryContents,
                oldDirectoryContents
        );
        candidateSnapshot.writeServletFiles(repoStore.getRootDirectory());
        return candidateSnapshot;
    }

    private void approveSnapshot(
            int versionID,
            CandidateSnapshot candidateSnapshot
    ) {
        List<String> deleted = candidateSnapshot.getDeleted();
        dbStore.setLatestVersionForProject(
                candidateSnapshot.getProjectName(),
                versionID
        );
        dbStore.deleteFilesForProject(
                candidateSnapshot.getProjectName(),
                deleted.toArray(new String[deleted.size()])
        );
    }



}
