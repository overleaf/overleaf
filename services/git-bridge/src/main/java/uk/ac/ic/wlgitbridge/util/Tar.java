package uk.ac.ic.wlgitbridge.util;

import com.google.api.client.repackaged.com.google.common.base.Preconditions;
import org.apache.commons.compress.archivers.ArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.apache.commons.compress.utils.IOUtils;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.output.ByteArrayOutputStream;

import java.io.*;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Created by winston on 23/08/2016.
 */
public class Tar {

    private Tar() {}

    public static InputStream tar(File fileOrDir) throws IOException {
        ByteArrayOutputStream bout = new ByteArrayOutputStream();
        TarArchiveOutputStream tout = new TarArchiveOutputStream(bout);
        addTarEntry(
                tout,
                Paths.get(fileOrDir.getParentFile().getAbsolutePath()),
                fileOrDir
        );
        tout.close();
        return new ByteArrayInputStream(bout.toByteArray());
    }

    private static void addTarEntry(
            TarArchiveOutputStream tout,
            Path base,
            File fileOrDir
    ) throws IOException {
        if (fileOrDir.isDirectory()) {
            addTarDir(tout, base, fileOrDir);
        } else if (fileOrDir.isFile()) {
            addTarFile(tout, base, fileOrDir);
        } else {
            throw new IllegalArgumentException(
                    "invalid file or dir: " + fileOrDir
            );
        }
    }

    private static void addTarDir(
            TarArchiveOutputStream tout,
            Path base,
            File dir
    ) throws IOException {
        Preconditions.checkArgument(dir.isDirectory());
        String name = base.relativize(
                Paths.get(dir.getAbsolutePath())
        ).toString();
        ArchiveEntry entry = tout.createArchiveEntry(dir, name);
        tout.putArchiveEntry(entry);
        tout.closeArchiveEntry();
        for (File f : dir.listFiles()) {
            addTarEntry(tout, base, f);
        }
    }

    private static void addTarFile(
            TarArchiveOutputStream tout,
            Path base,
            File file
    ) throws IOException {
        Preconditions.checkArgument(file.isFile());
        String name = base.relativize(
                Paths.get(file.getAbsolutePath())
        ).toString();
        ArchiveEntry entry = tout.createArchiveEntry(file, name);
        tout.putArchiveEntry(entry);
        tout.write(FileUtils.readFileToByteArray(file));
        tout.closeArchiveEntry();
    }

    public static void untar(InputStream tar, File parentDir) throws IOException {
        TarArchiveInputStream tin = new TarArchiveInputStream(tar);
        ArchiveEntry e;
        while ((e = tin.getNextEntry()) != null) {
            File f = new File(parentDir, e.getName());
            f.setLastModified(e.getLastModifiedDate().getTime());
            f.getParentFile().mkdirs();
            if (e.isDirectory()) {
                f.mkdir();
                continue;
            }
            long size = e.getSize();
            Preconditions.checkArgument(
                    size > 0 && size < Integer.MAX_VALUE,
                    "file too big: tar should have thrown an IOException"
            );
            try (OutputStream out = new FileOutputStream(f)) {
                /* TarInputStream pretends each
                   entry's EOF is the stream's EOF */
                IOUtils.copy(tin, out);
            }
        }
    }

}
