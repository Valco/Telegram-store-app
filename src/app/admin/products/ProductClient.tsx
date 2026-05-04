'use client';

import { useState, useRef } from 'react';
import { createProduct, deleteProduct, updateProduct, publishToTelegram, bulkUpdateProducts, generateSMMForProduct } from './actions';
import { processMultiplePhotosWithPhotoroom, generateProductTextWithClaude, fetchBase64FromUrl, extractImageFromProductUrl } from './ai';

type SmmModalState = null | {
  productId: string;
  productName: string;
  step: 'confirm' | 'generating' | 'success' | 'error';
  stats?: any;
  error?: string;
};

export default function ProductClient({ products, categories, initialPrompts, isAdmin, hasAI = true, hasSMM = true }: { products: any[], categories: any[], initialPrompts: any[], isAdmin?: boolean, hasAI?: boolean, hasSMM?: boolean }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [publishingProduct, setPublishingProduct] = useState<any>(null);
  const [deletingProduct, setDeletingProduct] = useState<any>(null);
  const [smmModal, setSmmModal] = useState<SmmModalState>(null);

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [previewExtractionImage, setPreviewExtractionImage] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  const [prompts] = useState(initialPrompts || []);
  const [aiTheme, setAiTheme] = useState(initialPrompts?.[0]?.id || 'none');
  const [processedImageUrls, setProcessedImageUrls] = useState<string[]>([]);
  const [localFilesCreate, setLocalFilesCreate] = useState<File[]>([]);
  const [localFilesEdit, setLocalFilesEdit] = useState<File[]>([]);
  const [aiOriginalBase64ForClaude, setAiOriginalBase64ForClaude] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const bulkFormRef = useRef<HTMLFormElement>(null);

  // Called when closing modals to clean up
  const closeModals = () => {
    setIsCreateOpen(false);
    setEditingProduct(null);
    setEditImages([]);
    setProcessedImageUrls([]);
    setLocalFilesCreate([]);
    setLocalFilesEdit([]);
    setAiOriginalBase64ForClaude('');
    setSourceUrl('');
    setPreviewExtractionImage(null);
    setError('');
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    formData.delete('images');
    if (processedImageUrls.length > 0) {
      formData.append('aiImageUrls', JSON.stringify(processedImageUrls));
    }

    if (localFilesCreate.length > 0) {
      localFilesCreate.forEach(f => formData.append('images', f));
    }

    // Convert local browser time into absolute UTC ISO before sending to server
    const sched = formData.get('scheduledPublishAt') as string;
    if (sched) formData.set('scheduledPublishAt', new Date(sched).toISOString());

    const res = await createProduct(formData);
    if (res.success) {
      closeModals();
    } else {
      setError(res.error || 'Помилка');
    }
    setLoading(false);
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    formData.delete('images');

    const urlsToKeep = [...new Set([...editImages, ...processedImageUrls])];
    formData.append('aiImageUrls', JSON.stringify(urlsToKeep));

    if (localFilesEdit.length > 0) {
      localFilesEdit.forEach(f => formData.append('images', f));
    }

    // Convert local browser time into absolute UTC ISO before sending to server
    const sched = formData.get('scheduledPublishAt') as string;
    if (sched) formData.set('scheduledPublishAt', new Date(sched).toISOString());

    const res = await updateProduct(editingProduct.id, formData);
    if (res.success) {
      closeModals();
    } else {
      setError(res.error || 'Помилка');
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    const res = await deleteProduct(id);
    if (!res.success) {
      alert(res.error);
    } else {
      setDeletingProduct(null);
    }
    setLoading(false);
  };

  const handlePublishTG = (id: string, name: string) => {
    setPublishingProduct({ id, name });
    setError('');
    setSuccessMsg('');
  };

  const confirmPublishTG = async (id: string) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const res = await publishToTelegram(id);
    if (res.success) {
      setSuccessMsg('Товар успішно опубліковано в Telegram!');
    } else {
      setError(res.error || 'Помилка');
    }
    setLoading(false);
  };

  const handleGenerateSMMClick = (product: any) => {
    setSmmModal({
      productId: product.id,
      productName: product.name,
      step: 'confirm'
    });
  };

  const confirmGenerateSMM = async () => {
    if (!smmModal) return;
    setSmmModal(prev => prev ? { ...prev, step: 'generating' } : null);
    
    const res = await generateSMMForProduct(smmModal.productId);
    
    if (res.success) {
      setSmmModal(prev => prev ? { ...prev, step: 'success', stats: res.stats } : null);
    } else {
      setSmmModal(prev => prev ? { ...prev, step: 'error', error: res.error || 'Помилка генерації SMM' } : null);
    }
  };

  const handleExtractUrl = async (form: HTMLFormElement | null, isEdit = false) => {
    if (!form) return;
    const formData = new FormData(form);
    const url = formData.get('sourceUrl') as string;

    if (!url) {
      alert("Введіть посилання на сторонній сайт в поле 'Посилання на товар (джерело)'!");
      return;
    }

    setAiLoading(true);
    setError('');
    setSuccessMsg('⏳ Шукаємо фотографію на сторінці...');

    try {
      const extractRes = await extractImageFromProductUrl(url);
      if (!extractRes.success || !extractRes.imageUrl) throw new Error(extractRes.error);

      setPreviewExtractionImage(extractRes.imageUrl);
      setSuccessMsg('✅ Зображення знайдено! Будь ласка, перегляньте його нижче та підтвердіть обробку (видалення фону).');
    } catch (e: any) {
      setError(e.message || 'Не вдалося знайти фото на сторінці. Перевірте URL або завантажте фото вручну.');
      setSuccessMsg('');
    } finally {
      setAiLoading(false);
    }
  };

  const handleConfirmExtraction = async (form: HTMLFormElement | null, isEdit = false) => {
    if (!form || !previewExtractionImage) return;
    const formData = new FormData(form);
    const name = formData.get('name') as string;

    setAiLoading(true);
    setError('');
    setSuccessMsg('⏳ Завантажуємо зображення з URL...');

    try {
      const fetchRes = await fetchBase64FromUrl(previewExtractionImage);
      if (!fetchRes.success || !fetchRes.file) throw new Error(fetchRes.error);

      setSuccessMsg('✨ AI: Видаляємо фон та обробляємо фотографію...');
      const fd = new FormData();

      // Convert { base64, type, name } back to Blob for FormData
      const byteCharacters = atob(fetchRes.file.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: fetchRes.file.type });

      fd.append('images', blob, fetchRes.file.name);

      const photoResRaw = await fetch('/api/ai/photoroom', { method: 'POST', body: fd });

      if (!photoResRaw.ok) {
        let errorMsg = `Помилка API (${photoResRaw.status})`;
        try {
          const errData = await photoResRaw.json();
          if (errData.error) errorMsg = errData.error;
        } catch(e) {
          const errorText = await photoResRaw.text();
          if (photoResRaw.status === 413 || errorText.includes('<html')) {
            errorMsg = 'Файл занадто великий для вашого Nginx сервера (попередня обробка). Будь ласка, збільшіть client_max_body_size або оберіть фото меншого розміру (до 1 МБ).';
          }
        }
        throw new Error(errorMsg);
      }

      const photoRes = await photoResRaw.json();
      let finalImgUrls: string[] = [];
      if (photoRes.success && photoRes.urls) {
        finalImgUrls = photoRes.urls;
        if (isEdit) {
          setEditImages(prev => [...prev, ...finalImgUrls]);
        } else {
          setProcessedImageUrls(prev => [...prev, ...finalImgUrls]);
        }
      } else {
        throw new Error(photoRes.error || 'Помилка обробки фото Photoroom');
      }

      setSuccessMsg('✨ AI: Генеруємо креативний текст по фото (Claude)...');
      const promptTheme = aiTheme === 'none' && prompts.length > 0 ? prompts[0].id : aiTheme;

      const compressedBase64 = await compressImageForClaude(finalImgUrls[0]);
      const textResRaw = await fetch('/api/ai/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Товар з інтернету',
          themeId: promptTheme,
          imageUrl: finalImgUrls[0],
          clientBase64Image: compressedBase64
        })
      });
      const textRes = await textResRaw.json();

      if (textRes.success && textRes.text) {
        const descEl = form.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
        if (descEl) descEl.value = textRes.text;
        setSuccessMsg('✅ Магія завершена! Товар опрацьовано та готовий до публікації!');
      } else {
        if (aiTheme !== 'none') {
          throw new Error(textRes.error || 'Помилка генерації тексту (Claude API)');
        }
        setSuccessMsg('✅ Фон видалено! (Генерація тексту вимкнена)');
      }
      setPreviewExtractionImage(null); // Clear preview on success
    } catch (e: any) {
      setError(e.message || 'Сталася помилка AI');
      setSuccessMsg('');
    } finally {
      setAiLoading(false);
    }
  };

  // --- Helpers for API interacting ---

  const compressImageForClaude = async (source: string | File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX = 1024; // Claude 3.5 doesn't need huge resolution for text analysis
          let w = img.width, h = img.height;
          if (w > h && w > MAX) { h *= MAX / w; w = MAX; }
          else if (h > MAX) { w *= MAX / h; h = MAX; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Fill white background in case of transparent PNG
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
          }
          resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
        } catch (err) {
          reject('Canvas parsing error: ' + err);
        }
      };

      img.onerror = () => reject('Failed to load image for compression');

      if (typeof source === 'string') {
        img.src = source;
      } else {
        const reader = new FileReader();
        reader.onload = e => { img.src = e.target?.result as string; };
        reader.onerror = reject;
        reader.readAsDataURL(source);
      }
    });
  };

  const handleAIMagic = async (form: HTMLFormElement | null, isEdit = false) => {
    if (!form) return;
    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const files = isEdit ? localFilesEdit : localFilesCreate;

    if (!name) {
      alert("Будь ласка, введіть 'Назву Товару', щоб AI зміг згенерувати опис на її основі!");
      return;
    }

    setAiLoading(true);
    setError('');

    try {
      let finalImgUrls = processedImageUrls.length > 0 ? processedImageUrls : (isEdit ? editingProduct?.images : []);

      const hasValidFiles = files.some(f => f.size > 0);

      // Process images only if new files are selected and not yet processed
      if (hasValidFiles && processedImageUrls.length === 0) {
        console.log('CLIENT: Starting Photoroom processing');
        setSuccessMsg('✨ AI: Видаляємо фон та обробляємо фотографії...');

        // Use FormData instead of base64 to avoid Next.js Server Actions crash

        const validFiles = files.filter(f => f.size > 0);
        const fd = new FormData();
        validFiles.forEach(f => fd.append('images', f));

        const photoResRaw = await fetch('/api/ai/photoroom', { method: 'POST', body: fd });

        if (!photoResRaw.ok) {
          const errorText = await photoResRaw.text();
          if (photoResRaw.status === 413 || errorText.includes('<html')) {
            throw new Error('Файл занадто великий для сервера Nginx. Будь ласка, оберіть фото до 1 МБ або пропишіть client_max_body_size 50M .');
          }
          throw new Error('Помилка сервера');
        }

        const photoRes = await photoResRaw.json();
        if (photoRes.success && photoRes.urls) {
          finalImgUrls = photoRes.urls;
          setProcessedImageUrls(finalImgUrls);
        } else {
          throw new Error(photoRes.error || 'Помилка обробки фото Photoroom');
        }
      }

      if (!finalImgUrls || finalImgUrls.length === 0) {
        throw new Error("Немає фотографій для аналізу. Завантажте фото!");
      }

      console.log('CLIENT: Starting Claude processing...', { name, aiTheme, firstUrl: finalImgUrls[0] });
      setSuccessMsg('✨ AI: Генеруємо креативний текст по першому фото (Claude)...');

      // Compress the actual uploaded image locally to avoid the 5MB API limit of Claude Vision
      let clientBase64ForClaude: string | undefined;
      try {
        const firstFile = files.find(f => f.size > 0);
        if (firstFile) {
          clientBase64ForClaude = await compressImageForClaude(firstFile);
        } else if (aiOriginalBase64ForClaude) {
          clientBase64ForClaude = aiOriginalBase64ForClaude;
        } else if (finalImgUrls.length > 0) {
          clientBase64ForClaude = await compressImageForClaude(finalImgUrls[0]);
        }
      } catch (err) {
        console.warn('Could not pre-compress image for Claude on client-side, falling back to server disk version.', err);
      }

      let textRes;
      const apiBody: any = { name, themeId: aiTheme, imageUrl: finalImgUrls[0] };
      if (clientBase64ForClaude) {
        console.log('CLIENT: Calling Claude API (with local file)', clientBase64ForClaude.length);
        apiBody.clientBase64Image = clientBase64ForClaude;
      } else {
        console.log('CLIENT: Calling Claude API (only URL)');
      }

      const textResRaw = await fetch('/api/ai/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody)
      });
      textRes = await textResRaw.json();

      console.log('CLIENT: API Returned successfully.');
      console.log('CLIENT: Claude response:', textRes);
      if (textRes.success) {
        // Find text area and replace its content
        const descEl = form.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
        if (descEl) {
          descEl.value = textRes.text;
        }
        setSuccessMsg('✨ Можете редагувати текст та зберігати.');
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        throw new Error(textRes.error || 'Помилка генерації тексту');
      }

    } catch (e: any) {
      console.error('CLIENT: handleAIMagic Exception:', e);
      setError(e.message);
      setSuccessMsg('');
    }
    setAiLoading(false);
  };

  const handleAddNewPhotosAI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setAiLoading(true);
    setError('');
    setSuccessMsg('✨ AI: Видаляємо фон та обробляємо фотографії...');

    try {
      // Show preview immediately
      setLocalFilesEdit(prev => [...prev, ...files]);

      const firstValidFile = files.find(f => f.size > 0);
      if (firstValidFile) {
        try {
          const compBase64 = await compressImageForClaude(firstValidFile);
          setAiOriginalBase64ForClaude(compBase64);
        } catch (e) { }
      }

      const fd = new FormData();
      files.forEach(f => fd.append('images', f));

      const photoResRaw = await fetch('/api/ai/photoroom', { method: 'POST', body: fd });

      if (!photoResRaw.ok) {
        const errorText = await photoResRaw.text();
        if (photoResRaw.status === 413 || errorText.includes('<html')) {
          throw new Error('Файл занадто великий для Nginx сервера! Збільшіть client_max_body_size 50M; у конфігурації Nginx.');
        }
        throw new Error('Помилка сервера');
      }

      const photoRes = await photoResRaw.json();
      if (photoRes.success && photoRes.urls) {
        setEditImages(prev => [...prev, ...photoRes.urls]);
        setLocalFilesEdit(prev => prev.filter(f => !files.includes(f)));
        setSuccessMsg('✅ Додаткові фото успішно завантажено та оброблено!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setLocalFilesEdit(prev => prev.filter(f => !files.includes(f)));
        throw new Error(photoRes.error || 'Помилка обробки фото Photoroom');
      }
    } catch (err: any) {
      setError(err.message || 'Помилка обробки');
      setSuccessMsg('');
    } finally {
      setAiLoading(false);
      e.target.value = ''; // reset input
    }
  };

  const handleAIMagicOnlyText = async (form: HTMLFormElement | null) => {
    if (!form || !editingProduct) return;
    const formData = new FormData(form);
    const name = formData.get('name') as string;

    if (!name) {
      alert("Будь ласка, введіть 'Назву Товару', щоб AI зміг згенерувати опис на її основі!");
      return;
    }

    setAiLoading(true);
    setError('');

    try {
      let targetUrl = editImages.length > 0 ? editImages[0] : null;

      if (!targetUrl) throw new Error("Немає фотографій для генерації тексту");

      setSuccessMsg('✨ AI: Переписуємо текст по першому потореному фото (Claude)...');

      const compressedBase64 = aiOriginalBase64ForClaude || await compressImageForClaude(targetUrl);
      const textResRaw = await fetch('/api/ai/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, themeId: aiTheme, imageUrl: targetUrl, clientBase64Image: compressedBase64 })
      });
      const textRes = await textResRaw.json();

      if (textRes.success && textRes.text) {
        const descEl = form.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
        if (descEl) descEl.value = textRes.text;
        setSuccessMsg('✨ Текст успішно перегенеровано!');
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        throw new Error(textRes.error || 'Помилка генерації тексту');
      }
    } catch (e: any) {
      setError(e.message);
      setSuccessMsg('');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddNewPhotosAICreate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setAiLoading(true);
    setError('');
    setSuccessMsg('✨ AI: Видаляємо фон та обробляємо фотографії...');

    try {
      // Show preview immediately
      setLocalFilesCreate(prev => [...prev, ...files]);

      const firstValidFile = files.find(f => f.size > 0);
      if (firstValidFile) {
        try {
          const compBase64 = await compressImageForClaude(firstValidFile);
          setAiOriginalBase64ForClaude(compBase64);
        } catch (e) { }
      }

      const fd = new FormData();
      files.forEach(f => fd.append('images', f));

      const photoResRaw = await fetch('/api/ai/photoroom', { method: 'POST', body: fd });

      if (!photoResRaw.ok) {
        const errorText = await photoResRaw.text();
        if (photoResRaw.status === 413 || errorText.includes('<html')) {
          throw new Error('Файл занадто великий для сервера Nginx! Збільшіть client_max_body_size 50M; у конфігурації Nginx.');
        }
        throw new Error(`Помилка API (${photoResRaw.status})`);
      }

      const photoRes = await photoResRaw.json();
      if (photoRes.success && photoRes.urls) {
        setProcessedImageUrls(prev => [...prev, ...photoRes.urls]);
        setLocalFilesCreate(prev => prev.filter(f => !files.includes(f)));
        setSuccessMsg('✅ Додаткові фото успішно завантажено та оброблено!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setLocalFilesCreate(prev => prev.filter(f => !files.includes(f)));
        throw new Error(photoRes.error || 'Помилка обробки фото Photoroom');
      }
    } catch (err: any) {
      setError(err.message || 'Помилка обробки');
      setSuccessMsg('');
    } finally {
      setAiLoading(false);
      e.target.value = ''; // reset input
    }
  };

  const handleAIMagicOnlyTextCreate = async (form: HTMLFormElement | null) => {
    if (!form) return;
    const formData = new FormData(form);
    const name = formData.get('name') as string;

    if (!name) {
      alert("Будь ласка, введіть 'Назву Товару', щоб AI зміг згенерувати опис на її основі!");
      return;
    }

    setAiLoading(true);
    setError('');

    try {
      let targetUrl = processedImageUrls.length > 0 ? processedImageUrls[0] : null;

      if (!targetUrl) throw new Error("Немає фотографій для генерації тексту. Спочатку знайдіть або обробіть фото.");

      setSuccessMsg('✨ AI: Переписуємо текст по першому потореному фото (Claude)...');

      const compressedBase64 = aiOriginalBase64ForClaude || await compressImageForClaude(targetUrl);
      const textResRaw = await fetch('/api/ai/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, themeId: aiTheme, imageUrl: targetUrl, clientBase64Image: compressedBase64 })
      });
      const textRes = await textResRaw.json();

      if (textRes.success && textRes.text) {
        const descEl = form.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
        if (descEl) descEl.value = textRes.text;
        setSuccessMsg('✨ Текст успішно перегенеровано!');
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        throw new Error(textRes.error || 'Помилка генерації тексту');
      }
    } catch (e: any) {
      setError(e.message);
      setSuccessMsg('');
    } finally {
      setAiLoading(false);
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const updates = {
      price: formData.get('price'),
      stock: formData.get('stock'),
      status: formData.get('status')
    };
    const res = await bulkUpdateProducts(selectedIds, updates);
    if (res.success) {
      setSelectedIds([]);
      setBulkActionOpen(false);
    } else {
      alert(res.error);
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(p => {
    if (searchQuery.length < 4) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (p: number) => {
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedProducts.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <input
          type="text"
          placeholder="Пошук (назва, артикул, опис) від 4 символів..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          onClick={() => setIsCreateOpen(true)}
          className="bg-indigo-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20"
        >
          + Додати Товар
        </button>
      </div>

      <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-2xl mb-4 text-sm text-neutral-400">
        <div className="flex items-center gap-3">
          <span>Показувати по:</span>
          <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:border-indigo-500 cursor-pointer transition">
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-1.5 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition">←</button>
          <span>Сторінка {currentPage} з {totalPages}</span>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-4 py-1.5 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition">→</button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-x-auto">
        <table className="w-full text-left text-sm text-neutral-400 min-w-[900px]">
          <thead className="bg-white/5 text-neutral-300 text-xs uppercase tracking-wider border-b border-white/10">
            <tr>
              <th className="px-4 py-4 w-10">
                <input type="checkbox" className="w-4 h-4 rounded bg-black/50 border-white/20 accent-indigo-500 cursor-pointer" onChange={toggleSelectAll} checked={paginatedProducts.length > 0 && selectedIds.length === paginatedProducts.length} />
              </th>
              <th className="px-4 py-4 font-semibold">Артикул / Назва</th>
              <th className="px-4 py-4 font-semibold">Базова Ціна</th>
              <th className="px-4 py-4 font-semibold">Telegram</th>
              <th className="px-4 py-4 font-semibold">Залишок</th>
              <th className="px-4 py-4 font-semibold">Статус</th>
              <th className="px-4 py-4 font-semibold text-right">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedProducts.map((p) => (
              <tr key={p.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-4">
                  <input type="checkbox" className="w-4 h-4 rounded bg-black/50 border-white/20 accent-indigo-500 cursor-pointer" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                </td>
                <td className="px-4 py-4 flex items-center gap-4">
                  {p.images && p.images.length > 0 ? (
                    <img src={`/api/file?path=${p.images[0]}`} alt={p.name} className="w-12 h-12 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center text-lg flex-shrink-0">📦</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] text-neutral-500 mb-0.5 tracking-wider">{p.sku || 'БЕЗ-АРТИКУЛУ'}</div>
                    <div className="text-white font-bold max-w-[250px] truncate" title={p.name}>{p.name}</div>
                    <div className="text-xs text-indigo-400 mt-0.5 truncate">{p.category?.name || 'Без категорії'}</div>
                  </div>
                </td>
                <td className="px-4 py-4 font-mono text-emerald-400 font-bold whitespace-nowrap">
                  {(p.price / 100).toFixed(2)} ₴
                </td>
                <td className="px-4 py-4 text-center">
                  {p.tgPostId ? (
                    <span className="text-emerald-400" title="Опубліковано">✅</span>
                  ) : p.scheduledPublishAt ? (
                    <span className="text-sky-400 text-xs whitespace-nowrap" title="Заплановано">
                      🕒 {new Date(new Date(p.scheduledPublishAt).getTime() - new Date(p.scheduledPublishAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ')}
                    </span>
                  ) : (
                    <span className="text-neutral-600 opacity-50" title="Не публікувалось">✖</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm font-bold text-neutral-300 whitespace-nowrap">
                  {p.stock} шт
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`inline-block text-xs px-2 py-1 rounded w-[110px] text-center font-medium ${p.status === 'IN_STOCK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : p.status === 'OUT_OF_STOCK' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-white/10 text-neutral-300 border border-white/20'}`}>
                    {p.status === 'IN_STOCK' ? 'В наявності' : p.status === 'OUT_OF_STOCK' ? 'Не доступно' : 'Під замовлення'}
                  </span>
                </td>
                <td className="px-4 py-4 text-right space-x-3 whitespace-nowrap">
                  {isAdmin && (
                    <button disabled={loading} onClick={() => {
                      if (!hasSMM) { alert('Ця функція доступна лише в PRO ліцензії'); return; }
                      handleGenerateSMMClick(p);
                    }} className={`text-xs transition-colors ${hasSMM ? 'text-fuchsia-400 hover:text-fuchsia-300' : 'text-neutral-600 cursor-not-allowed'}`} title={!hasSMM ? 'Доступно у PRO версії' : ''}>
                      {hasSMM ? 'SMM Пости' : '🔒 SMM'}
                    </button>
                  )}
                  <button onClick={() => handlePublishTG(p.id, p.name)} className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
                    TG Пост
                  </button>
                  <button onClick={() => { setEditingProduct(p); setEditImages(p.images || []); setSourceUrl(p.sourceUrl || ''); }} className="text-xs text-indigo-400 hover:text-white transition-colors">
                    Редагувати
                  </button>
                  <button onClick={() => setDeletingProduct(p)} className="text-xs text-rose-400 hover:text-rose-300 transition-colors">
                    Видалити
                  </button>
                </td>
              </tr>
            ))}
            {paginatedProducts.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-neutral-500">Товарів не знайдено</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Paginator */}
      <div className="flex justify-center items-center mt-6 mb-10 gap-4">
        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-6 py-2 bg-white/5 rounded-xl font-bold hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition">Попередня</button>
        <div className="text-neutral-400">Сторінка {currentPage} з {totalPages}</div>
        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-6 py-2 bg-white/5 rounded-xl font-bold hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition">Наступна</button>
      </div>

      {/* Bulk Bottom Toolbar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-indigo-500/30 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-40 animate-in slide-in-from-bottom-10">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-white font-bold">Вибрано {selectedIds.length} товарів</span>
            <div className="flex gap-4">
              <button onClick={() => setSelectedIds([])} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition">Скасувати</button>
              <button onClick={() => setBulkActionOpen(true)} className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-500/30">Масова Обробка</button>
            </div>
          </div>
        </div>
      )}

      {bulkActionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Масова обробка ({selectedIds.length} шт)</h3>
            <p className="text-sm text-neutral-400 mb-6">Заповніть лише ті поля, які хочете змінити у всіх вибраних товарах. Інші залиште порожніми.</p>
            <form ref={bulkFormRef} onSubmit={handleBulkUpdate} className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Нова Вартість (ГРН)</label>
                <input name="price" type="number" step="0.01" min="0" placeholder="Залишити без змін" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Нова Кількість (шт)</label>
                <input name="stock" type="number" min="0" placeholder="Залишити без змін" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" />
                <p className="text-xs text-neutral-500 mt-1">Якщо кількість &gt; 0, статуси автоматично стануть &quot;В наявності&quot;.</p>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Примусовий Статус</label>
                <select name="status" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none">
                  <option value="">Залишити без змін</option>
                  <option value="IN_STOCK">В наявності</option>
                  <option value="OUT_OF_STOCK">Не доступно</option>
                  <option value="MADE_TO_ORDER">Під замовлення</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setBulkActionOpen(false)} className="flex-1 bg-white/5 py-3 rounded-lg text-sm hover:bg-white/10 transition">Скасувати</button>
                <button type="submit" disabled={loading} className="flex-1 bg-indigo-500 text-white py-3 rounded-lg text-sm font-bold hover:bg-indigo-400 transition">Застосувати Зміни</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-2xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-screen">
            <h3 className="text-lg font-bold text-white mb-4">Новий Товар</h3>
            <form ref={formRef} onSubmit={handleCreate} className="space-y-4">

              <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4 rounded-xl mb-4 text-sm mt-4">
                <h4 className="font-bold text-emerald-400 mb-2">🌐 Отримання з інтернету</h4>
                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs text-neutral-400 mb-1">Посилання на товар (джерело)</label>
                    <input name="sourceUrl" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://makerworld.com/..." className="w-full bg-black/50 border border-emerald-500/30 rounded-lg px-3 py-2 text-white outline-none" />
                  </div>
                </div>

                {previewExtractionImage && (
                  <div className="mt-4 p-4 border border-emerald-500/50 rounded-xl bg-black/40 flex flex-col items-center">
                    <p className="text-emerald-300 text-xs text-center mb-3">Ось це фото ми знайшли. Вирізати фон і згенерувати опис?</p>
                    <img src={previewExtractionImage} alt="Preview" className="h-40 w-auto rounded-lg mb-4 object-contain shadow-lg" />
                    <div className="flex gap-4">
                      <button type="button" onClick={() => handleConfirmExtraction(formRef.current, false)} disabled={aiLoading} className="py-2 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 text-sm">
                        Так, обробити!
                      </button>
                      <button type="button" onClick={() => setPreviewExtractionImage(null)} disabled={aiLoading} className="py-2 px-4 bg-neutral-600 hover:bg-neutral-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 text-sm">
                        Скасувати
                      </button>
                    </div>
                  </div>
                )}

                {!previewExtractionImage && (
                  <div className="flex gap-3 mt-3">
                    <button type="button" onClick={() => handleExtractUrl(formRef.current, false)} disabled={aiLoading || !sourceUrl} className="py-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg transition-colors disabled:opacity-50 text-xs">
                      ⚡ Знайти фото за посиланням
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-4 items-start border-t border-white/10 pt-4 mt-4">
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Фотографії товару</label>

                  {processedImageUrls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 mb-3">
                      {processedImageUrls.map((url: string, idx: number) => (
                        <div key={idx} className="relative group">
                          <img src={url.startsWith('http') || url.startsWith('blob:') ? url : `/api/file?path=${url}`} alt="Current" className="w-16 h-16 bg-black/50 object-contain rounded-xl border border-white/10" />
                          <button type="button" onClick={() => setProcessedImageUrls(processedImageUrls.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {localFilesCreate.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 mb-3">
                      {localFilesCreate.map((file, idx) => (
                        <div key={idx} className="relative group">
                          <img src={URL.createObjectURL(file)} alt="Local" className="w-16 h-16 bg-black/50 object-cover rounded-xl border border-sky-500/50" />
                          <button type="button" onClick={() => setLocalFilesCreate(localFilesCreate.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl text-xs hover:bg-emerald-500/20 transition-colors text-center font-bold text-emerald-400 inline-flex items-center justify-center gap-2">
                      ✨ Додати фото (AI вирізання фону)
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleAddNewPhotosAICreate} />
                    </label>
                    <label className="cursor-pointer bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-xs hover:bg-white/10 transition-colors text-center font-bold text-neutral-300 inline-flex items-center justify-center gap-2">
                      ➕ Додати фото (без текстової обробки)
                      <input type="file" name="images" accept="image/*" multiple onChange={(e) => {
                        const filesArr = Array.from(e.target.files || []);
                        setLocalFilesCreate(prev => [...prev, ...filesArr]);
                        e.target.value = '';
                      }} className="hidden" />
                    </label>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Назва Товару</label>
                  <input name="name" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required />
                </div>
              </div>

              {/* AI Assistant Block */}
              <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 p-4 rounded-xl mt-6 mb-2 text-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-sky-400">✨ AI Асистент створення опису</h4>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 w-full">
                    <label className="block text-xs text-neutral-400 mb-1">Стиль опису</label>
                    <select value={aiTheme} onChange={(e) => setAiTheme(e.target.value)} className="w-full bg-black/50 border border-sky-500/30 rounded-lg px-3 py-2 text-white outline-none">
                      <option value="none">Без опису (тільки фото)</option>
                      {prompts.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => handleAIMagic(formRef.current, false)} disabled={aiLoading || prompts.length === 0} className="mt-5 px-4 bg-sky-500 text-white font-bold rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50">
                    {aiLoading ? 'Магія в процесі...' : '✨ Обробити Фото & Згенерувати Текст'}
                  </button>
                  <button type="button" onClick={() => handleAIMagicOnlyTextCreate(formRef.current)} disabled={aiLoading || prompts.length === 0} className="mt-5 px-4 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-50">
                    {aiLoading ? 'Генерація...' : 'Тільки текст'}
                  </button>
                </div>
                {successMsg && <div className="mt-3 text-emerald-400 font-bold">{successMsg}</div>}
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">Опис (Можна заповнити автоматично через AI)</label>
                <textarea name="description" rows={5} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-sky-500" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Вартість (ГРН)</label>
                  <input name="price" type="number" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Категорія</label>
                  <select name="categoryId" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required>
                    <option value="">Оберіть...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Кількість (шт)</label>
                  <input name="stock" type="number" min="0" defaultValue="0" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Статус (Наявність)</label>
                  <select name="status" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none">
                    <option value="IN_STOCK">В наявності</option>
                    <option value="OUT_OF_STOCK">Немає в наявності</option>
                    <option value="MADE_TO_ORDER">Під замовлення</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-300">
                  <input type="checkbox" name="isAutoPublish" defaultChecked className="accent-emerald-500 w-4 h-4 cursor-pointer" />
                  Авто-публікація в Telegram канал
                </label>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Запланувати час публікації (необов'язково)</label>
                  <input type="datetime-local" name="scheduledPublishAt" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none text-sm" />
                  <p className="text-xs text-neutral-500 mt-1">Якщо залишити порожнім, опублікується відразу.</p>
                </div>
              </div>
              {error && <div className="text-rose-400 text-xs">{error}</div>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModals} className="flex-1 bg-white/5 py-3 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
                <button type="submit" disabled={loading || aiLoading} className="flex-1 bg-emerald-500 text-white py-3 rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors">
                  {loading ? 'Збереження...' : 'Опублікувати'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-2xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-screen">
            <h3 className="text-lg font-bold text-white mb-4">Редагування Товару</h3>
            <form ref={editFormRef} onSubmit={handleEdit} className="space-y-4">

              {/* AI Assistant Block for Edit */}
              <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 p-4 rounded-xl mb-4 text-sm">
                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs text-neutral-400 mb-1"> ✨ Перегенерувати опис (AI)</label>
                    <select value={aiTheme} onChange={(e) => setAiTheme(e.target.value)} className="w-full bg-black/50 border border-sky-500/30 rounded-lg px-3 py-2 text-white outline-none">
                      <option value="none">Без опису</option>
                      {prompts.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => handleAIMagic(editFormRef.current, true)} disabled={aiLoading || prompts.length === 0} className="h-10 px-4 bg-sky-500 text-white font-bold rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50">
                    {aiLoading ? 'Магія...' : 'Згенерувати'}
                  </button>
                  <button type="button" onClick={() => handleAIMagicOnlyText(editFormRef.current)} disabled={aiLoading || prompts.length === 0} className="h-10 px-4 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-50">
                    {aiLoading ? 'Генерація...' : 'Тільки текст (Скинути старий)'}
                  </button>
                </div>
                {successMsg && <div className="mt-3 text-emerald-400 font-bold">{successMsg}</div>}
              </div>

              {/* URL Fetcher for Edit */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4 rounded-xl mb-4 text-sm mt-4">
                <h4 className="font-bold text-emerald-400 mb-2">🌐 Отримання з інтернету</h4>
                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs text-neutral-400 mb-1">Посилання на товар (джерело)</label>
                    <input name="sourceUrl" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://makerworld.com/..." className="w-full bg-black/50 border border-emerald-500/30 rounded-lg px-3 py-2 text-white outline-none" />
                  </div>
                </div>

                {previewExtractionImage && (
                  <div className="mt-4 p-4 border border-emerald-500/50 rounded-xl bg-black/40 flex flex-col items-center">
                    <p className="text-emerald-300 text-xs text-center mb-3">Ось це фото ми знайшли. Вирізати фон і згенерувати опис?</p>
                    <img src={previewExtractionImage} alt="Preview" className="h-40 w-auto rounded-lg mb-4 object-contain shadow-lg" />
                    <div className="flex gap-4">
                      <button type="button" onClick={() => handleConfirmExtraction(editFormRef.current, true)} disabled={aiLoading} className="py-2 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 text-sm">
                        Так, обробити!
                      </button>
                      <button type="button" onClick={() => setPreviewExtractionImage(null)} disabled={aiLoading} className="py-2 px-4 bg-neutral-600 hover:bg-neutral-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 text-sm">
                        Скасувати
                      </button>
                    </div>
                  </div>
                )}

                {!previewExtractionImage && (
                  <div className="flex gap-3 mt-3">
                    <button type="button" onClick={() => handleExtractUrl(editFormRef.current, true)} disabled={aiLoading || !sourceUrl} className="py-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg transition-colors disabled:opacity-50 text-xs">
                      ⚡ Знайти фото за посиланням
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-4 items-start border-t border-white/10 pt-4 mt-4">
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Фотографії товару</label>

                  {editImages.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 mb-3">
                      {editImages.map((url: string, idx: number) => (
                        <div key={idx} className="relative group">
                          <img src={url.startsWith('http') || url.startsWith('blob:') ? url : `/api/file?path=${url}`} alt="Current" className="w-16 h-16 bg-black/50 object-contain rounded-xl border border-white/10" />
                          <button type="button" onClick={() => setEditImages(editImages.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {localFilesEdit.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 mb-3">
                      {localFilesEdit.map((file, idx) => (
                        <div key={idx} className="relative group">
                          <img src={URL.createObjectURL(file)} alt="Local" className="w-16 h-16 bg-black/50 object-cover rounded-xl border border-sky-500/50" />
                          <button type="button" onClick={() => setLocalFilesEdit(localFilesEdit.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl text-xs hover:bg-emerald-500/20 transition-colors text-center font-bold text-emerald-400 inline-flex items-center justify-center gap-2">
                      ✨ Додати фото (AI вирізання фону)
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleAddNewPhotosAI} />
                    </label>
                    <label className="cursor-pointer bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-xs hover:bg-white/10 transition-colors text-center font-bold text-neutral-300 inline-flex items-center justify-center gap-2">
                      ➕ Додати фото (без текстової обробки)
                      <input type="file" name="images" accept="image/*" multiple onChange={(e) => {
                        const filesArr = Array.from(e.target.files || []);
                        setLocalFilesEdit(prev => [...prev, ...filesArr]);
                        e.target.value = '';
                      }} className="hidden" />
                    </label>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Назва Товару</label>
                  <input name="name" defaultValue={editingProduct.name} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required />
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">Опис</label>
                <textarea name="description" defaultValue={editingProduct.description} rows={5} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-sky-500" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Вартість (ГРН)</label>
                  <input name="price" type="number" defaultValue={(editingProduct.price / 100).toFixed(2)} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Категорія</label>
                  <select name="categoryId" defaultValue={editingProduct.categoryId} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4 mt-4">
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Кількість (шт)</label>
                  <input name="stock" type="number" min="0" defaultValue={editingProduct.stock || 0} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 mb-1">Статус (Наявність)</label>
                  <select name="status" defaultValue={editingProduct.status} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none">
                    <option value="IN_STOCK">В наявності</option>
                    <option value="OUT_OF_STOCK">Немає в наявності</option>
                    <option value="MADE_TO_ORDER">Під замовлення</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-300">
                  <input type="checkbox" name="isAutoPublish" defaultChecked={!editingProduct.tgPostId} className="accent-emerald-500 w-4 h-4 cursor-pointer" />
                  Авто-публікація в Telegram канал (окрім вже опублікованих)
                </label>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Оновити час публікації (необов'язково)</label>
                  <input
                    type="datetime-local"
                    name="scheduledPublishAt"
                    defaultValue={editingProduct.scheduledPublishAt ? new Date(new Date(editingProduct.scheduledPublishAt).getTime() - new Date(editingProduct.scheduledPublishAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none text-sm"
                  />
                </div>
              </div>

              {error && <div className="text-rose-400 text-xs">{error}</div>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModals} className="flex-1 bg-white/5 py-3 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
                <button type="submit" disabled={loading || aiLoading} className="flex-1 bg-indigo-500 text-white py-3 rounded-lg text-sm font-semibold hover:bg-indigo-400 transition-colors">
                  {loading ? 'Збереження...' : 'Зберегти Зміни'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {publishingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center">
            <h3 className="text-lg font-bold text-white mb-2">Публікація в Telegram</h3>
            {successMsg ? (
              <div className="text-emerald-400 text-sm mb-6 bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                {successMsg}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 mb-6">Відправити товар <b>{publishingProduct.name}</b> відразу в Telegram-канал?</p>
            )}

            {error && <div className="text-rose-400 text-xs mb-4 bg-rose-500/10 p-3 rounded-lg">{error}</div>}

            <div className="flex gap-3">
              <button onClick={() => { setPublishingProduct(null); setError(''); setSuccessMsg(''); }} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">
                {successMsg ? 'Закрити' : 'Скасувати'}
              </button>
              {!successMsg && (
                <button onClick={() => confirmPublishTG(publishingProduct.id)} disabled={loading} className="flex-1 bg-sky-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-sky-400 transition-colors">
                  {loading ? 'Публікуємо...' : 'Опублікувати'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-rose-500/20 w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 text-2xl">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Видалення товару</h3>
            <p className="text-sm text-neutral-400 mb-6">Ви дійсно хочете безповоротно видалити товар <b>{deletingProduct.name}</b>?</p>

            <div className="flex gap-3">
              <button onClick={() => setDeletingProduct(null)} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">
                Скасувати
              </button>
              <button onClick={() => handleDelete(deletingProduct.id)} disabled={loading} className="flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-rose-400 transition-colors">
                {loading ? 'Видалення...' : 'Так, видалити'}
              </button>
            </div>
          </div>
        </div>
      )}

      {smmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-fuchsia-500/20 w-full max-w-md rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            
            {smmModal.step === 'confirm' && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className="w-12 h-12 rounded-full bg-fuchsia-500/10 text-fuchsia-400 flex items-center justify-center mx-auto mb-4 text-2xl">
                  🤖
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Генерація SMM</h3>
                <p className="text-sm text-neutral-400 mb-6">
                  Запустити AI-генерацію постів та відео для товару <b>{smmModal.productName}</b>? Будуть використані API токени.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setSmmModal(null)} className="flex-1 bg-white/5 py-3 rounded-lg text-sm font-semibold text-neutral-300 hover:bg-white/10 transition-colors">
                    Скасувати
                  </button>
                  <button onClick={confirmGenerateSMM} className="flex-1 bg-fuchsia-500 text-white py-3 rounded-lg text-sm font-semibold hover:bg-fuchsia-400 transition-colors shadow-[0_0_15px_rgba(217,70,239,0.4)]">
                    Запустити
                  </button>
                </div>
              </div>
            )}

            {smmModal.step === 'generating' && (
              <div className="text-center animate-in fade-in duration-300 py-4">
                <div className="w-16 h-16 border-4 border-fuchsia-500/20 border-t-fuchsia-500 rounded-full animate-spin mx-auto mb-6"></div>
                <h3 className="text-xl font-bold text-white mb-2">Генерація в процесі...</h3>
                <p className="text-sm text-neutral-400 mb-2">Claude пише тексти, а Photoroom створює обкладинки.</p>
                <div className="w-full bg-white/5 rounded-full h-2 mt-6 overflow-hidden">
                  <div className="bg-fuchsia-500 h-full rounded-full animate-pulse w-full"></div>
                </div>
                <p className="text-xs text-fuchsia-400 mt-3 animate-pulse">Будь ласка, не закривайте сторінку (до 30 секунд)</p>
              </div>
            )}

            {smmModal.step === 'success' && smmModal.stats && (
              <div className="text-center animate-in fade-in zoom-in duration-500">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 text-2xl">
                  🎉
                </div>
                <h3 className="text-xl font-bold text-white mb-2">SMM-завдання згенеровано!</h3>
                <p className="text-sm text-neutral-400 mb-6">
                  Штучний інтелект успішно проаналізував товар <b>{smmModal.productName}</b> та підготував рекламні матеріали.
                </p>

                <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-3 text-left">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-300">📱 Facebook Пости:</span>
                    <span className="font-bold text-sky-400">+{smmModal.stats.facebook} завдань</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-300">📸 Instagram Пости (Фото):</span>
                    <span className="font-bold text-fuchsia-400">+{smmModal.stats.instagramPhotos} завдань</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t border-white/10 pt-3">
                    <span className="text-neutral-300">🎥 Instagram Reels (Відео):</span>
                    <span className="font-bold text-purple-400">+{smmModal.stats.instagramReels} завдань</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setSmmModal(null)} className="flex-1 bg-white/5 py-3 rounded-lg text-sm font-semibold text-neutral-300 hover:bg-white/10 transition-colors">
                    Закрити
                  </button>
                  <a href="/admin/smm" className="flex-1 flex items-center justify-center bg-fuchsia-500 text-white py-3 rounded-lg text-sm font-semibold hover:bg-fuchsia-400 transition-colors shadow-[0_0_15px_rgba(217,70,239,0.4)]">
                    Перейти до постів
                  </a>
                </div>
              </div>
            )}

            {smmModal.step === 'error' && (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 text-2xl">
                  ⚠️
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Помилка генерації</h3>
                <p className="text-sm text-rose-400 bg-rose-500/10 p-4 rounded-xl mb-6">
                  {smmModal.error}
                </p>
                <button onClick={() => setSmmModal(null)} className="w-full bg-white/5 py-3 rounded-lg text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                  Закрити
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
