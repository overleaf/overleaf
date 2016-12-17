package uk.ac.ic.wlgitbridge.bridge;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.db.ProjectState;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SqliteDBStore;
import uk.ac.ic.wlgitbridge.bridge.lock.LockGuard;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.FSGitRepoStore;
import uk.ac.ic.wlgitbridge.bridge.repo.GitProjectRepo;
import uk.ac.ic.wlgitbridge.bridge.repo.ProjectRepo;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.resource.ResourceCache;
import uk.ac.ic.wlgitbridge.bridge.resource.UrlResourceCache;
import uk.ac.ic.wlgitbridge.bridge.snapshot.NetSnapshotAPI;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotAPI;
import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJob;
import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJobConfig;
import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJobImpl;
import uk.ac.ic.wlgitbridge.bridge.swap.store.S3SwapStore;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.data.ProjectLockImpl;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.model.Snapshot;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.git.exception.SizeLimitExceededException;
import uk.ac.ic.wlgitbridge.git.handler.WLReceivePackFactory;
import uk.ac.ic.wlgitbridge.git.handler.WLRepositoryResolver;
import uk.ac.ic.wlgitbridge.git.handler.WLUploadPackFactory;
import uk.ac.ic.wlgitbridge.git.handler.hook.WriteLatexPutHook;
import uk.ac.ic.wlgitbridge.server.FileHandler;
import uk.ac.ic.wlgitbridge.server.PostbackContents;
import uk.ac.ic.wlgitbridge.server.PostbackHandler;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocRequest;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.snapshot.push.PostbackManager;
import uk.ac.ic.wlgitbridge.snapshot.push.PostbackPromise;
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
 * This is the heart of the Git Bridge. You plug in all the parts (project
 * lock, repo store, db store, swap store, snapshot api, resource cache and
 * postback manager) is called by Git user requests and Overleaf postback
 * requests.
 *
 * Follow these links to go "outward" (to input from Git users and Overleaf):
 *
 * 1. JGit hooks, which handle user Git requests:
 *
 *    @see WLRepositoryResolver - used on all requests associate a repo with a
 *                                project name, or fail
 *
