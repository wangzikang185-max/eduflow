package com.xuexu.service;

import static com.xuexu.mapper.WorkspaceSql.AUDIT_ADD;
import static com.xuexu.mapper.WorkspaceStore.p;

import com.xuexu.mapper.WorkspaceStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class AuditService {
  private final WorkspaceStore db;

  public AuditService(WorkspaceStore db) {
    this.db = db;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void record(
      String operator,
      String action,
      String target,
      String targetId,
      int status,
      String before,
      String after) {
    db.write(
        AUDIT_ADD,
        p(
            "id",
            Rules.id(),
            "operatorId",
            operator,
            "action",
            action,
            "targetType",
            target,
            "targetId",
            targetId,
            "beforeData",
            before,
            "afterData",
            "{\"httpStatus\":" + status + ",\"record\":" + after + "}",
            "result",
            status < 400 ? "SUCCESS" : "FAILURE",
            "message",
            "HTTP " + status));
  }
}
