package uk.ac.ic.wlgitbridge.application;

import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Created by Winston on 16/11/14.
 */
public class SnapshotPushPostbackHandler extends AbstractHandler {

    @Override
    public void handle(String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
//                System.out.println("handling");
//                System.out.println(request.getMethod());
//                response.setContentType("text/html;charset=utf-8");
//                response.setStatus(HttpServletResponse.SC_OK);
        baseRequest.setHandled(false);
        if (request.getMethod().equals("POST") && request.getPathInfo().endsWith("postback")) {
            System.out.println(request.getHeaderNames());
        }

//        System.out.println(request.getRemoteAddr());
//        System.out.println("method: " + request.getMethod());
//        System.out.println("pathInfo: " + request.getPathInfo());
//        System.out.println("contextPath: " + request.getContextPath());
//        System.out.println("pathtranslated: " + request.getPathTranslated());
//        System.out.println("queryString: " + request.getQueryString());
//        System.out.println("remoteUser: " + request.getRemoteUser());
//        System.out.println("requestURI: " + request.getRequestURI());
//                response.getWriter().println("<h1>Hello World</h1>");
    }

}
