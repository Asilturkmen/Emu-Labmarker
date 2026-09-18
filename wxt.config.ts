import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "EMU LabMarker",
    description:
      "EMU ders programındaki laboratuvar derslerini renkli olarak işaretler.",
    homepage_url: "https://asilturkmen.com",
    permissions: ["storage"],
    // The toolbar starts faded; entrypoints/background.ts swaps in the colour
    // for a tab that reports a timetable. "icons" stays colourful because it
    // is what the store and the extensions page show.
    action: {
      default_icon: {
        16: "icons/icon-16-inactive.png",
        32: "icons/icon-32-inactive.png",
        48: "icons/icon-48-inactive.png",
        128: "icons/icon-128-inactive.png",
      },
    },
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
});
