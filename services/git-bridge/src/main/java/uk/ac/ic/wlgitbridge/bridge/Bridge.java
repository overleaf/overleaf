package uk.ac.ic.wlgitbridge.bridge;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.db.ProjectState;
import uk.ac.ic.wlgitbridge.bridge.lock.LockGuard;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.resource.ResourceCache;
import uk.ac.ic.wlgitbridge.bridge.resource.UrlResourceCache;
import uk.ac.ic.wlgitbridge.bridge.snapshot.NetSnapshotAPI;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotAPI;
import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJob;
import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJobConfig;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;
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

import java.io.File;
import java.io.IOException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
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
            Optional<SwapJobConfig> swapJobConfig
    ) {
        ProjectLock lock = new ProjectLockImpl((int threads) ->
                Log.info("Waiting for " + threads + " projects...")
        );
        return new Bridge(
                lock,
                repoStore,
                dbStore,
                swapStore,
                SwapJob.fromConfig(
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

    public void startSwapJob() {
        swapJob.start();
    }

    public void checkDB() {
        Log.info("Checking DB");
        File rootDir = repoStore.getRootDirectory();
        for (File f : rootDir.listFiles()) {
            if (f.getName().equals(".wlgb")) {
                continue;
            }
            String projName = f.getName();
            try (LockGuard __ = lock.lockGuard(projName)) {
                File dotGit = new File(f, ".git");
                if (!dotGit.exists()) {
                    Log.warn("Project: {} has no .git", projName);
                    continue;
                }
                ProjectState state = dbStore.getProjectState(projName);
                if (state != ProjectState.NOT_PRESENT) {
                    continue;
                }
                Log.warn("Project: {} not in swap_store, adding", projName);
                dbStore.setLastAccessedTime(
                        projName,
                        new Timestamp(dotGit.lastModified())
                );
            }
        }
    }

    public boolean projectExists(
            Credential oauth2,
            String projectName
    ) throws ServiceMayNotContinueException,
             GitUserException {
        try (LockGuard __ = lock.lockGuard(projectName)) {
            GetDocRequest getDocRequest = new GetDocRequest(
                    oauth2,
                    projectName
            );
            getDocRequest.request();
            getDocRequest.getResult().getVersionID();
            return true;
        } catch (InvalidProjectException e) {
            return false;
        }
    }

    public void updateRepository(
            Credential oauth2,
            ProjectRepo repo
    ) throws IOException, GitUserException {
        String projectName = repo.getProjectName();
        try (LockGuard __ = lock.lockGuard(projectName)) {
            Log.info("[{}] Updating", projectName);
            updateRepositoryCritical(oauth2, repo);
        }
    }

    private void updateRepositoryCritical(
            Credential oauth2,
            ProjectRepo repo
    ) throws IOException, GitUserException {
        String projectName = repo.getProjectName();
        ProjectState state = dbStore.getProjectState(projectName);
        switch (state) {
        case NOT_PRESENT:
            repo.initRepo(repoStore);
            break;
        case SWAPPED:
            swapJob.restore(projectName);
            /* Fallthrough */
        default:
            repo.useExistingRepository(repoStore);
        }
        updateProject(oauth2, repo);
        dbStore.setLastAccessedTime(
                projectName,
                Timestamp.valueOf(LocalDateTime.now())
        );
    }

    public void putDirectoryContentsToProjectWithName(
            Credential oauth2,
            String projectName,
            RawDirectory directoryContents,
            RawDirectory oldDirectoryContents,
            String hostname
    ) throws SnapshotPostException, IOException, ForbiddenException {
        try (LockGuard __ = lock.lockGuard(projectName)) {
            pushToProjectCritical(
                    oauth2,
                    projectName,
                    directoryContents,
                    oldDirectoryContents
            );
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
        }
    }

    private void pushToProjectCritical(
            Credential oauth2,
            String projectName,
            RawDirectory directoryContents,
            RawDirectory oldDirectoryContents
    ) throws IOException, ForbiddenException, SnapshotPostException {
        Log.info("[{}] Pushing", projectName);
        String postbackKey = postbackManager.makeKeyForProject(projectName);
        Log.info(
                "[{}] Created postback key: {}",
                projectName,
                postbackKey
        );
        try (
                CandidateSnapshot candidate = createCandidateSnapshot(
                                projectName,
                                directoryContents,
                                oldDirectoryContents
                );
        ) {
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
                dbStore.setLastAccessedTime(
                        projectName,
                        Timestamp.valueOf(LocalDateTime.now())
                );
            } else {
                Log.warn(
                        "[{}] Went out of date while waiting for push",
                        projectName
                );
                throw new OutOfDateException();
            }
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

    private void updateProject(
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
