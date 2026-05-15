package uk.ac.ic.wlgitbridge.git.handler.hook;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.File;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ReceiveCommand;
import org.eclipse.jgit.transport.ReceiveCommand.Result;
import org.eclipse.jgit.transport.ReceivePack;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.slf4j.LoggerFactory;
import uk.ac.ic.wlgitbridge.application.GitBridgeApp;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;

public class WriteLatexPutHookTest {

  private WriteLatexPutHook hook;
  private ReceivePack receivePack;
  private ReceiveCommand receiveCommand;
  private Bridge bridge;
  private RepoStore repoStore;
  private ListAppender<ILoggingEvent> listAppender;
  private Logger logger;

  @Before
  public void setup() {
    bridge = mock(Bridge.class);
    repoStore = mock(RepoStore.class);
    hook = new WriteLatexPutHook(repoStore, bridge, "localhost", Optional.empty());

    receivePack = mock(ReceivePack.class);
    receiveCommand = mock(ReceiveCommand.class);
    Repository repository = mock(Repository.class);
    when(receivePack.getRepository()).thenReturn(repository);
    when(repository.getDirectory()).thenReturn(new File("/tmp/test-repo/.git"));

    logger = (Logger) LoggerFactory.getLogger(GitBridgeApp.class);
    listAppender = new ListAppender<>();
    listAppender.start();
    logger.addAppender(listAppender);
  }

  @After
  public void teardown() {
    logger.detachAppender(listAppender);
  }

  @Test
  public void wrongBranchIsRejected() {
    when(receiveCommand.getRefName()).thenReturn("refs/heads/feature-branch");

    hook.onPreReceive(receivePack, Collections.singletonList(receiveCommand));

    verify(receiveCommand).setResult(eq(Result.REJECTED_OTHER_REASON), anyString());
  }

  @Test
  public void wrongBranchIsLoggedAtWarnNotError() {
    when(receiveCommand.getRefName()).thenReturn("refs/heads/feature-branch");

    hook.onPreReceive(receivePack, Collections.singletonList(receiveCommand));

    List<ILoggingEvent> events = listAppender.list;
    boolean hasWarnLog =
        events.stream()
            .anyMatch(
                e ->
                    e.getLevel() == Level.WARN && e.getFormattedMessage().contains("wrong branch"));
    boolean hasErrorLog =
        events.stream()
            .anyMatch(
                e ->
                    e.getLevel() == Level.ERROR
                        && e.getFormattedMessage().contains("GitUserException"));
    assertTrue("Expected a WARN log for WrongBranchException", hasWarnLog);
    assertFalse("Expected no ERROR log for WrongBranchException", hasErrorLog);
  }

  @Test
  public void forcedPushIsRejected() {
    when(receiveCommand.getRefName()).thenReturn("refs/heads/master");
    when(receiveCommand.getType()).thenReturn(ReceiveCommand.Type.UPDATE_NONFASTFORWARD);

    hook.onPreReceive(receivePack, Collections.singletonList(receiveCommand));

    verify(receiveCommand).setResult(eq(Result.REJECTED_OTHER_REASON), anyString());
  }

  @Test
  public void forcedPushIsLoggedAtWarnNotError() {
    when(receiveCommand.getRefName()).thenReturn("refs/heads/master");
    when(receiveCommand.getType()).thenReturn(ReceiveCommand.Type.UPDATE_NONFASTFORWARD);

    hook.onPreReceive(receivePack, Collections.singletonList(receiveCommand));

    List<ILoggingEvent> events = listAppender.list;
    boolean hasWarnLog =
        events.stream()
            .anyMatch(
                e ->
                    e.getLevel() == Level.WARN
                        && e.getFormattedMessage().contains("forced push prohibited"));
    boolean hasErrorLog =
        events.stream()
            .anyMatch(
                e ->
                    e.getLevel() == Level.ERROR
                        && e.getFormattedMessage().contains("GitUserException"));
    assertTrue("Expected a WARN log for ForcedPushException", hasWarnLog);
    assertFalse("Expected no ERROR log for ForcedPushException", hasErrorLog);
  }
}
