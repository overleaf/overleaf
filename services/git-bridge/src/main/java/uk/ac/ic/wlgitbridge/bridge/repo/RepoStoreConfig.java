package uk.ac.ic.wlgitbridge.bridge.repo;

import java.util.Optional;
import javax.annotation.Nullable;

/*
 * Created by winston on 02/07/2017.
 */
public class RepoStoreConfig {

  @Nullable private final Long maxFileSize;

  @Nullable private final Long maxFileNum;

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
