import { LINE_TYPES, AUTOSAVE_DELAY } from "../config/editorConfig.js";
import { translations } from "../config/translations.js";
import {
  getUniqueId,
  adjustHeight,
  getLineClass,
  getDropdownBtnClass,
  formatUrl,
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
  const { ref, reactive, nextTick, onMounted, onUnmounted, watch } = window.Vue;

  const sidebarOpen = ref(true);

  /* Language Support Area Starts */
  const currentLang = ref(localStorage.getItem("coral_lang") || "ru"); // Varsayılan Rusça

  function setLang(lang) {
    currentLang.value = lang;
    localStorage.setItem("coral_lang", lang);
    document.documentElement.lang = lang;
  }

  function t(key) {
    return (
      translations[currentLang.value]?.[key] || translations["tr"]?.[key] || key
    );
  }
  /* Language Support Area Ends*/

  const currentDocId = ref(null);
  const saving = ref(false);
  const docList = ref([]);
  const activeDropdown = ref(null);
  const lineRefs = ref({});
  const toastMessage = ref("");
  const toastVisible = ref(false);
  /* FAZ 2: Active State & Link Modal States */
  const activeFormats = reactive({
    bold: false,
    italic: false,
    link: false,
  });

  const linkModal = reactive({
    show: false,
    url: "",
    savedRange: null,
  });

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

  /* ACTIVE STATE Tarayıcı */
  function updateActiveFormats() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      activeFormats.bold = false;
      activeFormats.italic = false;
      activeFormats.link = false;
      return;
    }
    try {
      activeFormats.bold = document.queryCommandState("bold");
      activeFormats.italic = document.queryCommandState("italic");

      const anchorNode = selection.anchorNode;
      const element =
        anchorNode?.nodeType === 1 ? anchorNode : anchorNode?.parentElement;
      activeFormats.link = !!element?.closest("a");
    } catch (e) {
      activeFormats.bold = false;
      activeFormats.italic = false;
      activeFormats.link = false;
    }
  }

  /* FAZ 2 FORMATLAMA AKSİYONLARI */
  function formatBold() {
    document.execCommand("bold", false, null);
    updateActiveFormats();
  }

  function formatItalic() {
    document.execCommand("italic", false, null);
    updateActiveFormats();
  }

  function openLinkModal() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      linkModal.savedRange = selection.getRangeAt(0).cloneRange();
      const node = selection.anchorNode;
      const anchor = (
        node?.nodeType === 1 ? node : node?.parentElement
      )?.closest("a");
      linkModal.url = anchor ? anchor.getAttribute("href") || "" : "";
    } else {
      linkModal.url = "";
    }
    linkModal.show = true;
  }

  function closeLinkModal() {
    linkModal.show = false;
    linkModal.savedRange = null;
    linkModal.url = "";
  }
  function applyLink() {
    if (linkModal.savedRange) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(linkModal.savedRange);
    }

    let url = linkModal.url ? linkModal.url.trim() : "";

    if (url) {
      // Sorun 8 Çözümü: Çifte katlanan https://https:// veya http:// tekrarlarını temizle
      url = url.replace(/^(https?:\/\/)+/gi, "https://");

      // Eğer protokol yazılmadıysa (lala.com) otomatik https:// ekle
      if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
      }
    }

    if (!url || url === "https://") {
      document.execCommand("unlink", false, null);
    } else {
      const selection = window.getSelection();
      const range =
        linkModal.savedRange ||
        (selection && selection.rangeCount > 0
          ? selection.getRangeAt(0)
          : null);
      const node = selection?.anchorNode;
      const existingAnchor = (
        node?.nodeType === 1 ? node : node?.parentElement
      )?.closest("a");

      if (existingAnchor) {
        // Durum 1: Zaten bir linkin içindeysek sadece href'i güncelle
        existingAnchor.setAttribute("href", url);
      } else if (range && range.collapsed) {
        // Sorun 2 Çözümü: Hiç metin seçilmediyse (0 karakter) DOM'u bozmadan temiz link ekle
        const anchorHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>&nbsp;`;
        document.execCommand("insertHTML", false, anchorHtml);
      } else {
        // Durum 3: Metin seçiliyken standart link ekle
        document.execCommand("createLink", false, url);
      }
    }

    const activeEl = document.activeElement;
    if (activeEl && activeEl.classList.contains("rich-text-editor")) {
      activeEl.dispatchEvent(new Event("input", { bubbles: true }));
    }

    closeLinkModal();
    updateActiveFormats();
  }

  function clearFormat() {
    document.execCommand("removeFormat", false, null);
    document.execCommand("unlink", false, null);
    updateActiveFormats();
  }

  function setInitialContent(el, content) {
    if (!el || !el.isContentEditable) return;
    if (document.activeElement !== el) {
      const nextContent = content || "";
      if (el.innerHTML !== nextContent) {
        el.innerHTML = nextContent;
      }
    }
  }

  function syncEditableLineContent() {
    blocks.value.forEach((block, bIndex) => {
      block.lines.forEach((line, lIndex) => {
        const key = `${bIndex}_${lIndex}`;
        const el = lineRefs.value[key];
        if (!el || !el.isContentEditable) return;

        setInitialContent(el, line.content || "");
        adjustHeight(el);
      });
    });
  }

  function onContentFocus(event, line) {
    const el = event.target;
    if (el) {
      setInitialContent(el, line.content || "");
      adjustHeight(el);
      updateActiveFormats();
    }
  }

  function onContentInput(event, line) {
    const el = event.currentTarget;
    let html = el.innerHTML || "";

    // Tarayıcının araya sokuşturduğu gizli <div> ve </div> etiketlerini sök
    html = html.replace(/<\/?div>/gi, "");

    line.content = html;
    adjustHeight(el);
    updateActiveFormats();
  }

  function handlePaste(event, line) {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData(
      "text/plain",
    );
    document.execCommand("insertText", false, text);
    line.content = event.target.innerHTML;
  }

  function getCursorPosition(target) {
    if (!target) return 0;
    if (target.isContentEditable) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0)
        return target.textContent?.length || 0;
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(target);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      return preCaretRange.toString().length;
    }
    return target.selectionStart ?? 0;
  }

  function setCursorPosition(target, position) {
    if (!target) return;
    if (target.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      let currentOffset = 0;
      let found = false;

      const walkNodes = (node) => {
        if (found) return;
        if (node.nodeType === Node.TEXT_NODE) {
          const len = node.textContent.length;
          if (currentOffset + len >= position) {
            range.setStart(node, Math.min(position - currentOffset, len));
            range.collapse(true);
            found = true;
            return;
          }
          currentOffset += len;
        } else {
          for (let child of node.childNodes) {
            walkNodes(child);
            if (found) return;
          }
        }
      };

      walkNodes(target);

      if (!found) {
        range.selectNodeContents(target);
        range.collapse(false);
      }

      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    if (typeof target.selectionStart === "number") {
      const safePos = Math.min(position, target.value.length);
      target.selectionStart = target.selectionEnd = safePos;
    }
  }

  function triggerAllHeights() {
    nextTick(() => {
      Object.values(lineRefs.value).forEach((el) => {
        if (el) adjustHeight(el);
      });
      syncEditableLineContent();
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
      showToast(t("toastLoaded"));
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
    showToast(t("toastNew"));
    nextTick(() => {
      isDocLoading = false;
      triggerAllHeights();
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
    const line = blocks.value[bIndex]?.lines?.[lIndex];
    if (!line) return;
    line.type = type;
    // P'den başlığa geçerken alt satır (\n) artıklarını ve HTML etiketlerini temizle
    if (["h1", "h2", "h3", "h4", "image_link"].includes(type)) {
      if (line.content) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = line.content;
        line.content = (tempDiv.innerText || tempDiv.textContent || "")
          .replace(/[\r\n]+/g, " ")
          .trim();
      }
    }
    activeDropdown.value = null;
    nextTick(() => {
      const key = `${bIndex}_${lIndex}`;
      const el = lineRefs.value[key];
      if (el) {
        if (el.isContentEditable) {
          el.innerHTML = line.content || "";
        } else {
          el.value = line.content || "";
        }
        adjustHeight(el);
      }
    });
  }

  function addNewBlock() {
    const newBName = "Blok " + (blocks.value.length + 1);
    blocks.value.push({
      id: getUniqueId(),
      name: newBName,
      lines: [{ id: getUniqueId(), type: "p", content: "" }],
    });
    showToast(t("toastBlockAdded"));
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
      if (el.isContentEditable) {
        const line = blocks.value[bIndex]?.lines?.[lIndex];
        if (line) {
          setInitialContent(el, line.content || "");
        }
      }
      el.focus();
      adjustHeight(el);
      if (el.isContentEditable) {
        setCursorPosition(el, (el.textContent || "").length);
      }
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

  function addLineAfter(bIndex, lIndex, content, type = null) {
    const currentLine = blocks.value[bIndex].lines[lIndex];
    if (!currentLine) return;

    const newLine = {
      id: getUniqueId(),
      type: type || currentLine.type,
      content,
    };

    blocks.value[bIndex].lines.splice(lIndex + 1, 0, newLine);
    nextTick(() => {
      focusLine(bIndex, lIndex + 1);
    });
  }

  function deleteBlockItem(bIndex, lIndex) {
    const blockLines = blocks.value[bIndex]?.lines;
    if (!blockLines) return;

    if (blockLines.length <= 1) {
      blockLines[0].content = "";
      blockLines[0].type = "p";
      return;
    }

    blockLines.splice(lIndex, 1);
    activeDropdown.value = null;
    triggerAllHeights();
  }

  function focusPreviousBlock(bIndex, lIndex) {
    if (lIndex > 0) {
      focusLine(bIndex, lIndex - 1);
    } else if (bIndex > 0) {
      const prevBlockLines = blocks.value[bIndex - 1].lines;
      focusLine(bIndex - 1, prevBlockLines.length - 1);
    }
  }

  function deleteOrMergeBlock(bIndex, lIndex) {
    if (lIndex > 0) {
      const blockLines = blocks.value[bIndex]?.lines;
      if (!blockLines) return;
      const currentLine = blockLines[lIndex];
      const prevLine = blockLines[lIndex - 1];
      if (!currentLine || !prevLine) return;

      const currentRawText = currentLine.content
        ? currentLine.content.replace(/<[^>]+>/g, "").trim()
        : "";
      const isCurrentEmpty = currentRawText === "";
      const isPrevPlain = ["h1", "h2", "h3", "h4", "image_link"].includes(
        prevLine.type,
      );

      // Üst satırın silinmeden önceki metin uzunluğunu (imlecin gideceği yeri) hesapla
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = prevLine.content || "";
      const prevTextLength = (tempDiv.innerText || tempDiv.textContent || "")
        .length;

      if (isCurrentEmpty) {
        blockLines.splice(lIndex, 1);
      } else {
        let addition = currentLine.content || "";
        if (isPrevPlain) {
          const temp = document.createElement("div");
          temp.innerHTML = addition;
          addition = (temp.innerText || temp.textContent || "").trim();
        }
        prevLine.content = (prevLine.content || "") + addition;
        blockLines.splice(lIndex, 1);
      }

      if (isPrevPlain && prevLine.content) {
        const temp = document.createElement("div");
        temp.innerHTML = prevLine.content;
        prevLine.content = (temp.innerText || temp.textContent || "")
          .replace(/<[^>]+>/g, "")
          .trim();
      }

      nextTick(() => {
        const prevKey = `${bIndex}_${lIndex - 1}`;
        const updatedPrevEl = lineRefs.value[prevKey];
        if (updatedPrevEl) {
          if (updatedPrevEl.isContentEditable) {
            updatedPrevEl.innerHTML = prevLine.content || "";
          } else {
            updatedPrevEl.value = prevLine.content || "";
          }
          updatedPrevEl.focus();
          // İmleci doğrudan üst satırın EN SONUNA yerleştir
          setCursorPosition(updatedPrevEl, prevTextLength);
          adjustHeight(updatedPrevEl);
        }
      });
    } else if (bIndex > 0) {
      // Eğer bloğun ilk satırındaysak (lIndex === 0), üst bloğun en son satırına odaklan
      const prevBlockLines = blocks.value[bIndex - 1]?.lines;
      if (!prevBlockLines || prevBlockLines.length === 0) return;
      const targetLIndex = prevBlockLines.length - 1;

      nextTick(() => {
        focusLine(bIndex - 1, targetLIndex);
        const targetKey = `${bIndex - 1}_${targetLIndex}`;
        const targetEl = lineRefs.value[targetKey];
        if (targetEl) {
          const textLen = (targetEl.textContent || targetEl.value || "").length;
          setCursorPosition(targetEl, textLen);
        }
      });
    }
  }

  function handleHeadingKeydown(event, bIndex, lIndex, line) {
    const input = event.target;

    // A) BACKSPACE İŞLEMİ
    if (event.key === "Backspace") {
      const isAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
      if (isAtStart) {
        event.preventDefault(); // Sadece imleç 0. konumdaysa engelle
        if (!line.content || line.content.trim() === "") {
          deleteBlockItem(bIndex, lIndex);
        } else {
          focusPreviousBlock(bIndex, lIndex);
        }
      }
      // İmleç baştan farklı bir yerdeyse e.preventDefault() ÇALIŞMAZ, harf silinir.
      return;
    }

    // B) ENTER İŞLEMİ
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const start = input.selectionStart ?? 0;
      const currentText = line.content || "";
      const leftText = currentText.substring(0, start);
      const rightText = currentText.substring(start);

      line.content = leftText;
      addLineAfter(bIndex, lIndex, rightText, "p");
    }
  }

  function handleEditableKeydown(event, bIndex, lIndex, line) {
    const isCmdOrCtrl = event.ctrlKey || event.metaKey;

    // KISAYOLLAR: Ctrl+B, Ctrl+I, Ctrl+K
    if (isCmdOrCtrl && event.key.toLowerCase() === "b") {
      event.preventDefault();
      formatBold();
      return;
    }
    if (isCmdOrCtrl && event.key.toLowerCase() === "i") {
      event.preventDefault();
      formatItalic();
      return;
    }
    if (isCmdOrCtrl && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openLinkModal();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const endRange = range.cloneRange();
      endRange.selectNodeContents(event.target);
      endRange.setStart(range.endContainer, range.endOffset);

      const temp = document.createElement("div");
      temp.appendChild(endRange.extractContents());

      // Böldükten sonra tarayıcının başa/sona eklediği yapay <br> etiketlerini temizle
      let rightContent = temp.innerHTML.replace(
        /^<br\s*\/?>|<br\s*\/?>$/gi,
        "",
      );
      let leftContent = event.target.innerHTML.replace(
        /^<br\s*\/?>|<br\s*\/?>$/gi,
        "",
      );

      line.content = leftContent;
      addLineAfter(bIndex, lIndex, rightContent, "p");
      return;
    }

    if (event.key === "Backspace") {
      const selection = window.getSelection();
      // Yalnızca ortada seçili metin YOKSA (isCollapsed) ve imleç 0. harfdeyse silme/birleştirme yap
      const isCollapsed = selection && selection.isCollapsed;
      const cursorPos = getCursorPosition(event.target);

      if (isCollapsed && cursorPos === 0) {
        event.preventDefault();
        deleteOrMergeBlock(bIndex, lIndex);
      }
    }
  }

  function handleEnter(bIndex, lIndex, event) {
    const target = event.target;

    if (event.shiftKey) {
      const start = getCursorPosition(target);
      const end = start;
      const value = target.isContentEditable
        ? target.textContent || ""
        : target.value;

      const newValue = value.substring(0, start) + "\n" + value.substring(end);
      if (target.isContentEditable) {
        target.textContent = newValue;
        blocks.value[bIndex].lines[lIndex].content = newValue;
        nextTick(() => {
          setCursorPosition(target, start + 1);
          adjustHeight(target);
        });
      } else {
        target.value = newValue;
        blocks.value[bIndex].lines[lIndex].content = newValue;
        nextTick(() => {
          target.selectionStart = target.selectionEnd = start + 1;
          adjustHeight(target);
        });
      }
      return;
    }

    const currentLine = blocks.value[bIndex].lines[lIndex];
    const text = currentLine.content || "";
    const cursorPosition = getCursorPosition(target);

    const before = text.substring(0, cursorPosition);
    const after = text.substring(cursorPosition);

    currentLine.content = before;
    adjustHeight(target);
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
        if (el.isContentEditable) {
          el.innerHTML = after;
          setCursorPosition(el, 0);
        } else {
          el.selectionStart = el.selectionEnd = 0;
        }
      }
    });
  }

  function handleBackspace(bIndex, lIndex, event) {
    const currentLine = blocks.value[bIndex].lines[lIndex];
    const cursorPosition = getCursorPosition(event.target);

    if (cursorPosition === 0 && lIndex > 0) {
      const prevLine = blocks.value[bIndex].lines[lIndex - 1];
      const originalPrevLength = prevLine.content.length;

      prevLine.content += currentLine.content;
      blocks.value[bIndex].lines.splice(lIndex, 1);

      nextTick(() => {
        const key = `${bIndex}_${lIndex - 1}`;
        const el = lineRefs.value[key];
        if (el) {
          if (el.isContentEditable) {
            el.innerHTML = prevLine.content;
            setCursorPosition(el, originalPrevLength);
          } else {
            el.focus();
            el.selectionStart = el.selectionEnd = originalPrevLength;
          }
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

  const selectionHandler = () => updateActiveFormats();

  onMounted(() => {
    document.documentElement.lang = currentLang.value;
    triggerAllHeights();
    fetchDocList();
    document.addEventListener("click", () => {
      activeDropdown.value = null;
    });
    document.addEventListener("selectionchange", selectionHandler);
  });

  onUnmounted(() => {
    document.removeEventListener("selectionchange", selectionHandler);
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
    currentLang,
    setLang,
    t,
    toggleDropdown,
    getDropdownBtnClass: getDropdownBtnClassWrapper,
    setLineType,
    addNewBlock,
    deleteBlock,
    addNewLine,
    deleteLine,
    onContentFocus,
    onContentInput,
    handlePaste,
    handleEditableKeydown,
    handleHeadingKeydown,
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
    activeFormats,
    linkModal,
    formatBold,
    formatItalic,
    openLinkModal,
    closeLinkModal,
    applyLink,
    clearFormat,
    formatUrl,
  };
}
