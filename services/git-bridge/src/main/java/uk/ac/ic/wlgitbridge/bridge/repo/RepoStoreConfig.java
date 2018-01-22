package uk.ac.ic.wlgitbridge.bridge.repo;

import javax.annotation.Nullable;
import java.util.Optional;

/**
 * Created by winston on 02/07/2017.
 */
public class RepoStoreConfig {

    @Nullable
    private final Long maxFileSize;

    public RepoStoreConfig(Long maxFileSize) {
        this.maxFileSize = maxFileSize;
    }

    public Optional<Long> getMaxFileSize() {
        return Optional.ofNullable(maxFileSize);
    }
}
