package uk.ac.ic.wlgitbridge;

import org.eclipse.jgit.api.errors.GitAPIException;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.application.GitBridgeApp;
import uk.ac.ic.wlgitbridge.snapshot.servermock.server.MockSnapshotServer;
import uk.ac.ic.wlgitbridge.snapshot.servermock.state.SnapshotAPIState;
import uk.ac.ic.wlgitbridge.snapshot.servermock.state.SnapshotAPIStateBuilder;
import uk.ac.ic.wlgitbridge.snapshot.servermock.util.FileUtil;
import uk.ac.ic.wlgitbridge.util.Util;

import java.io.*;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/**
 * Created by Winston on 11/01/15.
 */
public class WLGitBridgeIntegrationTest {

    private Runtime runtime = Runtime.getRuntime();

    private Map<String, Map<String, SnapshotAPIState>> states =
            new HashMap<String, Map<String, SnapshotAPIState>>() {{
                put("canCloneARepository", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/canCloneARepository/state/state.json")).build());
                }});
                put("canCloneMultipleRepositories", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/canCloneMultipleRepositories/state/state.json")).build());
                }});
                put("cannotCloneAProtectedProject", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/cannotCloneAProtectedProject/state/state.json")).build());
                }});
                put("canPullAModifiedTexFile", new HashMap<String, SnapshotAPIState>() {{
                    put("base", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullAModifiedTexFile/base/state.json")).build());
                    put("withModifiedTexFile", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullAModifiedTexFile/withModifiedTexFile/state.json")).build());
                }});
                put("canPullADeletedTexFile", new HashMap<String, SnapshotAPIState>() {{
                    put("base", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullADeletedTexFile/base/state.json")).build());
                    put("withDeletedTexFile", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullADeletedTexFile/withDeletedTexFile/state.json")).build());
                }});
                put("canPullAModifiedBinaryFile", new HashMap<String, SnapshotAPIState>() {{
                    put("base", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullAModifiedBinaryFile/base/state.json")).build());
                    put("withModifiedBinaryFile", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullAModifiedBinaryFile/withModifiedBinaryFile/state.json")).build());
                }});
                put("canPullADeletedBinaryFile", new HashMap<String, SnapshotAPIState>() {{
                    put("base", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullADeletedBinaryFile/base/state.json")).build());
                    put("withDeletedBinaryFile", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullADeletedBinaryFile/withDeletedBinaryFile/state.json")).build());
                }});
                put("canPullAModifiedNestedFile", new HashMap<String, SnapshotAPIState>() {{
                    put("base", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullADeletedBinaryFile/base/state.json")).build());
                    put("withModifiedNestedFile", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullAModifiedNestedFile/withModifiedNestedFile/state.json")).build());
                }});
                put("canPullDeletedNestedFiles", new HashMap<String, SnapshotAPIState>() {{
                    put("base", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullDeletedNestedFiles/base/state.json")).build());
                    put("withDeletedNestedFiles", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullDeletedNestedFiles/withDeletedNestedFiles/state.json")).build());
                }});
                put("canPushFilesSuccessfully", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/canPushFilesSuccessfully/state/state.json")).build());
                }});
                put("pushFailsOnFirstStageOutOfDate", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/pushFailsOnFirstStageOutOfDate/state/state.json")).build());
                }});
                put("pushFailsOnSecondStageOutOfDate", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/pushFailsOnSecondStageOutOfDate/state/state.json")).build());
                }});
                put("pushFailsOnInvalidFiles", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/pushFailsOnInvalidFiles/state/state.json")).build());
                }});
                put("pushFailsOnInvalidProject", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/pushFailsOnInvalidProject/state/state.json")).build());
                }});
                put("pushFailsOnUnexpectedError", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/pushFailsOnUnexpectedError/state/state.json")).build());
                }});
            }};

    @Rule
    public TemporaryFolder folder = new TemporaryFolder();

    @Test
    public void canCloneARepository() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3857, getResource("/canCloneARepository").toFile());
        server.start();
        server.setState(states.get("canCloneARepository").get("state"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33857, 3857)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process git = runtime.exec("git clone http://127.0.0.1:33857/testproj.git", null, dir);
        int exitCode = git.waitFor();
        wlgb.stop();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCode);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canCloneARepository/state/testproj"), testprojDir.toPath()));
    }

    @Test
    public void canCloneMultipleRepositories() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3858, getResource("/canCloneMultipleRepositories").toFile());
        server.start();
        server.setState(states.get("canCloneMultipleRepositories").get("state"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33858, 3858)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process git1 = runtime.exec("git clone http://127.0.0.1:33858/testproj1.git", null, dir);
        int exitCode1 = git1.waitFor();
        Process git2 = runtime.exec("git clone http://127.0.0.1:33858/testproj2.git", null, dir);
        int exitCode2 = git2.waitFor();
        wlgb.stop();
        File testproj1Dir = new File(dir, "testproj1");
        File testproj2Dir = new File(dir, "testproj2");
        assertEquals(0, exitCode1);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canCloneMultipleRepositories/state/testproj1"), testproj1Dir.toPath()));
        assertEquals(0, exitCode2);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canCloneMultipleRepositories/state/testproj2"), testproj2Dir.toPath()));
    }


    private static final String EXPECTED_OUT_PROTECTED =
            "Cloning into 'protected'...\n" +
                    "fatal: remote error: Your project is protected, and can't be cloned (yet).\n";
    @Test
    public void cannotCloneAProtectedProject() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3861, getResource("/cannotCloneAProtectedProject").toFile());
        server.start();
        server.setState(states.get("cannotCloneAProtectedProject").get("state"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33861, 3861)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process git = runtime.exec("git clone http://127.0.0.1:33861/protected.git", null, dir);
        String output = Util.fromStream(git.getErrorStream());
        int exitCode = git.waitFor();
        assertEquals(128, exitCode);
        assertEquals(EXPECTED_OUT_PROTECTED, output);
        wlgb.stop();
    }

    @Test
    public void canPullAModifiedTexFile() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3859, getResource("/canPullAModifiedTexFile").toFile());
        server.start();
        server.setState(states.get("canPullAModifiedTexFile").get("base"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33859, 3859)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process gitBase = runtime.exec("git clone http://127.0.0.1:33859/testproj.git", null, dir);
        int exitCodeBase = gitBase.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCodeBase);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullAModifiedTexFile/base/testproj"), testprojDir.toPath()));
        server.setState(states.get("canPullAModifiedTexFile").get("withModifiedTexFile"));
        Process gitWithModifiedTexFile = runtime.exec("git pull", null, testprojDir);
        int exitCodeWithModifiedTexFile = gitWithModifiedTexFile.waitFor();
        wlgb.stop();
        assertEquals(0, exitCodeWithModifiedTexFile);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullAModifiedTexFile/withModifiedTexFile/testproj"), testprojDir.toPath()));
    }

    @Test
    public void canPullADeletedTexFile() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3860, getResource("/canPullADeletedTexFile").toFile());
        server.start();
        server.setState(states.get("canPullADeletedTexFile").get("base"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33860, 3860)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process gitBase = runtime.exec("git clone http://127.0.0.1:33860/testproj.git", null, dir);
        int exitCodeBase = gitBase.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCodeBase);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullADeletedTexFile/base/testproj"), testprojDir.toPath()));
        server.setState(states.get("canPullADeletedTexFile").get("withDeletedTexFile"));
        Process gitWithDeletedTexFile = runtime.exec("git pull", null, testprojDir);
        int exitCodeWithDeletedTexFile = gitWithDeletedTexFile.waitFor();
        wlgb.stop();
        assertEquals(0, exitCodeWithDeletedTexFile);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullADeletedTexFile/withDeletedTexFile/testproj"), testprojDir.toPath()));
    }

    @Test
    public void canPullAModifiedBinaryFile() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3862, getResource("/canPullAModifiedBinaryFile").toFile());
        server.start();
        server.setState(states.get("canPullAModifiedBinaryFile").get("base"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33862, 3862)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process gitBase = runtime.exec("git clone http://127.0.0.1:33862/testproj.git", null, dir);
        int exitCodeBase = gitBase.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCodeBase);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullAModifiedBinaryFile/base/testproj"), testprojDir.toPath()));
        server.setState(states.get("canPullAModifiedBinaryFile").get("withModifiedBinaryFile"));
        Process gitWithModifiedBinaryFile = runtime.exec("git pull", null, testprojDir);
        int exitCodeWithModifiedBinaryFile = gitWithModifiedBinaryFile.waitFor();
        wlgb.stop();
        assertEquals(0, exitCodeWithModifiedBinaryFile);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullAModifiedBinaryFile/withModifiedBinaryFile/testproj"), testprojDir.toPath()));
    }

    @Test
    public void canPullADeletedBinaryFile() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3863, getResource("/canPullADeletedBinaryFile").toFile());
        server.start();
        server.setState(states.get("canPullADeletedBinaryFile").get("base"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33863, 3863)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process gitBase = runtime.exec("git clone http://127.0.0.1:33863/testproj.git", null, dir);
        int exitCodeBase = gitBase.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCodeBase);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullADeletedBinaryFile/base/testproj"), testprojDir.toPath()));
        server.setState(states.get("canPullADeletedBinaryFile").get("withDeletedBinaryFile"));
        Process gitWithDeletedBinaryFile = runtime.exec("git pull", null, testprojDir);
        int exitCodeWithDeletedBinaryFile = gitWithDeletedBinaryFile.waitFor();
        wlgb.stop();
        assertEquals(0, exitCodeWithDeletedBinaryFile);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullADeletedBinaryFile/withDeletedBinaryFile/testproj"), testprojDir.toPath()));
    }

    @Test
    public void canPullAModifiedNestedFile() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3864, getResource("/canPullAModifiedNestedFile").toFile());
        server.start();
        server.setState(states.get("canPullAModifiedNestedFile").get("base"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33864, 3864)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process gitBase = runtime.exec("git clone http://127.0.0.1:33864/testproj.git", null, dir);
        int exitCodeBase = gitBase.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCodeBase);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullAModifiedNestedFile/base/testproj"), testprojDir.toPath()));
        server.setState(states.get("canPullAModifiedNestedFile").get("withModifiedNestedFile"));
        Process gitWithModifiedNestedFile = runtime.exec("git pull", null, testprojDir);
        int exitCodeWithModifiedNestedFile = gitWithModifiedNestedFile.waitFor();
        wlgb.stop();
        assertEquals(0, exitCodeWithModifiedNestedFile);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullAModifiedNestedFile/withModifiedNestedFile/testproj"), testprojDir.toPath()));
    }

    @Test
    public void canPullDeletedNestedFiles() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3865, getResource("/canPullDeletedNestedFiles").toFile());
        server.start();
        server.setState(states.get("canPullDeletedNestedFiles").get("base"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33865, 3865)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process gitBase = runtime.exec("git clone http://127.0.0.1:33865/testproj.git", null, dir);
        int exitCodeBase = gitBase.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCodeBase);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullDeletedNestedFiles/base/testproj"), testprojDir.toPath()));
        server.setState(states.get("canPullDeletedNestedFiles").get("withDeletedNestedFiles"));
        Process gitWithDeletedBinaryFile = runtime.exec("git pull", null, testprojDir);
        int exitCodeWithDeletedBinaryFile = gitWithDeletedBinaryFile.waitFor();
        wlgb.stop();
        assertEquals(0, exitCodeWithDeletedBinaryFile);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullDeletedNestedFiles/withDeletedNestedFiles/testproj"), testprojDir.toPath()));
    }

    @Test
    public void canPushFilesSuccessfully() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3866, getResource("/canPushFilesSuccessfully").toFile());
        server.start();
        server.setState(states.get("canPushFilesSuccessfully").get("state"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33866, 3866)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process git = runtime.exec("git clone http://127.0.0.1:33866/testproj.git", null, dir);
        int exitCode = git.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCode);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPushFilesSuccessfully/state/testproj"), testprojDir.toPath()));
        runtime.exec("touch push.tex", null, testprojDir).waitFor();
        runtime.exec("git add -A", null, testprojDir).waitFor();
        runtime.exec("git commit -m \"push\"", null, testprojDir).waitFor();
        Process gitPush = runtime.exec("git push", null, testprojDir);
        int pushExitCode = gitPush.waitFor();
        wlgb.stop();
        assertEquals(0, pushExitCode);
    }


    private static final String EXPECTED_OUT_PUSH_OUT_OF_DATE_FIRST =
            "To http://127.0.0.1:33867/testproj.git\n" +
            " ! [rejected]        master -> master (non-fast-forward)\n" +
            "error: failed to push some refs to 'http://127.0.0.1:33867/testproj.git'\n" +
            "hint: Updates were rejected because the tip of your current branch is behind\n" +
            "hint: its remote counterpart. Integrate the remote changes (e.g.\n" +
            "hint: 'git pull ...') before pushing again.\n" +
            "hint: See the 'Note about fast-forwards' in 'git push --help' for details.\n";

    @Test
    public void pushFailsOnFirstStageOutOfDate() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3867, getResource("/pushFailsOnFirstStageOutOfDate").toFile());
        server.start();
        server.setState(states.get("pushFailsOnFirstStageOutOfDate").get("state"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33867, 3867)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process git = runtime.exec("git clone http://127.0.0.1:33867/testproj.git", null, dir);
        int exitCode = git.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCode);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/pushFailsOnFirstStageOutOfDate/state/testproj"), testprojDir.toPath()));
        runtime.exec("touch push.tex", null, testprojDir).waitFor();
        runtime.exec("git add -A", null, testprojDir).waitFor();
        runtime.exec("git commit -m \"push\"", null, testprojDir).waitFor();
        Process gitPush = runtime.exec("git push", null, testprojDir);
        int pushExitCode = gitPush.waitFor();
        wlgb.stop();
        assertEquals(1, pushExitCode);
        assertEquals(EXPECTED_OUT_PUSH_OUT_OF_DATE_FIRST, Util.fromStream(gitPush.getErrorStream(), 2));
    }


    private static final String EXPECTED_OUT_PUSH_OUT_OF_DATE_SECOND =
            "To http://127.0.0.1:33868/testproj.git\n" +
                    " ! [rejected]        master -> master (non-fast-forward)\n" +
                    "error: failed to push some refs to 'http://127.0.0.1:33868/testproj.git'\n" +
                    "hint: Updates were rejected because the tip of your current branch is behind\n" +
                    "hint: its remote counterpart. Integrate the remote changes (e.g.\n" +
                    "hint: 'git pull ...') before pushing again.\n" +
                    "hint: See the 'Note about fast-forwards' in 'git push --help' for details.\n";

    @Test
    public void pushFailsOnSecondStageOutOfDate() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3868, getResource("/pushFailsOnSecondStageOutOfDate").toFile());
        server.start();
        server.setState(states.get("pushFailsOnSecondStageOutOfDate").get("state"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33868, 3868)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process git = runtime.exec("git clone http://127.0.0.1:33868/testproj.git", null, dir);
        int exitCode = git.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCode);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/pushFailsOnSecondStageOutOfDate/state/testproj"), testprojDir.toPath()));
        runtime.exec("touch push.tex", null, testprojDir).waitFor();
        runtime.exec("git add -A", null, testprojDir).waitFor();
        runtime.exec("git commit -m \"push\"", null, testprojDir).waitFor();
        Process gitPush = runtime.exec("git push", null, testprojDir);
        int pushExitCode = gitPush.waitFor();
        wlgb.stop();
        assertEquals(1, pushExitCode);
        assertEquals(EXPECTED_OUT_PUSH_OUT_OF_DATE_SECOND, Util.fromStream(gitPush.getErrorStream(), 2));
    }


    private static final List<String> EXPECTED_OUT_PUSH_INVALID_FILES =
            Arrays.asList(
                    "remote: error: invalid files",
                    "remote: hint: You have 4 invalid files in your Overleaf project:",
                    "remote: hint: file1.invalid (error)",
                    "remote: hint: file2.exe (invalid file extension)",
                    "remote: hint: hello world.png (rename to: hello_world.png)",
                    "remote: hint: an image.jpg (rename to: an_image.jpg)",
                    "To http://127.0.0.1:33869/testproj.git",
                    "! [remote rejected] master -> master (invalid files)",
                    "error: failed to push some refs to 'http://127.0.0.1:33869/testproj.git'"
            );

    @Test
    public void pushFailsOnInvalidFiles() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3869, getResource("/pushFailsOnInvalidFiles").toFile());
        server.start();
        server.setState(states.get("pushFailsOnInvalidFiles").get("state"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33869, 3869)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process git = runtime.exec("git clone http://127.0.0.1:33869/testproj.git", null, dir);
        int exitCode = git.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCode);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/pushFailsOnInvalidFiles/state/testproj"), testprojDir.toPath()));
        runtime.exec("touch push.tex", null, testprojDir).waitFor();
        runtime.exec("git add -A", null, testprojDir).waitFor();
        runtime.exec("git commit -m \"push\"", null, testprojDir).waitFor();
        Process gitPush = runtime.exec("git push", null, testprojDir);
        int pushExitCode = gitPush.waitFor();
        wlgb.stop();
        assertEquals(1, pushExitCode);
        List<String> actual = Util.linesFromStream(gitPush.getErrorStream(), 2, "[K");
        assertEquals(EXPECTED_OUT_PUSH_INVALID_FILES, actual);
    }


    private static final List<String> EXPECTED_OUT_PUSH_INVALID_PROJECT =
            Arrays.asList(
                    "remote: error: invalid project",
                    "remote: hint: project: no main file",
                    "remote: hint: The project would have no (editable) main .tex file.",
                    "To http://127.0.0.1:33870/testproj.git",
                    "! [remote rejected] master -> master (invalid project)",
                    "error: failed to push some refs to 'http://127.0.0.1:33870/testproj.git'"
            );

    @Test
    public void pushFailsOnInvalidProject() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3870, getResource("/pushFailsOnInvalidProject").toFile());
        server.start();
        server.setState(states.get("pushFailsOnInvalidProject").get("state"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33870, 3870)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process git = runtime.exec("git clone http://127.0.0.1:33870/testproj.git", null, dir);
        int exitCode = git.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCode);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/pushFailsOnInvalidProject/state/testproj"), testprojDir.toPath()));
        runtime.exec("touch push.tex", null, testprojDir).waitFor();
        runtime.exec("git add -A", null, testprojDir).waitFor();
        runtime.exec("git commit -m \"push\"", null, testprojDir).waitFor();
        Process gitPush = runtime.exec("git push", null, testprojDir);
        int pushExitCode = gitPush.waitFor();
        wlgb.stop();
        assertEquals(1, pushExitCode);
        List<String> actual = Util.linesFromStream(gitPush.getErrorStream(), 2, "[K");
        assertEquals(EXPECTED_OUT_PUSH_INVALID_PROJECT, actual);
    }


    private static final List<String> EXPECTED_OUT_PUSH_UNEXPECTED_ERROR =
            Arrays.asList(
                    "remote: error: Overleaf error",
                    "remote: hint: There was an internal error with the Overleaf server.",
                    "remote: hint: Please contact Overleaf.",
                    "To http://127.0.0.1:33871/testproj.git",
                    "! [remote rejected] master -> master (Overleaf error)",
                    "error: failed to push some refs to 'http://127.0.0.1:33871/testproj.git'"
            );

    /* this one prints a stack trace */
    @Test
    public void pushFailsOnUnexpectedError() throws IOException, GitAPIException, InterruptedException {
        MockSnapshotServer server = new MockSnapshotServer(3871, getResource("/pushFailsOnUnexpectedError").toFile());
        server.start();
        server.setState(states.get("pushFailsOnUnexpectedError").get("state"));
        GitBridgeApp wlgb = new GitBridgeApp(new String[] {
                makeConfigFile(33871, 3871)
        });
        wlgb.run();
        File dir = folder.newFolder();
        Process git = runtime.exec("git clone http://127.0.0.1:33871/testproj.git", null, dir);
        int exitCode = git.waitFor();
        File testprojDir = new File(dir, "testproj");
        assertEquals(0, exitCode);
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/pushFailsOnUnexpectedError/state/testproj"), testprojDir.toPath()));
        runtime.exec("touch push.tex", null, testprojDir).waitFor();
        runtime.exec("git add -A", null, testprojDir).waitFor();
        runtime.exec("git commit -m \"push\"", null, testprojDir).waitFor();
        Process gitPush = runtime.exec("git push", null, testprojDir);
        int pushExitCode = gitPush.waitFor();
        wlgb.stop();
        assertEquals(1, pushExitCode);
        List<String> actual = Util.linesFromStream(gitPush.getErrorStream(), 2, "[K");
        assertEquals(EXPECTED_OUT_PUSH_UNEXPECTED_ERROR, actual);
    }

    private String makeConfigFile(int port, int apiPort) throws IOException {
        File wlgb = folder.newFolder();
        File config = folder.newFile();
        PrintWriter writer = new PrintWriter(config);
        writer.println("{\n" +
                "\t\"port\": " + port + ",\n" +
                "\t\"rootGitDirectory\": \"" + wlgb.getAbsolutePath() + "\",\n" +
                "\t\"apiBaseUrl\": \"http://127.0.0.1:" + apiPort + "/api/v0\",\n" +
                "\t\"username\": \"\",\n" +
                "\t\"password\": \"\",\n" +
                "\t\"postbackBaseUrl\": \"http://127.0.0.1:" + port + "\",\n" +
                "\t\"serviceName\": \"Overleaf\"\n" +
                "}\n");
        writer.close();
        return config.getAbsolutePath();
    }

    private Path getResource(String path) {
        return Paths.get("src/test/resources/uk/ac/ic/wlgitbridge/WLGitBridgeIntegrationTest" + path);
    }

    private InputStream getResourceAsStream(String path) {
        try {
            return new FileInputStream(getResource(path).toFile());
        } catch (FileNotFoundException e) {
            throw new RuntimeException(e);
        }
    }

    private static String withoutWhitespace(String s) {
        return s.replaceAll("\\s","");
    }

}
