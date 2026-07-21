import { useEditor } from "./composables/useEditor.js";

const { createApp } = window.Vue;

createApp({
  setup() {
    return useEditor();
  },
}).mount("#app");
