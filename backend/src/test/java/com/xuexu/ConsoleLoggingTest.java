package com.xuexu;

import static org.junit.jupiter.api.Assertions.*;

import ch.qos.logback.classic.AsyncAppender;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.joran.JoranConfigurator;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.Appender;
import ch.qos.logback.core.ConsoleAppender;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ConsoleLoggingTest {
  @TempDir Path logs;

  @Test
  void stalledConsoleDoesNotBlockRequestsOrLoseFileLogs() throws Exception {
    var context = new LoggerContext();
    context.setName("console-stall-regression");
    context.setMDCAdapter(new ch.qos.logback.classic.util.LogbackMDCAdapter());
    context.putProperty("LOG_DIR", logs.toString().replace('\\', '/'));
    var config = new JoranConfigurator();
    config.setContext(context);
    config.doConfigure(getClass().getResource("/logback.xml"));
    Logger root = context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
    ConsoleAppender<ILoggingEvent> console = consoleAppender(root);
    assertNotNull(console, "The runtime logging configuration must expose its console output");
    var blocked = new StalledOutput();
    console.setOutputStream(blocked);
    var worker = Executors.newSingleThreadExecutor();
    try {
      // More events than the console queue can hold, with the terminal never consuming them.
      var request = worker.submit(() -> {
        for (int i = 0; i < 1000; i++) root.info("console-stall-regression event={}", i);
      });
      assertTrue(blocked.entered.await(3, TimeUnit.SECONDS), "The terminal must actually stall");
      request.get(5, TimeUnit.SECONDS);
    } finally {
      blocked.release.countDown();
      worker.shutdownNow();
      worker.awaitTermination(3, TimeUnit.SECONDS);
      context.stop();
    }
    try (var files = Files.walk(logs)) {
      long saved = 0;
      for (Path file : files.filter(Files::isRegularFile).toList()) {
        try (var lines = Files.lines(file)) {
          saved += lines.filter(line -> line.contains("console-stall-regression event=")).count();
        }
      }
      assertEquals(1000, saved, "Every event must still reach the rolling file");
    }
  }

  @SuppressWarnings("unchecked")
  private ConsoleAppender<ILoggingEvent> consoleAppender(Logger root) {
    var outputs = root.iteratorForAppenders();
    while (outputs.hasNext()) {
      Appender<ILoggingEvent> output = outputs.next();
      if (output instanceof ConsoleAppender<?> console) {
        return (ConsoleAppender<ILoggingEvent>) console;
      }
      if (output instanceof AsyncAppender async
          && async.getAppender("STDOUT") instanceof ConsoleAppender<?> console) {
        return (ConsoleAppender<ILoggingEvent>) console;
      }
    }
    return null;
  }

  private static class StalledOutput extends OutputStream {
    final CountDownLatch entered = new CountDownLatch(1);
    final CountDownLatch release = new CountDownLatch(1);

    @Override
    public void write(int value) throws IOException {
      write(new byte[] {(byte) value}, 0, 1);
    }

    @Override
    public void write(byte[] bytes, int offset, int length) throws IOException {
      entered.countDown();
      try {
        release.await();
      } catch (InterruptedException error) {
        Thread.currentThread().interrupt();
        throw new IOException(error);
      }
    }
  }
}
