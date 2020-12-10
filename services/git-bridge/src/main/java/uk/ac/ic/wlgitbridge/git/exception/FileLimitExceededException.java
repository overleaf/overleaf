package uk.ac.ic.wlgitbridge.git.exception;

import uk.ac.ic.wlgitbridge.util.Util;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

public class FileLimitExceededException extends GitUserException {

    private final long numFiles;

    private final long maxFiles;

    public FileLimitExceededException(long numFiles, long maxFiles) {
        this.numFiles = numFiles;
        this.maxFiles = maxFiles;
    }

    @Override
    public String getMessage() {
        return "too many files";
    }

    @Override
    public List<String> getDescriptionLines() {
        return Arrays.asList(
            "repository contains " +
            numFiles + " files, which exceeds the limit of " +
            maxFiles + " files"
        );
    }

}
