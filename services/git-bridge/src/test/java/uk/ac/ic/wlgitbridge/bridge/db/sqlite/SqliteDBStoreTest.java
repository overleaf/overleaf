package uk.ac.ic.wlgitbridge.bridge.db.sqlite;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.io.IOException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.junit.Before;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.bridge.db.ProjectState;

/*
 * Created by winston on 23/08/2016.
 */
public class SqliteDBStoreTest {

  private SqliteDBStore dbStore;

  @Before
  public void setup() throws IOException {
    TemporaryFolder tmpFolder = new TemporaryFolder();
    tmpFolder.create();
    dbStore = new SqliteDBStore(tmpFolder.newFile("dbStore.db"));
  }

  @Test
  public void testGetNumProjects() {
    assertEquals(0, dbStore.getNumProjects());
    dbStore.setLatestVersionForProject("asdf", 1);
    assertEquals(1, dbStore.getNumProjects());
    dbStore.setLatestVersionForProject("asdf1", 2);
    assertEquals(2, dbStore.getNumProjects());
    dbStore.setLatestVersionForProject("asdf1", 3);
    assertEquals(2, dbStore.getNumProjects());
  }

  @Test
  public void swapTableStartsOutEmpty() {
    assertNull(dbStore.getOldestUnswappedProject());
  }

  @Test
  public void testGetOldestUnswappedProject() {
    dbStore.setLatestVersionForProject("older", 3);
    dbStore.setLastAccessedTime(
        "older", Timestamp.valueOf(LocalDateTime.now().minus(5, ChronoUnit.SECONDS)));
    dbStore.setLatestVersionForProject("asdf", 1);
    dbStore.setLastAccessedTime(
        "asdf", Timestamp.valueOf(LocalDateTime.now().minus(1, ChronoUnit.SECONDS)));
    assertEquals("older", dbStore.getOldestUnswappedProject());
    dbStore.setLastAccessedTime("older", Timestamp.valueOf(LocalDateTime.now()));
    assertEquals("asdf", dbStore.getOldestUnswappedProject());
  }

  @Test
  public void swapAndRestore() {
    String projectName = "something";
    String compression = "bzip2";
    dbStore.setLatestVersionForProject(projectName, 42);
    dbStore.swap(projectName, compression);
    assertNull(dbStore.getOldestUnswappedProject());
    assertEquals(dbStore.getSwapCompression(projectName), compression);
    // and restore
    dbStore.restore(projectName);
    assertEquals(dbStore.getSwapCompression(projectName), null);
  }

  @Test
  public void noOldestProjectIfAllEvicted() {
    dbStore.setLatestVersionForProject("older", 3);
    dbStore.swap("older", "bzip2");
    assertNull(dbStore.getOldestUnswappedProject());
  }

  @Test
  public void nullLastAccessedTimesDoNotCount() {
    dbStore.setLatestVersionForProject("older", 2);
    dbStore.setLastAccessedTime(
        "older", Timestamp.valueOf(LocalDateTime.now().minus(5, ChronoUnit.SECONDS)));
    dbStore.setLatestVersionForProject("newer", 3);
    dbStore.setLastAccessedTime("newer", Timestamp.valueOf(LocalDateTime.now()));
    assertEquals("older", dbStore.getOldestUnswappedProject());
    dbStore.swap("older", "bzip2");
    assertEquals("newer", dbStore.getOldestUnswappedProject());
  }

  @Test
  public void missingProjectLastAccessedTimeCanBeSet() {
    dbStore.setLatestVersionForProject("asdf", 1);
    dbStore.setLastAccessedTime("asdf", Timestamp.valueOf(LocalDateTime.now()));
    assertEquals("asdf", dbStore.getOldestUnswappedProject());
  }

  @Test
  public void testGetNumUnswappedProjects() {
    dbStore.setLatestVersionForProject("asdf", 1);
    dbStore.setLastAccessedTime("asdf", Timestamp.valueOf(LocalDateTime.now()));
    assertEquals(1, dbStore.getNumUnswappedProjects());
    dbStore.swap("asdf", "bzip2");
    assertEquals(0, dbStore.getNumUnswappedProjects());
  }

  @Test
  public void projectStateIsNotPresentIfNotInDBAtAll() {
    assertEquals(ProjectState.NOT_PRESENT, dbStore.getProjectState("asdf"));
  }

  @Test
  public void projectStateIsPresentIfProjectHasLastAccessed() {
    dbStore.setLatestVersionForProject("asdf", 1);
    dbStore.setLastAccessedTime("asdf", Timestamp.valueOf(LocalDateTime.now()));
    assertEquals(ProjectState.PRESENT, dbStore.getProjectState("asdf"));
  }

  @Test
  public void projectStateIsSwappedIfLastAccessedIsNull() {
    dbStore.setLatestVersionForProject("asdf", 1);
    dbStore.swap("asdf", "bzip2");
    assertEquals(ProjectState.SWAPPED, dbStore.getProjectState("asdf"));
  }

  @Test
  public void testDeleteProject() {
    dbStore.setLatestVersionForProject("project1", 1);
    dbStore.setLatestVersionForProject("project2", 1);
    assertEquals(ProjectState.PRESENT, dbStore.getProjectState("project1"));
    assertEquals(ProjectState.PRESENT, dbStore.getProjectState("project2"));
    dbStore.deleteProject("project1");
    assertEquals(ProjectState.NOT_PRESENT, dbStore.getProjectState("project1"));
    assertEquals(ProjectState.PRESENT, dbStore.getProjectState("project2"));
  }
}
