package uk.ac.ic.wlgitbridge.bridge.repo;

import javax.annotation.Nullable;
import java.util.Optional;

/**
 * Created by winston on 02/07/2017.
 */
public class RepoStoreConfig {

    @Nullable
    private final Long maxFileSize;

    @Nullable
    private final Long maxFileNum;

    public RepoStoreConfig(Long maxFileSize, Long maxFileNum) {
        this.maxFileSize = maxFileSize;
        this.maxFileNum = maxFileNum;
    }

    public Optional<Long> getMaxFileSize() {
        return Optional.ofNullable(maxFileSize);
    }

    public Optional<Long> getMaxFileNum() {
        return Optional.ofNullable(maxFileNum);
    }
}
