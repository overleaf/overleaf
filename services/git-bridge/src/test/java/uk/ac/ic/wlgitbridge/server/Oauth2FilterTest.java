package uk.ac.ic.wlgitbridge.server;

import org.junit.Assert;
import org.junit.Test;

public class Oauth2FilterTest {

  @Test
  public void parseErrorCode_returnsTokenExpired_whenBodyContainsIt() {
    String body = "{\"error\":\"invalid_token\",\"error_code\":\"token_expired\"}";
    Assert.assertEquals("token_expired", Oauth2Filter.parseErrorCode(body));
  }

  @Test
  public void parseErrorCode_returnsTokenInvalid_whenBodyContainsIt() {
    String body = "{\"error\":\"invalid_token\",\"error_code\":\"token_invalid\"}";
    Assert.assertEquals("token_invalid", Oauth2Filter.parseErrorCode(body));
  }

  @Test
  public void parseErrorCode_returnsNull_whenErrorCodeFieldIsMissing() {
    String body = "{\"error\":\"invalid_token\"}";
    Assert.assertNull(Oauth2Filter.parseErrorCode(body));
  }

  @Test
  public void parseErrorCode_returnsNull_whenBodyIsNull() {
    Assert.assertNull(Oauth2Filter.parseErrorCode(null));
  }

  @Test
  public void parseErrorCode_returnsNull_whenBodyIsEmpty() {
    Assert.assertNull(Oauth2Filter.parseErrorCode(""));
  }

  @Test
  public void parseErrorCode_returnsNull_whenBodyIsNotJson() {
    Assert.assertNull(Oauth2Filter.parseErrorCode("not json at all"));
  }

  @Test
  public void parseErrorCode_returnsNull_whenBodyIsJsonArray() {
    Assert.assertNull(Oauth2Filter.parseErrorCode("[1, 2, 3]"));
  }

  @Test
  public void parseErrorCode_returnsNull_whenErrorCodeFieldIsJsonNull() {
    String body = "{\"error\":\"invalid_token\",\"error_code\":null}";
    Assert.assertNull(Oauth2Filter.parseErrorCode(body));
  }
}
