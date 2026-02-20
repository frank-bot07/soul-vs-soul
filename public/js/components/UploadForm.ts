/** Custom agent upload form */
import { h, render } from '../dom.js';
import * as api from '../lib/api.js';

export function UploadForm(container: HTMLElement, onCreated?: () => void): void {
  let fileName = '';
  let fileContent = '';
  let agentName = '';
  let error = '';
  let submitting = false;

  function renderForm(): void {
    const form = h('div', { class: 'upload-form', role: 'form', 'aria-label': 'Upload custom agent' });

    const nameInput = h('input', {
      type: 'text',
      placeholder: 'Agent name (1-50 characters)',
      'aria-label': 'Agent name',
      maxlength: '50',
    }) as HTMLInputElement;
    nameInput.value = agentName;
    nameInput.addEventListener('input', () => { agentName = nameInput.value; });

    const dropZone = h('div', {
      class: 'drop-zone',
      role: 'button',
      tabindex: '0',
      'aria-label': 'Drop a .md file here or click to upload',
    }, fileName ? `📄 ${fileName}` : '📁 Drop .md file here or click to browse');

    const fileInput = h('input', { type: 'file', accept: '.md,.txt', hidden: '' }) as HTMLInputElement;
    fileInput.style.display = 'none';

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = (e as DragEvent).dataTransfer?.files[0];
      if (file) handleFile(file);
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) handleFile(file);
    });

    form.append(nameInput, dropZone, fileInput);

    if (fileContent) {
      const preview = h('div', { class: 'preview', 'aria-label': 'File preview' });
      preview.textContent = fileContent.slice(0, 500);
      form.append(preview);
    }

    if (error) {
      form.append(h('p', { class: 'error', role: 'alert' }, error));
    }

    const submitBtn = h('button', {
      class: 'btn btn-primary',
      type: 'button',
      'aria-label': 'Create agent',
      ...((!agentName || !fileContent || submitting) ? { disabled: '' } : {}),
    }, submitting ? 'Creating…' : '🚀 Create Agent');

    if (!agentName || !fileContent || submitting) {
      submitBtn.setAttribute('disabled', '');
    }

    submitBtn.addEventListener('click', handleSubmit);
    form.append(h('div', { class: 'picker-actions' }, submitBtn));

    render(container, form);
  }

  function handleFile(file: File): void {
    if (file.size > 10240) {
      error = 'File too large (max 10KB)';
      renderForm();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      fileContent = reader.result as string;
      fileName = file.name;
      error = '';
      renderForm();
    };
    reader.readAsText(file);
  }

  async function handleSubmit(): Promise<void> {
    if (!agentName || agentName.length > 50 || !fileContent) return;
    submitting = true;
    error = '';
    renderForm();
    try {
      await api.createAgent(agentName, fileContent);
      onCreated?.();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create agent';
    } finally {
      submitting = false;
      renderForm();
    }
  }

  renderForm();
}
