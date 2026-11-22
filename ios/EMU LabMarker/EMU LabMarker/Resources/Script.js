// The native side (ViewController.swift) calls show() with the extension state and
// receives taps through the "controller" message handler.

function send(action) {
    webkit.messageHandlers.controller.postMessage(action);
}

// enabled: true, false, or null when the system cannot tell (iOS before 26.2).
// canOpenSettings: whether this iOS can open the extension's settings page.
function show(enabled, canOpenSettings) {
    document.body.dataset.enabled = enabled === null ? "unknown" : String(enabled);

    const detail = document.getElementById("enable-detail");
    const settings = document.getElementById("open-settings");
    const portal = document.getElementById("open-portal");

    if (enabled === true) {
        detail.textContent = "Açık";
        // The first step is done; the portal becomes the main action.
        settings.className = "secondary";
        portal.className = "primary";
        portal.parentElement.prepend(portal);
    } else {
        detail.textContent = canOpenSettings
            ? "Aşağıdaki düğmeyle ayarları aç, \"Genişletmeye İzin Ver\"i aç."
            : "Ayarlar'da Safari › Genişletmeler › EMU LabMarker";
        settings.className = "primary";
        portal.className = "secondary";
        settings.parentElement.prepend(settings);
    }
    settings.hidden = !canOpenSettings;
}

document.getElementById("open-settings").addEventListener("click", () => send("open-settings"));
document.getElementById("open-portal").addEventListener("click", () => send("open-portal"));
document.getElementById("open-site").addEventListener("click", () => send("open-site"));
document.getElementById("open-privacy").addEventListener("click", () => send("open-privacy"));
