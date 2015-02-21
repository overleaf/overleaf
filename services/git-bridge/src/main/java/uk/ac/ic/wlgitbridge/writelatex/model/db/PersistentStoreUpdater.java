package uk.ac.ic.wlgitbridge.writelatex.model.db;

/**
 * Created by Winston on 19/11/14.
 */
public interface PersistentStoreUpdater<T> {

    public void updatePersistentStore(PersistentStore persistentStore, T info);

}