*     @see WLUploadPackFactory - used to handle clones and fetches
 *
 *    @see WLReceivePackFactory - used to handle pushes by setting a hook
 *    @see WriteLatexPutHook - the hook used to handle pushes
 *
 * 2. The Postback Servlet, which handles postbacks from the Overleaf app
 *    to confirm that a project is pushed. If a postback is lost, it's fine, we
 *    just update ourselves on the next access.
 *
 *    @see PostbackHandler - the entry point for postbacks
 *
 * Follow these links to go "inward" (to the Git Bridge components):
 *
 * 1. The Project Lock, used to synchronise accesses to projects and shutdown
 *    the Git Bridge gracefully by preventing further lock acquiring.
 *
 *    @see ProjectLock - the interface used for the Project Lock
 *    @see ProjectLockImpl - the default concrete implementation
 *
 * 2. The Repo Store, used to provide repository objects.
 *
 *    The default implementation uses Git on the file system.
 *
 *    @see RepoStore - the interface for the Repo Store
 *    @see FSGitRepoStore - the default concrete implementation
 *    @see ProjectRepo - an interface for an actual repo instance
 *    @see GitProjectRepo - the default concrete implementation
 *
 * 3. The DB Store, used to store persistent data such as the latest version
 *    of each project that we have (used for querying the Snapshot API), along
 *    with caching remote blobs.
 *
 *    The default implementation is SQLite based.
 *
 *    @see DBStore - the interface for the DB store
 *    @see SqliteDBStore - the default concrete implementation
 *
 * 4. The Swap Store, used to swap projects to when the disk goes over a
 *    certain data usage.
 *
 *    The default implementation tarbzips projects to/from Amazon S3.
 *
 *    @see SwapStore - the interface for the Swap Store
 *    @see S3SwapStore - the default concrete implementation
 *
 * 5. The Swap Job, which performs the actual swapping on the swap store based
 *    on various configuration options.
 *
 *    @see SwapJob - the interface for the Swap Job
 *    @see SwapJobImpl - the default concrete implementation
 *
 * 6. The Snapshot API, which provides data from the Overleaf app.
 *
 *    @see SnapshotAPI - the interface for the Snapshot API.
 *    @see NetSnapshotAPI - the default concrete implementation
 *
 * 7. The Resource Cache, which provides the data for attachment resources from
 *    URLs. It will generally fetch from the source on a cache miss.
 *
 *    The default implementation uses the DB Store to maintain a mapping from
 *    URLs to files in an actual repo.
 *
 *    @see ResourceCache - the interface for the Resource Cache
 *    @see UrlResourceCache - the default concrete implementation
 *
 * 8. The Postback Manager, which keeps track of pending postbacks. It stores a
 *    mapping from project names to postback promises.
 *
 *    @see PostbackManager - the class
 *    @see PostbackPromise - the object waited on for a postback.
 *
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

    /**
     * Creates a Bridge from its configurable parts, which are the repo, db and
     * swap store, and the swap job config.
     *
     * This should be the method used to create a Bridge.
     * @param repoStore The repo store to use
     * @param dbStore The db store to use
     * @param swapStore The swap store to use
     * @param swapJobConfig The swap config to use, or empty for no-op
     * @return The constructed Bridge.
     */
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

    /**
     * Creates a bridge from all of its components, not just its configurable
     * parts. This is for substituting mock/stub components for testing.
     * It's also used by Bridge.make to actually construct the bridge.
     * @param lock the {@link ProjectLock} to use
     * @param repoStore the {@link RepoStore} to use
     * @param dbStore the {@link DBStore} to use
     * @param swapStore the {@link SwapStore} to use
     * @param swapJob the {@link SwapJob} to use
     * @param snapshotAPI the {@link SnapshotAPI} to use
     * @param resourceCache the {@link ResourceCache} to use
     */
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

    /**
     * This performs the graceful shutdown of the Bridge, which is called by the
     * shutdown hook. It acquires the project write lock, which prevents
     * work being done for new projects (which acquire the read lock).
     * Once it has the write lock, there are no readers left, so the git bridge
     * can shut down gracefully.
     *
     * It is also used by the tests.
     */
    void doShutdown() {
        Log.info("Shutdown received.");
        Log.info("Stopping SwapJob");
        swapJob.stop();
        Log.info("Waiting for projects");
        lock.lockAll();
        Log.info("Bye");
    }

    /**
     * Starts the swap job, which will begin checking whether projects should be
     * swapped with a configurable frequency.
     */
    public void startSwapJob() {
        swapJob.start();
    }

    /**
     * Performs a check of inconsistencies in the DB. This was used to upgrade
     * the schema.
     */
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
                Log.warn(
                        "Project: {} not in swap_store, adding",
                        projName
                );
                dbStore.setLastAccessedTime(
                        projName,
                        new Timestamp(dotGit.lastModified())
                );
            }
        }
    }

    /**
     * Checks if a project exists by asking the snapshot API.
     *
     * The snapshot API is the source of truth because we can't know by
     * ourselves whether a project exists. If a user creates a project on the
     * app, and clones, the project is not on the git bridge disk and must ask
     * the snapshot API whether it exists.
     *
     * 1. Acquires the project lock.
     * 2. Makes a docs request and tries to get the version ID.
     * 3. If the version ID is valid, returns true.
     * 4. Otherwise, the version ID is invalid, and throws
     *    InvalidProjectException, returning false.
     *
     * @param oauth2 The oauth2 to use for the snapshot API
     * @param projectName The project name
     * @return true iff the project exists
     * @throws ServiceMayNotContinueException if the connection fails
     * @throws GitUserException if the user is not allowed access
     */
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

    /**
     * Synchronises the given repository with Overleaf.
     *
     * It acquires the project lock and calls
     * {@link #updateRepositoryCritical(Credential, ProjectRepo)}
     * @param oauth2 The oauth2 to use
     * @param repo the repository to use
     * @throws IOException
     * @throws GitUserException
     */
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

    /**
     * Synchronises the given repository with Overleaf.
     *
     * Pre: the project lock must be acquired for the given repo.
     *
     * 1. Queries the project state for the given project name.
     *    a. NOT_PRESENT = We've never seen it before, and the row for the
     *                     project doesn't even exist.
     *    b. PRESENT = The
     *
     * If the project has never been cloned, it is git init'd. If the project
     * is in swap, it is restored to disk. Otherwise, the project was already
     * present.
     *
     * With the project present, snapshots are downloaded from the snapshot
     * API with {@link #updateProject(Credential, ProjectRepo)}.
     *
     * Then, the last accessed time of the project is set to the current time.
     * This is to support the LRU of the swap store.
     * @param oauth2
     * @param repo
     * @throws IOException
     * @throws GitUserException
     */
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

    /**
     * The public call to push a project.
     *
     * It acquires the lock and calls {@link #pushCritical(
     *      Credential,
     *      String,
     *      RawDirectory,
     *      RawDirectory
     * )}, catching exceptions, logging, and rethrowing them.
     * @param oauth2 The oauth2 to use for the snapshot API
     * @param projectName The name of the project to push to
     * @param directoryContents The new contents of the project
     * @param oldDirectoryContents The old contents of the project
     * @param hostname
     * @throws SnapshotPostException
     * @throws IOException
     * @throws ForbiddenException
     */
    public void push(
            Credential oauth2,
            String projectName,
            RawDirectory directoryContents,
            RawDirectory oldDirectoryContents,
            String hostname
    ) throws SnapshotPostException, IOException, ForbiddenException {
        try (LockGuard __ = lock.lockGuard(projectName)) {
            pushCritical(
                    oauth2,
                    projectName,
                    directoryContents,
                    oldDirectoryContents
            );
        } catch (SevereSnapshotPostException e) {
            Log.warn(
                    "[" + projectName + "] Failed to put to Overleaf",
                    e
            );
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

    /**
     * Does the work of pushing to a project, assuming the project lock is held.
     * The {@link WriteLatexPutHook} is the original caller, and when we return
     * without throwing, the commit is committed.
     *
     * We start off by creating a postback key, which is given in the url when
     * the Overleaf app tries to access the atts.
     *
     * Then creates a {@link CandidateSnapshot} from the old and new project
     * contents. The
     * {@link CandidateSnapshot} is created using
     * {@link #createCandidateSnapshot(String, RawDirectory, RawDirectory)},
     * which creates the snapshot object and writes the push files to the
     * atts directory, which is served by the {@link PostbackHandler}.
     * The files are deleted at the end of a try-with-resources block.
     *
     * Then 3 things are used to make the push request to the snapshot API:
     * 1. The oauth2
     * 2. The candidate snapshot
     * 3. The postback key
     *
     * If the snapshot API reports this as not successful, we immediately throw
     * an {@link OutOfDateException}, which goes back to the user.
     *
     * Otherwise, we wait (with a timeout) on a promise from the postback
     * manager, which can throw back to the user.
     *
     * If this is successful, we approve the snapshot with
     * {@link #approveSnapshot(int, CandidateSnapshot)}, which updates our side
     * of the push: the latest version and the URL index store.
     *
     * Then, we set the last accessed time for the swap store.
     *
     * Finally, after we return, the push to the repo from the hook is
     * successful and the repo gets updated.
     *
     * @param oauth2
     * @param projectName
     * @param directoryContents
     * @param oldDirectoryContents
     * @throws IOException
     * @throws ForbiddenException
     * @throws SnapshotPostException
     */
    private void pushCritical(
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

    /**
     * A public call that should originate from the {@link FileHandler}.
     *
     * The {@link FileHandler} serves atts to the Overleaf app during a push.
     * The Overleaf app includes the postback key in the request, which was
     * originally given on a push request.
     *
     * This method checks that the postback key matches, and throws if not.
     *
     * The FileHandler should not serve the file if this throws.
     * @param projectName The project name that this key belongs to
     * @param postbackKey The key
     * @throws InvalidPostbackKeyException If the key doesn't match
     */
    public void checkPostbackKey(String projectName, String postbackKey)
            throws InvalidPostbackKeyException {
        postbackManager.checkPostbackKey(projectName, postbackKey);
    }

    /**
     * A public call that originates from the postback thread
     * {@link PostbackContents#processPostback()}, i.e. once the Overleaf app
     * has fetched all the atts and has committed the push and is happy, it
     * calls back here, fulfilling the promise that the push
     * {@link #push(Credential, String, RawDirectory, RawDirectory, String)}
     * is waiting on.
     *
     * The Overleaf app will have invented a new version for the push, which is
     * passed to the promise for the original push request to update the app.
     * @param projectName The name of the project being pushed to
     * @param postbackKey The postback key being used
     * @param versionID the new version id to use
     * @throws UnexpectedPostbackException if the postback key is invalid
     */
    public void postbackReceivedSuccessfully(
            String projectName,
            String postbackKey,
            int versionID
    ) throws UnexpectedPostbackException {
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

    /**
     * As with {@link #postbackReceivedSuccessfully(String, String, int)},
     * but with an exception instead.
     *
     * This is based on the JSON body of the postback from the Overleaf app.
     *
     * The most likely problem is an {@link OutOfDateException}.
     * @param projectName The name of the project
     * @param postbackKey The postback key being used
     * @param exception The exception encountered
     * @throws UnexpectedPostbackException If the postback key is invalid
     */
    public void postbackReceivedWithException(
            String projectName,
            String postbackKey,
            SnapshotPostException exception
    ) throws UnexpectedPostbackException {
        Log.warn("[{}] Postback received with exception", projectName);
        postbackManager.postExceptionForProject(
                projectName,
                exception,
                postbackKey
        );
    }

    /* PRIVATE */

    /**
     * Called by {@link #updateRepositoryCritical(Credential, ProjectRepo)}.
     *
     * Does the actual work of getting the snapshots for a project from the
     * snapshot API and committing them to a repo.
     *
     * If any snapshots were found, sets the latest version for the project.
     *
     * @param oauth2
     * @param repo
     * @throws IOException
     * @throws GitUserException
     */
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

    /**
     * Called by {@link #updateProject(Credential, ProjectRepo)}.
     *
     * Performs the actual Git commits on the disk.
     *
     * Each commit adds files to the db store
     * ({@link ResourceCache#get(String, String, String, Map, Map)},
     * and then removes any files that were deleted.
     * @param repo The repository to commit to
     * @param snapshots The snapshots to commit
     * @throws IOException If an IOException occurred
     * @throws SizeLimitExceededException If one of the files was too big.
     */
    private void makeCommitsFromSnapshots(
            ProjectRepo repo,
            Collection<Snapshot> snapshots
    ) throws IOException, SizeLimitExceededException {
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

    /**
     * Called by
     * {@link #pushCritical(Credential, String, RawDirectory, RawDirectory)}.
     *
     * This call consists of 2 things: Creating the candidate snapshot,
     * and writing the atts to the atts directory.
     *
     * The candidate snapshot RAIIs away those atts (use try-with-resources).
     * @param projectName The name of the project
     * @param directoryContents The new directory contents
     * @param oldDirectoryContents The old directory contents
     * @return The {@link CandidateSnapshot} created
     * @throws IOException If an I/O exception occurred on writing
     */
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

    /**
     * Called by
     * {@link #pushCritical(Credential, String, RawDirectory, RawDirectory)}.
     *
     * This method approves a push by setting the latest version and removing
     * any deleted files from the db store (files were already added by the
     * resources cache).
     * @param versionID
     * @param candidateSnapshot
     */
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
