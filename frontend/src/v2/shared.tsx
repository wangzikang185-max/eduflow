import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
export type Notify = (message: string, kind?: "success" | "error") => void;
export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const ref = useRef(loader);
  ref.current = loader;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    ref
      .current()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [...deps, revision]);
  return { data, loading, error, reload: () => setRevision((v) => v + 1) };
}
export function State({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
  children: ReactNode;
}) {
  return loading ? (
    <Loading />
  ) : error ? (
    <ErrorState message={error} retry={retry} />
  ) : (
    <>{children}</>
  );
}
export function Title({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="v2-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="v2-actions">{actions}</div>
    </div>
  );
}
export interface Field {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "email"
    | "password"
    | "textarea"
    | "select";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  optional?: boolean;
}
export function Editor({
  title,
  fields,
  initial,
  onSave,
  onClose,
  notify,
}: {
  title: string;
  fields: Field[];
  initial: Record<string, unknown>;
  onSave: (value: Record<string, unknown>) => Promise<unknown>;
  onClose: () => void;
  notify: Notify;
}) {
  const [value, setValue] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={title}
      subtitle="请核对资料后保存。标有 * 的项目为必填。"
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await onSave(value);
            notify("保存成功");
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="v2-form">
          {fields.map((f) => (
            <label key={f.key}>
              {f.label}
              {!f.optional && <em> *</em>}
              {f.type === "select" ? (
                <select
                  required={!f.optional}
                  value={String(value[f.key] ?? "")}
                  onChange={(e) =>
                    setValue({ ...value, [f.key]: e.target.value })
                  }
                >
                  <option value="">请选择</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  maxLength={f.max}
                  required={!f.optional}
                  value={String(value[f.key] ?? "")}
                  onChange={(e) =>
                    setValue({ ...value, [f.key]: e.target.value })
                  }
                />
              ) : (
                <input
                  type={f.type || "text"}
                  required={!f.optional}
                  min={f.type === "number" ? f.min : undefined}
                  max={f.type === "number" ? f.max : undefined}
                  minLength={f.type !== "number" ? f.min : undefined}
                  maxLength={f.type !== "number" ? f.max : undefined}
                  step={f.step}
                  value={String(value[f.key] ?? "")}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      [f.key]:
                        f.type === "number"
                          ? e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              )}
            </label>
          ))}
        </div>
        {error && (
          <p className="v2-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "正在保存…" : "保存"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Confirm({
  title,
  text,
  onConfirm,
  onClose,
  notify,
}: {
  title: string;
  text: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
  notify: Notify;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="v2-note">{text}</p>
      {error && (
        <p className="v2-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <Button disabled={busy} onClick={onClose}>
          取消
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              notify("操作成功");
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "处理中…" : "确认"}
        </Button>
      </div>
    </Modal>
  );
}
export function Table<T>({
  rows,
  columns,
  empty = "暂无数据",
}: {
  rows: T[];
  columns: { title: string; cell: (row: T, index: number) => ReactNode }[];
  empty?: string;
}) {
  return (
    <div className="v2-table-scroll">
      <table className="v2-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c, j) => (
                <td key={j}>{c.cell(row, i)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <Empty title={empty} text="有真实记录后会显示在这里。" />
      )}
    </div>
  );
}
export function Paged<T>({
  rows,
  columns,
}: {
  rows: T[];
  columns: { title: string; cell: (row: T, index: number) => ReactNode }[];
}) {
  const [page, setPage] = useState(1);
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / 20)));
  return (
    <>
      <Table
        rows={rows.slice((current - 1) * 20, current * 20)}
        columns={columns}
      />
      <Pagination
        page={current}
        pageSize={20}
        total={rows.length}
        onChange={setPage}
      />
    </>
  );
}
export const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
export const message = (e: unknown) =>
  e instanceof Error ? e.message : "操作失败";
export const today = () => new Intl.DateTimeFormat("sv-SE").format(new Date());
export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="v2-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
