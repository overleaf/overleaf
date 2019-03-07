package uk.ac.ic.wlgitbridge.bridge.repo;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.treewalk.FileTreeIterator;
import org.eclipse.jgit.treewalk.WorkingTreeIterator;
import org.eclipse.jgit.treewalk.WorkingTreeOptions;
import org.eclipse.jgit.util.FS;

import java.io.File;
import java.lang.reflect.Field;

/**
 * Created by winston on 08/10/2016.
 */
public class NoGitignoreIterator extends FileTreeIterator {

    private static final Field ignoreNodeField;

    static {
        try {
            ignoreNodeField = WorkingTreeIterator.class.getDeclaredField(
                    "ignoreNode"
            );
        } catch (NoSuchFieldException e) {
            throw new RuntimeException(e);
        }
        ignoreNodeField.setAccessible(true);
    }

    public NoGitignoreIterator(Repository repo) {
        super(repo);
    }

    public NoGitignoreIterator(
            Repository repo,
            FileModeStrategy fileModeStrategy
    ) {
        super(repo, fileModeStrategy);
    }

    public NoGitignoreIterator(File root, FS fs, WorkingTreeOptions options) {
        super(root, fs, options);
    }

    public NoGitignoreIterator(
            File root,
            FS fs,
            WorkingTreeOptions options,
            FileModeStrategy fileModeStrategy
    ) {
        super(root, fs, options, fileModeStrategy);
    }

    protected NoGitignoreIterator(FileTreeIterator p, File root, FS fs) {
        super(p, root, fs);
    }

    protected NoGitignoreIterator(
            WorkingTreeIterator p,
            File root,
            FS fs,
            FileModeStrategy fileModeStrategy
    ) {
        super(p, root, fs, fileModeStrategy);
    }

    @Override
    protected void init(Entry[] list) {
        super.init(list);
        try {
            ignoreNodeField.set(this, null);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }

}
