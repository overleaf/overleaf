package uk.ac.ic.wlgitbridge.application;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;

/**
 * Created by Winston on 16/11/14.
 */
public class SnapshotPushPostbackHandler extends AbstractHandler {

    private final WriteLatexDataSource writeLatexDataSource;

    public SnapshotPushPostbackHandler(WriteLatexDataSource writeLatexDataSource) {
        this.writeLatexDataSource = writeLatexDataSource;
    }

    @Override
    public void handle(String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
//                System.out.println("handling");
//                System.out.println(request.getMethod());
//                response.setContentType("text/html;charset=utf-8");
//                response.setStatus(HttpServletResponse.SC_OK);
        if (request.getMethod().equals("POST") && request.getPathInfo().endsWith("postback")) {
            BufferedReader reader = request.getReader();
            StringBuilder sb = new StringBuilder();
            for (String line; (line = reader.readLine()) != null; ) {
                sb.append(line);
            }
            String data = sb.toString();
            JsonObject dataObj = new Gson().fromJson(data, JsonObject.class);
            System.out.println(request.getRequestURI());
            writeLatexDataSource.postbackReceivedSuccessfully(request.getRequestURI().split("/")[1]);
            baseRequest.setHandled(true);
        }
    }

}
