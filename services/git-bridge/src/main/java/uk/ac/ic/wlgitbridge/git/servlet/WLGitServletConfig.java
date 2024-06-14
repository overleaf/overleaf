package uk.ac.ic.wlgitbridge.git.servlet;

import java.util.Enumeration;
import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import org.eclipse.jetty.servlet.ServletContextHandler;

/*
 * Created by Winston on 02/11/14.
 */
public class WLGitServletConfig implements ServletConfig {

  private static final String SERVLET_NAME = "git-servlet";

  private ServletContext servletContext;

  public WLGitServletConfig(ServletContextHandler ctxHandler) {
    servletContext = ctxHandler.getServletContext();
  }

  @Override
  public String getServletName() {
    return SERVLET_NAME;
  }

  @Override
  public ServletContext getServletContext() {
    return servletContext;
  }

  @Override
  public String getInitParameter(String s) {
    return null;
  }

  @Override
  public Enumeration<String> getInitParameterNames() {
    return null;
  }
}
