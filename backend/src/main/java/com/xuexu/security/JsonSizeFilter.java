package com.xuexu.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Limit actual bytes, including chunked bodies. CSV's 2 MiB limit is checked separately. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class JsonSizeFilter extends OncePerRequestFilter {
  private static final int LIMIT = 16 * 1024 * 1024;

  @Override
  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    if (!java.util.Set.of("POST", "PUT", "PATCH").contains(req.getMethod())) {
      chain.doFilter(req, res);
      return;
    }
    if (req.getContentLengthLong() > LIMIT) {
      reject(res);
      return;
    }
    byte[] bytes = req.getInputStream().readNBytes(LIMIT + 1);
    if (bytes.length > LIMIT) {
      reject(res);
      return;
    }
    chain.doFilter(
        new HttpServletRequestWrapper(req) {
          @Override
          public ServletInputStream getInputStream() {
            var input = new ByteArrayInputStream(bytes);
            return new ServletInputStream() {
              public int read() {
                return input.read();
              }

              public int read(byte[] b, int off, int len) {
                return input.read(b, off, len);
              }

              public boolean isFinished() {
                return input.available() == 0;
              }

              public boolean isReady() {
                return true;
              }

              public void setReadListener(ReadListener listener) {
                throw new UnsupportedOperationException("Synchronous request body");
              }
            };
          }

          @Override
          public BufferedReader getReader() {
            return new BufferedReader(
                new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
          }
        },
        res);
  }

  private void reject(HttpServletResponse res) throws IOException {
    res.setStatus(413);
    res.setContentType("application/json;charset=UTF-8");
    res.getWriter().write("{\"code\":0,\"msg\":\"请求体不能超过 16 MiB\",\"data\":null}");
  }
}
