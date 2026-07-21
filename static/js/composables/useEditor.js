import { LINE_TYPES, AUTOSAVE_DELAY } from "../config/editorConfig.js";
import {
  getUniqueId,
  adjustHeight,
  getLineClass,
  getDropdownBtnClass,
} from "../utils/helpers.js";
import {
  fetchDocListApi,
  fetchDocApi,
  saveDocApi,
  deleteDocApi,
} from "../services/apiService.js";
import {
  downloadJSON,
  downloadDOCX,
  generateJSONData,
} from "../services/exportService.js";

export function useEditor() {
  const { ref, reactive, nextTick, onMounted, watch } = window.Vue;

  const sidebarOpen = ref(true);
  const currentDocId = ref(null);
  const saving = ref(false);
  const docList = ref([]);
  const activeDropdown = ref(null);
  const lineRefs = ref({});
  const toastMessage = ref("");
  const toastVisible = ref(false);

  const seo = reactive({
    h1: "",
    metaTitle: "",
    metaDescription: "",
    url: "",
  });

  const types = LINE_TYPES;

  const blocks = ref([
    {
      id: getUniqueId(),
      name: "Blok 1",
      lines: [{ id: getUniqueId(), type: "p", content: "" }],
    },
  ]);

  let autoSaveTimer = null;
  let toastTimer = null;
  let isDocLoading = false;

  function showToast(msg) {
    toastMessage.value = msg;
    toastVisible.value = true;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastVisible.value = false;
    }, 2500);
  }

  function adjustHeightWrapper(el) {
    adjustHeight(el);
  }

  function triggerAllHeights() {
    nextTick(() => {
      Object.values(lineRefs.value).forEach((el) => {
        if (el) adjustHeight(el);
      });
    });
  }

  function triggerAutoSave() {
    if (isDocLoading) return;
    saving.value = true;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      const payload = generateJSONData(seo, blocks.value);
      payload.id = currentDocId.value;
      try {
        const data = await saveDocApi(payload);
        if (data && data.id) currentDocId.value = data.id;
        await fetchDocList();
      } catch (e) {
        console.error("Kayıt hatası:", e);
      } finally {
        saving.value = false;
      }
    }, AUTOSAVE_DELAY);
  }

  async function fetchDocList() {
    const list = await fetchDocListApi();
    if (list) {
      docList.value = list;
    }
  }

  async function loadDoc(id) {
    try {
      isDocLoading = true;
      const data = await fetchDocApi(id);
      currentDocId.value = data.id;
      seo.h1 = data.seo?.h1 || "";
      seo.metaTitle = data.seo?.metaTitle || "";
      seo.metaDescription = data.seo?.metaDescription || "";
      seo.url = data.seo?.url || "";

      if (data.blocks && data.blocks.length > 0) {
        blocks.value = data.blocks.map((b) => ({
          id: getUniqueId(),
          name: b.name,
          lines: b.items.map((i) => ({
            id: getUniqueId(),
            type: i.type,
            content: i.content,
          })),
        }));
      }
      showToast("✓ Belge yüklendi");
      triggerAllHeights();
    } catch (e) {
      showToast("⚠ Belge yüklenemedi");
    } finally {
      nextTick(() => {
        isDocLoading = false;
      });
    }
  }

  function createNewDoc() {
    isDocLoading = true;
    currentDocId.value = null;
    seo.h1 = "";
    seo.metaTitle = "";
    seo.metaDescription = "";
    seo.url = "";
    blocks.value = [
      {
        id: getUniqueId(),
        name: "Blok 1",
        lines: [{ id: getUniqueId(), type: "p", content: "" }],
      },
    ];
    showToast("Yeni Taslak");
    nextTick(() => {
      isDocLoading = false;
    });
  }

  async function deleteDoc(id) {
    if (!confirm("Bu taslağı silmek istediğinize emin misiniz?")) return;
    await deleteDocApi(id);
    if (currentDocId.value === id) createNewDoc();
    fetchDocList();
  }

  function setLineRef(bIndex, lIndex, el) {
    const key = `${bIndex}_${lIndex}`;
    if (el) lineRefs.value[key] = el;
  }

  function toggleDropdown(bIndex, lIndex) {
    const key = `${bIndex}_${lIndex}`;
    if (activeDropdown.value === key) {
      activeDropdown.value = null;
    } else {
      activeDropdown.value = key;
    }
  }

  function getDropdownBtnClassWrapper(type) {
    return getDropdownBtnClass(type, types);
  }

  function setLineType(bIndex, lIndex, type) {
    blocks.value[bIndex].lines[lIndex].type = type;
    activeDropdown.value = null;
    triggerAllHeights();
  }

  function addNewBlock() {
    const newBName = "Blok " + (blocks.value.length + 1);
    blocks.value.push({
      id: getUniqueId(),
      name: newBName,
      lines: [{ id: getUniqueId(), type: "p", content: "" }],
    });
    showToast("✓ Yeni Blok eklendi");
    nextTick(() => {
      focusLine(blocks.value.length - 1, 0);
    });
  }

  function deleteBlock(bIndex) {
    if (blocks.value.length <= 1) return;
    blocks.value.splice(bIndex, 1);
    activeDropdown.value = null;
    triggerAllHeights();
  }

  function addNewLine(bIndex, lIndex) {
    const newLine = { id: getUniqueId(), type: "p", content: "" };
    blocks.value[bIndex].lines.splice(lIndex, 0, newLine);
    nextTick(() => {
      focusLine(bIndex, lIndex);
    });
  }

  function deleteLine(bIndex, lIndex) {
    const blockLines = blocks.value[bIndex].lines;
    if (blockLines.length <= 1) {
      blockLines[0].content = "";
      blockLines[0].type = "p";
      return;
    }
    blockLines.splice(lIndex, 1);
    activeDropdown.value = null;
    triggerAllHeights();
  }

  function focusLine(bIndex, lIndex) {
    const key = `${bIndex}_${lIndex}`;
    const el = lineRefs.value[key];
    if (el) {
      el.focus();
      adjustHeight(el);
    }
  }

  function focusPrev(bIndex, lIndex) {
    if (lIndex > 0) {
      focusLine(bIndex, lIndex - 1);
    } else if (bIndex > 0) {
      const prevBlockLines = blocks.value[bIndex - 1].lines;
      focusLine(bIndex - 1, prevBlockLines.length - 1);
    }
  }

  function focusNext(bIndex, lIndex) {
    const blockLines = blocks.value[bIndex].lines;
    if (lIndex < blockLines.length - 1) {
      focusLine(bIndex, lIndex + 1);
    } else if (bIndex < blocks.value.length - 1) {
      focusLine(bIndex + 1, 0);
    }
  }

  function handleEnter(bIndex, lIndex, event) {
    if (event.shiftKey) {
      const textarea = event.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      textarea.value = value.substring(0, start) + "\n" + value.substring(end);
      blocks.value[bIndex].lines[lIndex].content = textarea.value;

      nextTick(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        adjustHeight(textarea);
      });
      return;
    }

    const currentLine = blocks.value[bIndex].lines[lIndex];
    const text = currentLine.content;
    const cursorPosition = event.target.selectionStart;

    const before = text.substring(0, cursorPosition);
    const after = text.substring(cursorPosition);

    currentLine.content = before;
    adjustHeight(event.target);
    let nextType = currentLine.type;
    if (["h1", "h2", "h3", "h4"].includes(nextType)) {
      nextType = "p";
    }
    const newLine = {
      id: getUniqueId(),
      type: nextType,
      content: after,
    };

    blocks.value[bIndex].lines.splice(lIndex + 1, 0, newLine);

    nextTick(() => {
      focusLine(bIndex, lIndex + 1);
      const key = `${bIndex}_${lIndex + 1}`;
      const el = lineRefs.value[key];
      if (el) {
        el.selectionStart = el.selectionEnd = 0;
      }
    });
  }

  function handleBackspace(bIndex, lIndex, event) {
    const currentLine = blocks.value[bIndex].lines[lIndex];
    const cursorPosition = event.target.selectionStart;

    if (cursorPosition === 0 && lIndex > 0) {
      const prevLine = blocks.value[bIndex].lines[lIndex - 1];
      const originalPrevLength = prevLine.content.length;

      prevLine.content += currentLine.content;
      blocks.value[bIndex].lines.splice(lIndex, 1);

      nextTick(() => {
        const key = `${bIndex}_${lIndex - 1}`;
        const el = lineRefs.value[key];
        if (el) {
          el.focus();
          el.selectionStart = el.selectionEnd = originalPrevLength;
          adjustHeight(el);
        }
      });
    }
  }

  function getLineClassWrapper(type) {
    return getLineClass(type);
  }

  function clearAll() {
    if (
      confirm(
        "Tüm metinleri ve SEO verilerini silmek istediğinize emin misiniz?",
      )
    ) {
      isDocLoading = true;
      seo.h1 = "";
      seo.metaTitle = "";
      seo.metaDescription = "";
      seo.url = "";
      blocks.value = [
        {
          id: getUniqueId(),
          name: "Blok 1",
          lines: [{ id: getUniqueId(), type: "p", content: "" }],
        },
      ];
      showToast("Editör temizlendi");
      nextTick(() => {
        isDocLoading = false;
      });
    }
  }

  function triggerDownloadJSON() {
    downloadJSON(seo, blocks.value, showToast);
  }

  function triggerDownloadDOCX() {
    downloadDOCX(seo, blocks.value, showToast);
  }

  watch(
    [seo, blocks],
    () => {
      triggerAutoSave();
    },
    { deep: true },
  );

  onMounted(() => {
    triggerAllHeights();
    fetchDocList();
    document.addEventListener("click", () => {
      activeDropdown.value = null;
    });
  });

  return {
    seo,
    types,
    blocks,
    activeDropdown,
    lineRefs,
    setLineRef,
    toastMessage,
    toastVisible,
    currentDocId,
    saving,
    docList,
    sidebarOpen,
    toggleDropdown,
    getDropdownBtnClass: getDropdownBtnClassWrapper,
    setLineType,
    addNewBlock,
    deleteBlock,
    addNewLine,
    deleteLine,
    handleEnter,
    handleBackspace,
    focusPrev,
    focusNext,
    getLineClass: getLineClassWrapper,
    clearAll,
    downloadJSON: triggerDownloadJSON,
    downloadDOCX: triggerDownloadDOCX,
    adjustHeight: adjustHeightWrapper,
    loadDoc,
    createNewDoc,
    deleteDoc,
  };
}
