package uk.ac.ic.wlgitbridge.bridge.db.sqlite;

import org.junit.Before;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.bridge.db.ProjectState;

import java.io.IOException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

/**
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
                "older",
                Timestamp.valueOf(
                        LocalDateTime.now().minus(5, ChronoUnit.SECONDS)
                )
        );
        dbStore.setLatestVersionForProject("asdf", 1);
        dbStore.setLastAccessedTime(
                "asdf",
                Timestamp.valueOf(
                        LocalDateTime.now().minus(1, ChronoUnit.SECONDS)
                )
        );
        assertEquals("older", dbStore.getOldestUnswappedProject());
        dbStore.setLastAccessedTime(
                "older",
                Timestamp.valueOf(
                        LocalDateTime.now()
                )
        );
        assertEquals("asdf", dbStore.getOldestUnswappedProject());
    }

    @Test
    public void noOldestProjectIfAllEvicated() {
        dbStore.setLatestVersionForProject("older", 3);
        dbStore.setLastAccessedTime("older", null);
        assertNull(dbStore.getOldestUnswappedProject());
    }

    @Test
    public void nullLastAccessedTimesDoNotCount() {
        dbStore.setLatestVersionForProject("older", 2);
        dbStore.setLastAccessedTime(
                "older",
                Timestamp.valueOf(
                        LocalDateTime.now().minus(5, ChronoUnit.SECONDS)
                )
        );
        dbStore.setLatestVersionForProject("newer", 3);
        dbStore.setLastAccessedTime(
                "newer",
                Timestamp.valueOf(
                        LocalDateTime.now()
                )
        );
        assertEquals("older", dbStore.getOldestUnswappedProject());
        dbStore.setLastAccessedTime("older", null);
        assertEquals("newer", dbStore.getOldestUnswappedProject());
    }

    @Test
    public void missingProjectLastAccessedTimeCanBeSet() {
        dbStore.setLatestVersionForProject("asdf", 1);
        dbStore.setLastAccessedTime(
                "asdf",
                Timestamp.valueOf(LocalDateTime.now())
        );
        assertEquals("asdf", dbStore.getOldestUnswappedProject());
    }

    @Test
    public void ifMissingDoesNotSetIfProjectIsNotMissing() {
        dbStore.setLatestVersionForProject("older", 1);
        dbStore.setProjectLastAccessedTimeIfMissing(
                "older",
                Timestamp.valueOf(
                        LocalDateTime.now().minus(2, ChronoUnit.SECONDS)
                )
        );
        dbStore.setLatestVersionForProject("asdf", 2);
        dbStore.setProjectLastAccessedTimeIfMissing(
                "asdf",
                Timestamp.valueOf(
                        LocalDateTime.now().minus(1, ChronoUnit.SECONDS)
                )
        );
        assertEquals("older", dbStore.getOldestUnswappedProject());
        dbStore.setProjectLastAccessedTimeIfMissing(
                "older",
                Timestamp.valueOf(
                        LocalDateTime.now()
                )
        );
        assertEquals("older", dbStore.getOldestUnswappedProject());
    }

    @Test
    public void testGetNumUnswappedProjects() {
        dbStore.setLatestVersionForProject("asdf", 1);
        dbStore.setLastAccessedTime(
                "asdf",
                Timestamp.valueOf(LocalDateTime.now())
        );
        assertEquals(1, dbStore.getNumUnswappedProjects());
        dbStore.setLastAccessedTime(
                "asdf",
                null
        );
        assertEquals(0, dbStore.getNumUnswappedProjects());
    }

    @Test
    public void projectStateIsNotPresentIfNotInDBAtAll() {
        assertEquals(
                ProjectState.NOT_PRESENT,
                dbStore.getProjectState("asdf")
        );
    }

    @Test
    public void projectStateIsPresentIfProjectHasLastAccessed() {
        dbStore.setLatestVersionForProject("asdf", 1);
        dbStore.setLastAccessedTime(
                "asdf",
                Timestamp.valueOf(LocalDateTime.now())
        );
        assertEquals(ProjectState.PRESENT, dbStore.getProjectState("asdf"));
    }

    @Test
    public void projectStateIsSwappedIfLastAccessedIsNull() {
        dbStore.setLatestVersionForProject("asdf", 1);
        dbStore.setLastAccessedTime("asdf", null);
        assertEquals(ProjectState.SWAPPED, dbStore.getProjectState("asdf"));
    }

}