package uk.ac.ic.wlgitbridge.bridge.swap.store;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/*
 * Created by winston on 20/08/2016.
 */
public interface SwapStore {

  Map<String, Function<SwapStoreConfig, SwapStore>> swapStores =
      new HashMap<String, Function<SwapStoreConfig, SwapStore>>() {

        {
          put("noop", NoopSwapStore::new);
          put("memory", InMemorySwapStore::new);
          put("s3", S3SwapStore::new);
        }
      };

  static SwapStore fromConfig(Optional<SwapStoreConfig> cfg) {
    SwapStoreConfig cfg_ = cfg.orElse(SwapStoreConfig.NOOP);
    String type = cfg_.getType();
    return swapStores.get(type).apply(cfg_);
  }

  void upload(String projectName, InputStream uploadStream, long contentLength) throws IOException;

  InputStream openDownloadStream(String projectName);

  void remove(String projectName);

  /*
   * Returns true if the swap store safely persists swapped projects.
   *
   * Fake swap stores should return false.
   */
  boolean isSafe();
}
