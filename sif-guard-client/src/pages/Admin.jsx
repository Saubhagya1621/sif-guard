import { useCallback, useEffect, useState } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getModel, getUsers, registerUser, retrain, updateUser } from "../api/reportsApi";
import { ROLES, ROLE_LABELS, SITES } from "../lib/constants";
import { fmtDateTime, pct } from "../lib/format";
import { ErrorState, Field, Label, Meter, PageHeader, SkeletonRows, btnCls, btnPrimaryCls, inputCls } from "../components/ui";

const EMPTY_USER = { name: "", email: "", password: "", role: "hse_officer", siteId: "duliajan" };

function AddUserForm({ onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_USER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < 8) {
      setError({ code: "VALIDATION_ERROR", message: "Password must be at least 8 characters." });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await registerUser({ ...form, siteId: form.role === "site_supervisor" ? form.siteId : null });
      onCreated(user);
      setForm(EMPTY_USER);
      toast.success(`Created ${user.name}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-border pt-4 mt-4">
      <Label>Add user</Label>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <Field label="Name"><input required value={form.name} onChange={set("name")} className={`${inputCls} w-full`} /></Field>
        <Field label="Email"><input required type="email" value={form.email} onChange={set("email")} className={`${inputCls} w-full`} /></Field>
        <Field label="Temporary password"><input required type="password" value={form.password} onChange={set("password")} autoComplete="new-password" className={`${inputCls} w-full`} /></Field>
        <Field label="Role">
          <select value={form.role} onChange={set("role")} className={`${inputCls} w-full`}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </Field>
        {form.role === "site_supervisor" && (
          <Field label="Site">
            <select value={form.siteId} onChange={set("siteId")} className={`${inputCls} w-full`}>
              {SITES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <button type="submit" disabled={busy} className={btnPrimaryCls}>
        {busy ? "Creating…" : "Create user"}
      </button>
      {error && <ErrorState error={error} />}
    </form>
  );
}

function ModelPanel() {
  const toast = useToast();
  const [model, setModel] = useState({ loading: true, error: null, data: null });
  const [phase, setPhase] = useState("idle"); // idle | confirm | running
  const [result, setResult] = useState(null);

  const load = useCallback(() => {
    setModel((m) => ({ ...m, loading: true, error: null }));
    getModel()
      .then((data) => setModel({ loading: false, error: null, data }))
      .catch((error) => setModel({ loading: false, error, data: null }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run() {
    setPhase("running");
    setResult(null);
    try {
      const res = await retrain();
      setResult(res);
      toast.success(`Retrain ${res.status}: model ${res.modelVersion || ""}`);
      load();
    } catch (err) {
      setResult({ status: "failed", error: err });
      toast.error(err.message || "Retrain failed");
    } finally {
      setPhase("idle");
    }
  }

  const m = model.data;
  return (
    <div className="panel p-5">
      <Label>Model operations</Label>
      {model.loading && !m ? (
        <SkeletonRows rows={5} />
      ) : model.error ? (
        <ErrorState error={model.error} onRetry={load} />
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-4">
            <span className="mono text-2xl">{m.modelVersion}</span>
            <span className="mono text-xs text-text-muted">{m.classifier || "classifier"}</span>
          </div>
          <div className="space-y-3 mb-4">
            {[
              ["Accuracy", m.accuracy],
              ["Precision (SIF)", m.precision],
              ["Recall (SIF)", m.recall],
              ["F1 (SIF)", m.f1],
            ].map(([label, v]) => (
              <div key={label}>
                <div className="flex justify-between mono text-xs text-text-muted mb-1">
                  <span>{label}</span>
                  <span className="text-text-primary">{pct(v, 1)}</span>
                </div>
                <Meter value={v} tone="safe" />
              </div>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-y-1 mono text-xs mb-4">
            <dt className="text-text-muted">Last trained</dt>
            <dd>{fmtDateTime(m.lastTrainedAt)}</dd>
            <dt className="text-text-muted">Training samples</dt>
            <dd>{m.trainingSamples}</dd>
            <dt className="text-text-muted">Pending corrections</dt>
            <dd className={m.pendingCorrections ? "text-signal-safe" : ""}>{m.pendingCorrections}</dd>
          </dl>
          <p className="mono text-[11px] text-text-muted mb-3">Metrics on held-out synthetic validation data.</p>
          {phase === "confirm" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono text-xs text-text-muted">Retrain with {m.pendingCorrections} reviewer corrections?</span>
              <button onClick={run} className={btnPrimaryCls}>Confirm</button>
              <button onClick={() => setPhase("idle")} className={btnCls}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setPhase("confirm")} disabled={phase === "running"} className={btnCls}>
              {phase === "running" ? "Retraining…" : "Trigger retrain"}
            </button>
          )}
          {result && !result.error && (
            <p className="mono text-xs text-signal-safe mt-3">
              {result.status} · trained on {result.trainedOn} corrections · {result.modelVersion}
            </p>
          )}
          {result?.error && <ErrorState error={result.error} />}
        </>
      )}
    </div>
  );
}

export default function Admin() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState({ loading: true, error: null, items: [] });

  const load = useCallback(() => {
    setUsers((u) => ({ ...u, loading: true, error: null }));
    getUsers()
      .then((items) => setUsers({ loading: false, error: null, items }))
      .catch((error) => setUsers({ loading: false, error, items: [] }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function change(u, patch) {
    const prev = users.items;
    setUsers((s) => ({ ...s, items: s.items.map((x) => (x.id === u.id ? { ...x, ...patch } : x)) }));
    try {
      const saved = await updateUser(u.id, patch);
      setUsers((s) => ({ ...s, items: s.items.map((x) => (x.id === u.id ? saved : x)) }));
      toast.success(`Updated ${saved.name}`);
    } catch (err) {
      setUsers((s) => ({ ...s, items: prev }));
      toast.error(err.message || "Update failed");
    }
  }

  return (
    <Layout>
      <PageHeader title="Admin" subtitle="User management and model operations." />

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        <div className="panel p-5">
          <Label>Users</Label>
          {users.loading && !users.items.length ? (
            <SkeletonRows rows={5} />
          ) : users.error ? (
            <ErrorState error={users.error} onRetry={load} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-text-muted text-left border-b border-border">
                    <th className="pb-2 font-normal">User</th>
                    <th className="pb-2 font-normal">Role</th>
                    <th className="pb-2 font-normal">Site</th>
                    <th className="pb-2 font-normal">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.items.map((u) => {
                    const self = u.id === me.id;
                    return (
                      <tr key={u.id} className={`border-b border-border last:border-0 ${u.active ? "" : "opacity-50"}`}>
                        <td className="py-2 pr-3">
                          <div>{u.name}{self && <span className="mono text-[10px] text-text-muted ml-2">YOU</span>}</div>
                          <div className="mono text-xs text-text-muted">{u.email}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            value={u.role}
                            disabled={self}
                            aria-label={`Role for ${u.name}`}
                            onChange={(e) =>
                              change(u, e.target.value === "site_supervisor" ? { role: e.target.value, siteId: u.siteId || "duliajan" } : { role: e.target.value })
                            }
                            className={inputCls}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          {u.role === "site_supervisor" ? (
                            <select value={u.siteId || ""} aria-label={`Site for ${u.name}`} onChange={(e) => change(u, { siteId: e.target.value })} className={inputCls}>
                              {SITES.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="mono text-xs text-text-muted">all sites</span>
                          )}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => change(u, { active: !u.active })}
                            disabled={self}
                            aria-pressed={u.active}
                            className={`mono text-xs px-2 py-1 border rounded-sm transition-colors disabled:opacity-50 ${
                              u.active ? "border-signal-safe/60 text-signal-safe" : "border-border text-text-muted"
                            }`}
                          >
                            {u.active ? "ACTIVE" : "DISABLED"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <AddUserForm onCreated={(u) => setUsers((s) => ({ ...s, items: [...s.items, u] }))} />
        </div>

        <ModelPanel />
      </div>
    </Layout>
  );
}
