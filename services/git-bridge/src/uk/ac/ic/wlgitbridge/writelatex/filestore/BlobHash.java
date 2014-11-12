package uk.ac.ic.wlgitbridge.writelatex.filestore;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;

/**
 * Created by Winston on 08/11/14.
 */
public class BlobHash {

    private byte[] hash;

    public BlobHash(byte[] blob) {
        MessageDigest md = null;
        try {
            md = MessageDigest.getInstance("SHA-256");
            hash = md.digest(blob);
            System.out.println(Arrays.toString(hash));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public boolean equals(Object obj) {
        return obj instanceof BlobHash && Arrays.equals(((BlobHash) obj).hash, hash);
    }

    @Override
    public int hashCode() {
        return Arrays.hashCode(hash);
    }

}
