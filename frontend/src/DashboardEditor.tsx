import { useEffect, useRef, useState, type ReactNode } from 'react';
import { apiURL, movePanel, readResponse, toDocument, type Dashboard, type DashboardDocument, type Panel } from './dashboard';
import { PanelData } from './TablePanel';

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2>{title}</h2>{children}
  </dialog>;
}

export function DashboardDetail({ uid }: { uid: string }) {
  const [saved, setSaved] = useState<Dashboard>();
  const [draft, setDraft] = useState<DashboardDocument>();
  const [editing, setEditing] = useState(false);
  const [panelEditor, setPanelEditor] = useState<Panel>();
  const [dialog, setDialog] = useState<'save' | 'discard' | undefined>();
  const [removeID, setRemoveID] = useState<string>();
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const dirty = !!saved && !!draft && JSON.stringify(toDocument(saved)) !== JSON.stringify(draft);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiURL}/api/v1/dashboards/${uid}`, { signal: controller.signal })
      .then(readResponse<Dashboard>)
      .then((value) => { setSaved(value); setDraft(toDocument(value)); })
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [uid]);

  useEffect(() => {
    if (!dirty && !panelEditor) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, panelEditor]);

  function exitEdit() {
    if (!saved) return;
    setDraft(toDocument(saved)); setEditing(false); setDialog(undefined); setNotice('');
  }

  async function save() {
    if (!draft || saving) return;
    setSaving(true); setSaveError('');
    try {
      const result = await fetch(`${apiURL}/api/v1/dashboards/${uid}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toDocument(draft)),
      }).then(readResponse<Dashboard>);
      setSaved(result); setDraft(toDocument(result)); setDialog(undefined);
      setNotice('대시보드를 저장했습니다.');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : '저장하지 못했습니다.');
    } finally { setSaving(false); }
  }

  if (error) return <main><a href="/dashboards">← Dashboards</a><p role="alert" className="error-message">{error}</p></main>;
  if (!saved || !draft) return <main><p role="status">대시보드를 불러오는 중입니다.</p></main>;

  if (panelEditor) return <PanelEditor key={panelEditor.id} panel={panelEditor}
    onCancel={() => setPanelEditor(undefined)}
    onApply={(panel) => {
      setDraft((current) => current && ({ ...current, panels: current.panels.some((p) => p.id === panel.id)
        ? current.panels.map((p) => p.id === panel.id ? panel : p) : [...current.panels, panel] }));
      setPanelEditor(undefined); setNotice('패널 변경을 적용했습니다. 대시보드를 저장하면 DB에 반영됩니다.');
    }} />;

  const visible = editing ? draft : saved;
  return <main className="dashboard-workspace">
    <nav className="workspace-toolbar">
      <a href="/dashboards">Dashboards</a><span>/ {visible.title}</span>
      <div className="toolbar-actions">
        {editing ? <>
          <span className="edit-badge">{dirty ? 'Unsaved changes' : 'Edit mode'}</span>
          <button disabled={draft.panels.length >= 20} onClick={() => setPanelEditor({ id: crypto.randomUUID(), type: 'table', title: 'New panel', sql: 'SELECT 1 AS "값"' })}>+ Add panel</button>
          <button className="primary" onClick={() => { setSaveError(''); setDialog('save'); }}>Save dashboard</button>
          <button onClick={() => dirty ? setDialog('discard') : exitEdit()}>Exit edit</button>
        </> : <button onClick={() => { setDraft(toDocument(saved)); setEditing(true); setNotice(''); }}>Edit</button>}
      </div>
    </nav>
    <header className="dashboard-heading"><p className="eyebrow">{uid}</p><h1>{visible.title}</h1><p>{visible.description}</p></header>
    {notice && <p role="status" className="notice">{notice}</p>}
    {visible.panels.length === 0 && <section className="panel"><h2>아직 추가된 패널이 없습니다</h2><p>Edit에서 Add panel을 눌러 표를 추가할 수 있습니다.</p></section>}
    {visible.panels.map((panel, index) => <section key={panel.id} className="panel" aria-label={panel.title}>
      <div className="panel-heading"><h2>{panel.title}</h2>
        {editing && <div className="panel-actions">
          <button aria-label={`${panel.title} 위로 이동`} disabled={index === 0} onClick={() => setDraft({ ...draft, panels: movePanel(draft.panels, panel.id, -1) })}>↑</button>
          <button aria-label={`${panel.title} 아래로 이동`} disabled={index === draft.panels.length - 1} onClick={() => setDraft({ ...draft, panels: movePanel(draft.panels, panel.id, 1) })}>↓</button>
          <button onClick={() => setPanelEditor({ ...panel })}>Edit panel</button>
          <button onClick={() => setRemoveID(panel.id)}>Remove</button>
        </div>}
      </div>
      <PanelData sql={panel.sql} />
    </section>)}
    {dialog === 'save' && <Dialog title="Save dashboard" onClose={() => { if (!saving) setDialog(undefined); }}>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <label>Title<input autoFocus value={draft.title} disabled={saving} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>Description<textarea value={draft.description} disabled={saving} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <p>패널 {draft.panels.length}개의 제목, SQL, 순서를 저장합니다.</p>
        {saveError && <p role="alert" className="error-message">{saveError}</p>}
        <div className="dialog-actions"><button type="button" disabled={saving} onClick={() => setDialog(undefined)}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Dialog>}
    {dialog === 'discard' && <Dialog title="Discard changes?" onClose={() => setDialog(undefined)}>
      <p>저장하지 않은 변경을 버리고 마지막 저장 상태로 돌아갑니다.</p>
      <div className="dialog-actions"><button onClick={() => setDialog(undefined)}>Continue editing</button><button onClick={exitEdit}>Discard</button></div>
    </Dialog>}
    {removeID && <Dialog title="Remove panel?" onClose={() => setRemoveID(undefined)}>
      <p>이 패널을 대시보드에서 제거합니다. DB에는 대시보드를 저장한 뒤 반영됩니다.</p>
      <div className="dialog-actions"><button onClick={() => setRemoveID(undefined)}>Cancel</button><button onClick={() => { setDraft({ ...draft, panels: draft.panels.filter((p) => p.id !== removeID) }); setRemoveID(undefined); }}>Remove panel</button></div>
    </Dialog>}
  </main>;
}

