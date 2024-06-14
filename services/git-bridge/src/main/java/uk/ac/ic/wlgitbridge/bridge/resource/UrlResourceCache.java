package uk.ac.ic.wlgitbridge.bridge.resource;

import static org.asynchttpclient.Dsl.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.filestore.RepositoryFile;
import uk.ac.ic.wlgitbridge.git.exception.SizeLimitExceededException;
import uk.ac.ic.wlgitbridge.io.http.ning.NingHttpClient;
import uk.ac.ic.wlgitbridge.io.http.ning.NingHttpClientFacade;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by winston on 20/08/2016.
 */
public class UrlResourceCache implements ResourceCache {

  private final DBStore dbStore;

  private final NingHttpClientFacade http;

  UrlResourceCache(DBStore dbStore, NingHttpClientFacade http) {
    this.dbStore = dbStore;
    this.http = http;
  }

  public UrlResourceCache(DBStore dbStore) {
    this(dbStore, new NingHttpClient(asyncHttpClient()));
  }

  @Override
  public RawFile get(
      String projectName,
      String url,
      String newPath,
      Map<String, RawFile> fileTable,
      Map<String, byte[]> fetchedUrls,
      Optional<Long> maxFileSize)
      throws IOException, SizeLimitExceededException {
    String path = dbStore.getPathForURLInProject(projectName, getCacheKeyFromUrl(url));
    byte[] contents;
    if (path == null) {
      path = newPath;
      contents = fetch(projectName, url, path, maxFileSize);
      fetchedUrls.put(url, contents);
    } else {
      Log.debug("Found (" + projectName + "): " + url);
      Log.debug("At (" + projectName + "): " + path);
      contents = fetchedUrls.get(url);
      if (contents == null) {
        RawFile rawFile = fileTable.get(path);
        if (rawFile == null) {
          Log.warn(
              "File "
                  + path
                  + " was not in the current commit, "
                  + "or the git tree, yet path was not null. "
                  + "File url is: "
                  + url);
          contents = fetch(projectName, url, path, maxFileSize);
        } else {
          contents = rawFile.getContents();
        }
      }
    }
    return new RepositoryFile(newPath, contents);
  }

  private byte[] fetch(
      String projectName, final String url, String path, Optional<Long> maxFileSize)
      throws FailedConnectionException, SizeLimitExceededException {
    byte[] contents;
    Log.debug("GET -> " + url);
    try {
      contents =
          http.get(
              url,
              hs -> {
                List<String> contentLengths = hs.getAll("Content-Length");
                if (!maxFileSize.isPresent()) {
                  return true;
                }
                if (contentLengths.isEmpty()) {
                  return true;
                }
                long contentLength = Long.parseLong(contentLengths.get(0));
                long maxFileSize_ = maxFileSize.get();
                if (contentLength <= maxFileSize_) {
                  return true;
                }
                throw new SizeLimitExceededException(
                    Optional.of(path), contentLength, maxFileSize_);
              });
    } catch (ExecutionException e) {
      Throwable cause = e.getCause();
      if (cause instanceof SizeLimitExceededException) {
        throw (SizeLimitExceededException) cause;
      }
      Log.warn(
          "ExecutionException when fetching project: "
              + projectName
              + ", url: "
              + url
              + ", path: "
              + path,
          e);
      throw new FailedConnectionException();
    }
    if (maxFileSize.isPresent() && contents.length > maxFileSize.get()) {
      throw new SizeLimitExceededException(Optional.of(path), contents.length, maxFileSize.get());
    }
    dbStore.addURLIndexForProject(projectName, getCacheKeyFromUrl(url), path);
    return contents;
  }

  /*
   * Construct a suitable cache key from the given file URL.
   *
   * The file URL returned by the web service may contain a token parameter
   * used for authentication. This token changes for every request, so we
   * need to strip it from the query string before using the URL as a cache
   * key.
   */
  private String getCacheKeyFromUrl(String url) {
    // We're not doing proper URL parsing here, but it should be enough to
    // remove the token without touching the important parts of the URL.
    //
    // The URL looks like:
    //
    // https://history.overleaf.com/api/projects/:project_id/blobs/:hash?token=:token&_path=:path
    return url.replaceAll("token=[^&]*", "token=REMOVED");
  }
}
