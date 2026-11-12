let token = '';
export function setToken(value: string) { token = value; }
export async function request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch(path, { method, headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), 'X-Cms-Token': token },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? 'Não foi possível concluir a operação.');
  return body;
}
export async function upload(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter até 5 MB.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file);
  });
  return request<{ path: string }>('/api/media', 'POST', { base64: data });
}