export function PanelEditor({ panel, onApply, onCancel }: { panel: Panel; onApply: (panel: Panel) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...panel });
  const [preview, setPreview] = useState({ sql: panel.sql, run: 0 });
  const [error, setError] = useState('');
  return <main className="dashboard-workspace">
    <nav className="workspace-toolbar"><strong>Edit panel</strong><div className="toolbar-actions">
      <button onClick={onCancel}>Discard panel changes</button>
      <button className="primary" onClick={() => {
        if (!form.title.trim() || !form.sql.trim()) { setError('패널 제목과 SQL을 입력해 주세요.'); return; }
        onApply(form);
      }}>Apply</button>
    </div></nav>
    <div className="panel-editor-layout">
      <div>
        <section className="panel preview"><h2>{form.title || 'New panel'}</h2><PanelData key={preview.run} sql={preview.sql} /></section>
        <section className="panel query-editor"><div className="panel-heading"><h2>Queries</h2><button onClick={() => setPreview({ sql: form.sql, run: preview.run + 1 })}>Run query</button></div>
          <p className="muted">Data source: PostgreSQL / Format: Table</p>
          <label>SQL<textarea spellCheck={false} value={form.sql} onChange={(event) => setForm({ ...form, sql: event.target.value })} /></label>
          <p className="muted">Run query를 누르면 작성한 SQL로 미리보기를 갱신합니다.</p>
        </section>
      </div>
      <aside className="panel panel-options"><h2>Panel options</h2><p>Visualization: Table</p>
        <label>Panel title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        {error && <p role="alert" className="error-message">{error}</p>}
        <p className="muted">Apply는 편집 중인 대시보드에만 반영합니다. DB 저장은 Save dashboard에서 진행합니다.</p>
      </aside>
    </div>
  </main>;
}
