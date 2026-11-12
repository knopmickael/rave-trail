import { cloneElement, createContext, isValidElement, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { upload } from './api';
export const UploadActivity = createContext<(active: boolean) => void>(() => {});

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId();
  const control = isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
    ? cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined }) : children;
  return <div className="field"><label htmlFor={id}>{label}</label>{control}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
export function Text({ label, value, onChange, multiline = false, required = true, disabled = false, hint }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; required?: boolean; disabled?: boolean; hint?: string;
}) {
  return <Field label={label} hint={hint}>{multiline
    ? <textarea required={required} value={value} onChange={(e) => onChange(e.target.value)} rows={4} disabled={disabled} />
    : <input required={required} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />}</Field>;
}
export function NumberField({ label, value, onChange, min = 0, max = 100000, step = 1 }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number;
}) {
  return <Field label={label}><input required type="number" min={min} max={max} step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.valueAsNumber)} /></Field>;
}
export function Select({ label, value, options, onChange, empty, disabled = false }: {
  label: string; value: string; options: { id: string; name: string }[]; onChange: (value: string) => void; empty?: string; disabled?: boolean;
}) {
  return <Field label={label}><select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required={empty === undefined}>
    {empty !== undefined && <option value="">{empty}</option>}{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
  </select></Field>;
}
export function MultiSelect({ label, value, options, onChange, hint }: {
  label: string; value: readonly string[]; options: { id: string; name: string }[]; onChange: (value: string[]) => void; hint?: string;
}) {
  return <Field label={label} hint={hint ?? 'Ctrl / ⌘ + clique para selecionar vários.'}><select multiple size={4} value={[...value]} onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => o.value))}>
    {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
  </select></Field>;
}
export function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (path: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [broken, setBroken] = useState(false);
  const mounted = useRef(true);
  const uploadActivity = useContext(UploadActivity);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setBroken(false); }, [value]);
  const inputId = useId();
  return <div className="image-field"><div className="image-preview">{value && !broken ? <img key={value} src={value} alt={`Prévia: ${label}`} onError={() => setBroken(true)} /> : <span aria-hidden="true">◇</span>}</div>
    <div><Text label={label} value={value} required={false} onChange={(v) => { setBroken(false); onChange(v); }} hint="Caminho /media/... ou URL HTTPS" />
      <label className="upload-button" htmlFor={inputId}>{busy ? 'Enviando…' : '↑ Enviar imagem'}<input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async (event) => {
         const file = event.target.files?.[0]; if (!file) return;
         if (!window.confirm(`Enviar e usar a imagem “${file.name}”?`)) { event.target.value = ''; return; }
        setBusy(true); setError(''); uploadActivity(true);
        try { const result = await upload(file); if (mounted.current) { setBroken(false); onChange(result.path); } }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro no upload.'); }
        finally { setBusy(false); event.target.value = ''; uploadActivity(false); }
      }} /></label><small className="muted">PNG, JPEG ou WebP · até 5 MB</small>{error && <p role="alert" className="error">{error}</p>}
    </div></div>;
}
