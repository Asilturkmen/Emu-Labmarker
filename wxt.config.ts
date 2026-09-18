import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "EMU LabMark",
    description:
      "EMU ders programındaki laboratuvar derslerini renkli olarak işaretler.",
    homepage_url: "https://asilturkmen.com",
    permissions: ["storage"],
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
});
