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
import java.util.HashMap;
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
                put("canPullAModifiedTexFile", new HashMap<String, SnapshotAPIState>() {{
                    put("base", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullAModifiedTexFile/base/state.json")).build());
                    put("withModifiedTexFile", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullAModifiedTexFile/withModifiedTexFile/state.json")).build());
                }});
                put("canPullADeletedTexFile", new HashMap<String, SnapshotAPIState>() {{
                    put("base", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullADeletedTexFile/base/state.json")).build());
                    put("withDeletedTexFile", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullADeletedTexFile/withDeletedTexFile/state.json")).build());
                }});
                put("cannotCloneAProtectedProject", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/cannotCloneAProtectedProject/state/state.json")).build());
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
        Process gitWithDeletedTexFile = runtime.exec("git pull", null, testprojDir);
        int exitCodeWithDeletedTexFile = gitWithDeletedTexFile.waitFor();
        wlgb.stop();
        assertEquals(0, exitCodeWithDeletedTexFile);
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

}
