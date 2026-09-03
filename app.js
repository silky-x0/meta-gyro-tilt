// @ts-check
// Format Press — extracted from index.html <script> for maintainability (ES2020, vanilla). Keep inline for single-file demo.
// See index.html:1020-1840 for original with JSDoc. Run with --checkJs for type hints.

const $ = (id) => document.getElementById(id);
    const dropZone = $("dropZone");
    const dropContent = $("dropContent");
    const previewWrap = $("previewWrap");
    const preview = $("preview");
    const previewLabel = $("previewLabel");
    const fileInput = $("fileInput");
    const cameraInput = $("cameraInput");
    const fileName = $("fileName");
    const fileMeta = $("fileMeta");
    const convertBtn = $("convertBtn");
    const convertText = $("convertText");
    const copyBtn = $("copyBtn");
    const saveBtn = $("saveBtn");
    const status = $("status");
    const outputState = $("outputState");
    const stateMark = $("stateMark");
    const stateTitle = $("stateTitle");
    const stateDescription = $("stateDescription");
    const sizeValue = $("sizeValue");
    const base64Value = $("base64Value");
    const orientationValue = $("orientationValue");
    const exifValue = $("exifValue");
    const dimensionsValue = $("dimensionsValue");
    const presetMeta = $("presetMeta");
    const presetStory = $("presetStory");
    const presetHint = $("presetHint");
    const tiltRange = $("tiltRange");
    const tiltValue = $("tiltValue");
    const tiltOut = $("tiltOut");
    const safeToggle = $("safeToggle");
    const safeOverlay = $("safeOverlay");
    const revertBtn = $("revertBtn");
    const dropStatus = $("dropStatus");

    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB guard — prevents OOM on 3024×4032 canvas + 2 base64 copies
    let sourceDataUrl = null;
    let finalDataUrl = null;
    let pureBase64 = null;
    let sourceFile = null;
    let sourceDataUrlBackup = null; // for undo/revert
    let fitMode = 'cover'; // 'cover' | 'contain' | 'stretch' — cover is best for Stories (no squash)
    let tiltDeg = 0; // -15..15 manual gyro nudge
    let exportPreset = 'meta'; // 'meta' = 3024×4032, 'story' = 1080×1920
    const consentModal = $("consentModal");
    const consentCheck = $("consentCheck");
    const consentClose = $("consentClose");
    // First-visit modal — localStorage gate
    (function initConsent() {
      try {
        if (localStorage.getItem("formatPressConsent") === "true") {
          consentModal.classList.remove("visible");
          consentModal.setAttribute("aria-hidden", "true");
        } else {
          consentModal.classList.add("visible");
          consentModal.setAttribute("aria-hidden", "false");
        }
      } catch { // private mode
        consentModal.classList.add("visible");
      }
      consentCheck?.addEventListener("change", () => {
        consentClose.disabled = !consentCheck.checked;
      });
      consentClose?.addEventListener("click", () => {
        if (!consentCheck.checked) return;
        try { localStorage.setItem("formatPressConsent", "true"); } catch {}
        consentModal.classList.remove("visible");
        consentModal.setAttribute("aria-hidden", "true");
      });
      consentModal?.addEventListener("click", (e) => {
        if (e.target === consentModal && consentCheck.checked) consentClose.click();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && consentModal.classList.contains("visible") && consentCheck.checked) {
          consentClose.click();
        }
      });
    })();

    // Export preset / Fit / Tilt / Safe overlay controls
    (function initControls() {
      function updateDimensionsUI() {
        const { w, h } = getExportDimensions();
        if (dimensionsValue) dimensionsValue.textContent = `${w} × ${h} px`;
        if (presetHint) presetHint.textContent = exportPreset === 'story' ? 'Story 9:16' : 'Meta 3:4';
      }
      updateDimensionsUI();

      presetMeta?.addEventListener("click", () => {
        exportPreset = 'meta';
        presetMeta.classList.add("active"); presetMeta.setAttribute("aria-pressed","true");
        presetStory.classList.remove("active"); presetStory.setAttribute("aria-pressed","false");
        updateDimensionsUI();
        if (sourceDataUrl && finalDataUrl) showStatus("Preset → Meta 3024×4032. Tap Stamp again to re-export.", "loading", true);
        else if (sourceDataUrl) showStatus("Preset → Meta 3024×4032. Ready to stamp.", "success");
      });
      presetStory?.addEventListener("click", () => {
        exportPreset = 'story';
        presetStory.classList.add("active"); presetStory.setAttribute("aria-pressed","true");
        presetMeta.classList.remove("active"); presetMeta.setAttribute("aria-pressed","false");
        updateDimensionsUI();
        if (sourceDataUrl && finalDataUrl) showStatus("Preset → Story 1080×1920 (fills Instagram). Tap Stamp again.", "loading", true);
        else if (sourceDataUrl) showStatus("Preset → Story 1080×1920 — perfect for Instagram.", "success");
      });

      document.querySelectorAll("[data-fit]").forEach(btn => {
        btn.addEventListener("click", () => {
          fitMode = btn.getAttribute("data-fit");
          document.querySelectorAll("[data-fit]").forEach(b => {
            const isActive = b.getAttribute("data-fit") === fitMode;
            b.classList.toggle("active", isActive);
            b.setAttribute("aria-pressed", String(isActive));
          });
          if (sourceDataUrl && finalDataUrl) showStatus(`Fit → ${fitMode}. Tap Stamp again to apply.`, "loading", true);
        });
      });

      function updateTilt(val) {
        tiltDeg = parseInt(val, 10) || 0;
        if (tiltValue) tiltValue.textContent = `${tiltDeg > 0 ? '+' : ''}${tiltDeg}°`;
        if (tiltOut) tiltOut.textContent = `${tiltDeg > 0 ? '+' : ''}${tiltDeg}°`;
        // live preview tilt on preview image via CSS for immediacy (does not affect export until stamped)
        if (sourceDataUrl && !finalDataUrl) {
          preview.style.transform = tiltDeg ? `rotate(${tiltDeg}deg)` : 'none';
          preview.style.transition = 'transform .15s ease';
        } else {
          preview.style.transform = 'none';
        }
      }
      tiltRange?.addEventListener("input", (e) => {
        updateTilt(e.target.value);
        if (sourceDataUrl && finalDataUrl) showStatus(`Tilt ${tiltDeg > 0 ? '+' : ''}${tiltDeg}° — tap Stamp to bake it.`, "loading", true);
      });
      updateTilt(tiltRange?.value || "0");

      safeToggle?.addEventListener("change", () => {
        if (safeToggle.checked) safeOverlay.classList.add("visible");
        else safeOverlay.classList.remove("visible");
      });

      revertBtn?.addEventListener("click", () => {
        if (sourceDataUrlBackup || sourceDataUrl) {
          finalDataUrl = null;
          pureBase64 = null;
          preview.src = sourceDataUrl;
          previewLabel.textContent = "Source ready";
          revertBtn.style.display = "none";
          preview.style.transform = tiltDeg ? `rotate(${tiltDeg}deg)` : 'none';
          outputState.classList.remove("ready");
          stateMark.textContent = "—";
          stateTitle.textContent = "Reverted to source";
          stateDescription.textContent = "Stamp again with new settings.";
          sizeValue.textContent = "—";
          base64Value.textContent = "Unavailable";
          base64Value.classList.remove("ready");
          copyBtn.disabled = true;
          saveBtn.disabled = true;
          convertBtn.disabled = false;
          convertText.textContent = "Stamp output";
          setStepState("loaded");
          showStatus("Reverted to original source. Ready to stamp again.", "success");
        }
      });
    })();

    /** @type {string | null} */ let lastError = null;

    function openLibrary() { fileInput.click(); }
    function openCamera() { cameraInput.click(); }

    $("selectText").addEventListener("click", (event) => {
      event.stopPropagation();
      openLibrary();
    });
    $("changeBtn").addEventListener("click", openLibrary);
    $("libraryBtn").addEventListener("click", openLibrary);
    $("cameraBtn").addEventListener("click", openCamera);
    dropZone.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openLibrary();
    });
    dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLibrary();
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove("dragging");
      });
    });
    dropZone.addEventListener("drop", (event) => {
      const file = event.dataTransfer.files?.[0];
      if (file) handleFile(file);
    });

    fileInput.addEventListener("change", () => {
      if (fileInput.files?.[0]) handleFile(fileInput.files[0]);
      fileInput.value = "";
    });
    cameraInput.addEventListener("change", () => {
      if (cameraInput.files?.[0]) handleFile(cameraInput.files[0]);
      cameraInput.value = "";
    });

    function formatBytes(bytes) {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function handleFile(file) {
      if (file.type !== "image/jpeg" && !/\.jpe?g$/i.test(file.name)) {
        showStatus("Please choose a JPG or JPEG image — PNG/WebP/HEIC are not supported (Meta pipeline is JPEG only).", "error");
        dropZone.classList.add("error");
        setTimeout(() => dropZone.classList.remove("error"), 800);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        showStatus(`File too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_FILE_SIZE)} to prevent browser OOM on 3024×4032 canvas. Try compressing first.`, "error");
        dropZone.classList.add("error");
        setTimeout(() => dropZone.classList.remove("error"), 900);
        return;
      }

      // Revoke previous object URLs / backup for undo
      if (sourceDataUrl) sourceDataUrlBackup = sourceDataUrl;

      const reader = new FileReader();
      reader.onload = (event) => {
        sourceFile = file;
        sourceDataUrl = event.target.result;
        finalDataUrl = null;
        pureBase64 = null;

        preview.src = sourceDataUrl;
        preview.style.transform = tiltDeg ? `rotate(${tiltDeg}deg)` : 'none';
        preview.style.transition = tiltDeg ? 'transform .15s ease' : 'none';
        previewLabel.textContent = "Source ready";
        previewWrap.classList.add("visible");
        dropContent.style.display = "none";
        dropZone.classList.add("has-preview");
        dropZone.classList.remove("error");
        fileName.textContent = file.name || "Selected photo";
        fileMeta.textContent = `${formatBytes(file.size)} · Ready to inspect`;
        convertBtn.disabled = false;
        convertText.textContent = "Stamp output";
        copyBtn.disabled = true;
        saveBtn.disabled = true;
        if (revertBtn) revertBtn.style.display = "none";
        outputState.classList.remove("ready");
        stateMark.textContent = "—";
        stateTitle.textContent = "Ready to stamp";
        stateDescription.textContent = `Cover • ${tiltDeg ? tiltDeg+'° tilt • ' : ''}Orientation & GPS will be normalized.`;
        const { w, h } = getExportDimensions();
        dimensionsValue.textContent = `${w} × ${h} px`;
        sizeValue.textContent = "—";
        base64Value.textContent = "Unavailable";
        base64Value.classList.remove("ready");
        setStepState("loaded");
        hideStatus();
        if (safeOverlay && safeToggle?.checked) safeOverlay.classList.add("visible");
      };
      reader.onerror = () => showStatus("Could not read that image. Try another JPG.", "error");
      reader.readAsDataURL(file);
    }

    function setStepState(state) {
      const steps = [$("stepLoad"), $("stepInspect"), $("stepStamp")];
      steps.forEach((step) => step.classList.remove("active", "done"));
      if (state === "loaded") {
        steps[0].classList.add("done");
        steps[1].classList.add("active");
      } else if (state === "stamped") {
        steps[0].classList.add("done");
        steps[1].classList.add("done");
        steps[2].classList.add("active");
      } else {
        steps[0].classList.add("active");
      }
    }

    function showStatus(message, type = "success", loading = false) {
      status.className = `status visible ${type}`;
      status.innerHTML = loading
        ? `<span class="spinner" aria-hidden="true"></span><span>${message}</span>`
        : `<span aria-hidden="true">${type === "success" ? "✓" : "!"}</span><span>${message}</span>`;
      if (dropStatus) dropStatus.textContent = message;
      lastError = type === "error" ? message : null;
    }

    function hideStatus() {
      status.className = "status";
      status.textContent = "";
    }

    function readOrientation(dataUrl) {
      try {
        const exif = piexif.load(dataUrl);
        return exif["0th"][piexif.ImageIFD.Orientation] || 1;
      } catch {
        return 1;
      }
    }

    /** Convert Blob → DataURL (for piexif) */
    function blobToDataURL(blob) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error("Blob read failed"));
        r.readAsDataURL(blob);
      });
    }

    /**
     * Draw with EXIF orientation + optional gyro tilt + fitMode, using toBlob (lower memory)
     * @param {string} dataUrl - source
     * @param {number} targetW
     * @param {number} targetH
     * @param {number} orientation - 1..8
     * @param {string} fitMode - 'cover' | 'contain' | 'stretch'
     * @param {number} tiltDeg - -15..15 manual gyro nudge
     */
    function drawCorrected(dataUrl, targetW, targetH, orientation, fitMode = 'cover', tiltDeg = 0) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const rotated = orientation >= 5 && orientation <= 8;
          canvas.width = rotated ? targetH : targetW;
          canvas.height = rotated ? targetW : targetH;
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Canvas is unavailable"));
            return;
          }

          // Background for contain/tilt letterbox
          context.fillStyle = "#0c0c0b";
          context.fillRect(0, 0, canvas.width, canvas.height);

          // EXIF orientation (setTransform resets matrix)
          switch (orientation) {
            case 2: context.setTransform(-1, 0, 0, 1, targetW, 0); break;
            case 3: context.setTransform(-1, 0, 0, -1, targetW, targetH); break;
            case 4: context.setTransform(1, 0, 0, -1, 0, targetH); break;
            case 5: context.setTransform(0, 1, 1, 0, 0, 0); break;
            case 6: context.setTransform(0, 1, -1, 0, targetH, 0); break;
            case 7: context.setTransform(0, -1, -1, 0, targetH, targetW); break;
            case 8: context.setTransform(0, -1, 1, 0, 0, targetW); break;
            default: context.setTransform(1, 0, 0, 1, 0, 0);
          }

          // Manual gyro tilt — composed after orientation
          if (tiltDeg) {
            // Move origin to canvas center, rotate, move back
            // Need to compensate for current transform: use transform() not setTransform
            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate(tiltDeg * Math.PI / 180);
            context.translate(-canvas.width / 2, -canvas.height / 2);
          }

          const iw = image.naturalWidth || targetW;
          const ih = image.naturalHeight || targetH;
          const dw = canvas.width;
          const dh = canvas.height;

          if (fitMode === 'stretch') {
            context.drawImage(image, 0, 0, dw, dh);
          } else {
            const scaleCover = Math.max(dw / iw, dh / ih);
            const scaleContain = Math.min(dw / iw, dh / ih);
            const scale = fitMode === 'cover' ? scaleCover : scaleContain;
            const w = iw * scale;
            const h = ih * scale;
            const x = (dw - w) / 2;
            const y = (dh - h) / 2;
            // For contain, background already filled; for cover we just draw centered cropped
            context.drawImage(image, x, y, w, h);
          }

          // Use toBlob (async, lower peak memory than toDataURL)
          canvas.toBlob(async (blob) => {
            if (!blob) {
              reject(new Error("Canvas export failed — image may be too large for this browser"));
              return;
            }
            try {
              const dataUrlOut = await blobToDataURL(blob);
              resolve(dataUrlOut);
            } catch (e) { reject(e); }
          }, "image/jpeg", 0.95);
        };
        image.onerror = () => reject(new Error("Image could not be decoded — file may be corrupted"));
        image.src = dataUrl;
      });
    }

    function getExportDimensions() {
      return exportPreset === 'story' ? { w: 1080, h: 1920 } : { w: 3024, h: 4032 };
    }

    function buildExif(dataUrl, targetW = 3024, targetH = 4032) {
      let exif;
      try {
        exif = piexif.load(dataUrl);
      } catch {
        exif = { "0th": {}, "Exif": {}, "GPS": {}, "1st": {}, thumbnail: null };
      }
      exif.GPS = {};
      delete exif["0th"][piexif.ImageIFD.Software];
      delete exif["0th"][piexif.ImageIFD.HostComputer];
      delete exif.Exif[piexif.ExifIFD.MakerNote];
      delete exif.Exif[piexif.ExifIFD.LensMake];
      delete exif.Exif[piexif.ExifIFD.LensModel];
      delete exif.Exif[piexif.ExifIFD.LensSpecification];
      exif["0th"][piexif.ImageIFD.Make] = "Meta AI";
      exif["0th"][piexif.ImageIFD.Model] = "Ray-Ban Meta Smart Glasses 2";
      exif["0th"][piexif.ImageIFD.Orientation] = 1;
      exif.Exif[piexif.ExifIFD.ColorSpace] = 1;
      exif.Exif[piexif.ExifIFD.PixelXDimension] = targetW;
      exif.Exif[piexif.ExifIFD.PixelYDimension] = targetH;
      return exif;
    }

    function dataUrlToBlob(dataUrl) {
      const [header, encoded] = dataUrl.split(",");
      const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return new Blob([bytes], { type: mime });
    }

    async function copyText(text) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      if (!document.execCommand("copy")) throw new Error("Copy failed");
      textarea.remove();
    }

    async function saveOrShareImage(dataUrl, filename = "meta-glasses-converted.jpg") {
      const blob = dataUrlToBlob(dataUrl);
      const file = new File([blob], filename, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Meta Frame",
            text: "Converted Ray-Ban Meta image"
          });
          return "shared";
        } catch (error) {
          if (error.name === "AbortError") return "cancelled";
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      return "downloaded";
    }

    async function convertImage() {
      const { w, h } = getExportDimensions();
      const orientation = readOrientation(sourceDataUrl);
      let corrected;
      try {
        corrected = await drawCorrected(sourceDataUrl, w, h, orientation, fitMode, tiltDeg);
      } catch (e) {
        throw new Error(`Canvas step failed: ${e.message}`);
      }
      let exifBytes;
      try {
        exifBytes = piexif.dump(buildExif(sourceDataUrl, w, h));
      } catch (e) {
        throw new Error(`EXIF build failed: ${e.message}`);
      }
      try {
        finalDataUrl = piexif.insert(exifBytes, corrected);
      } catch (e) {
        throw new Error(`EXIF insert failed: ${e.message}`);
      }
      pureBase64 = finalDataUrl.split(",")[1];
      if (!pureBase64) throw new Error("Base64 extraction failed");
      return { orientation, w, h };
    }

    convertBtn.addEventListener("click", async () => {
      if (!sourceDataUrl) return;
      convertBtn.disabled = true;
      copyBtn.disabled = true;
      saveBtn.disabled = true;
      convertText.textContent = "Stamping…";
      showStatus("Normalizing orientation and writing output metadata…", "loading", true);

      try {
        const { orientation, w, h } = await convertImage();
        preview.src = finalDataUrl;
        preview.style.transform = "none"; // clear live tilt preview — baked into canvas
        previewLabel.textContent = exportPreset === 'story' ? "Story ready 1080×1920" : "Output ready 3024×4032";
        outputState.classList.add("ready");
        stateMark.textContent = "✓";
        stateTitle.textContent = exportPreset === 'story' ? "Story stamped" : "Output stamped";
        stateDescription.textContent = fitMode === 'cover' ? "Cover-cropped • Tilt baked • Ready for Instagram." : `Fit: ${fitMode} • Tilt: ${tiltDeg}° • Ready.`;
        orientationValue.textContent = orientation === 1 ? "Already correct" : `Corrected${tiltDeg ? ` + ${tiltDeg}°` : ''}`;
        exifValue.textContent = "Clean + stamped";
        dimensionsValue.textContent = `${w} × ${h} px`;
        sizeValue.textContent = formatBytes(dataUrlToBlob(finalDataUrl).size);
        base64Value.textContent = "Available";
        base64Value.classList.add("ready");
        copyBtn.disabled = false;
        saveBtn.disabled = false;
        convertBtn.disabled = false;
        convertText.textContent = "Stamp again";
        revertBtn.style.display = "inline-flex";
        setStepState("stamped");
        showStatus(exportPreset === 'story' ? "Story ready — 1080×1920, GPS stripped. Share to Instagram!" : "Output ready. GPS and private lens metadata were removed. (Cover = no squash)", "success");
      } catch (error) {
        console.error(error);
        lastError = error.message;
        convertBtn.disabled = false;
        convertText.textContent = "Try again";
        dropZone.classList.add("error");
        setTimeout(()=>dropZone.classList.remove("error"),800);
        showStatus(error.message.includes("Canvas") ? error.message : `Conversion failed: ${error.message}. Try another JPG or lower tilt.`, "error");
      }
    });

    copyBtn.addEventListener("click", async () => {
      if (!pureBase64) return;
      try {
        await copyText(pureBase64);
        showStatus("Base64 copied to your clipboard.", "success");
      } catch {
        showStatus("Clipboard access was blocked by this browser.", "error");
      }
    });

    saveBtn.addEventListener("click", async () => {
      if (!finalDataUrl) return;
      const { w, h } = getExportDimensions();
      const fname = exportPreset === 'story' ? `meta-story-${w}x${h}.jpg` : `meta-glasses-${w}x${h}.jpg`;
      try {
        const result = await saveOrShareImage(finalDataUrl, fname);
        if (result === "cancelled") {
          showStatus("Share cancelled. Your output is still ready.", "success");
        } else {
          showStatus(result === "shared" ? `Share sheet opened (${w}×${h}). Pick Instagram → Story!` : `Download started (${fname}).`, "success");
        }
      } catch {
        showStatus("Could not save this output in the current browser.", "error");
      }
    });

    // PWA — register service worker for offline lab use (no image caching)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }