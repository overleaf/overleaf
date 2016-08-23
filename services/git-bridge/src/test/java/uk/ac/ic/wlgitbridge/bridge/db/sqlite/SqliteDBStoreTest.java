package uk.ac.ic.wlgitbridge.bridge.db.sqlite;

import org.junit.Before;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

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

}