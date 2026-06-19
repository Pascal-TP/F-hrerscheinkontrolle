import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  arrayUnion,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================================
   1. FIREBASE CONFIG EINTRAGEN
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyDlxLnHCi0GXJkMn0J-2Jy1S-5CKs0M85s",
  authDomain: "excel-entfernung-488712.firebaseapp.com",
  projectId: "excel-entfernung-488712",
  storageBucket: "excel-entfernung-488712.firebasestorage.app",
  messagingSenderId: "338667062868",
  appId: "1:338667062868:web:b20d82d7fecc1d55368fc1",
  measurementId: "G-449YH2BBZJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================================================
   2. ELEMENTE
   ========================================================= */
const employeeView = document.getElementById("employee-view");
const managerLoginView = document.getElementById("manager-login-view");
const managerView = document.getElementById("manager-view");

const pinInput = document.getElementById("pinInput");
const startScanBtn = document.getElementById("startScanBtn");
const cancelScanBtn = document.getElementById("cancelScanBtn");
const scannerBox = document.getElementById("scannerBox");
const employeeMessage = document.getElementById("employeeMessage");

const showManagerLoginBtn = document.getElementById("showManagerLoginBtn");
const backToEmployeeBtn = document.getElementById("backToEmployeeBtn");

const managerEmail = document.getElementById("managerEmail");
const managerPassword = document.getElementById("managerPassword");
const managerLoginBtn = document.getElementById("managerLoginBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const loginMessage = document.getElementById("loginMessage");

const logoutBtn = document.getElementById("logoutBtn");
const newPinInput = document.getElementById("newPinInput");
const createPinBtn = document.getElementById("createPinBtn");
const pinMessage = document.getElementById("pinMessage");

const qrPinSelect = document.getElementById("qrPinSelect");
const qrCanvas = document.getElementById("qrCanvas");
const qrLabel = document.getElementById("qrLabel");

const pinTableBody = document.getElementById("pinTableBody");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");

let html5QrCode = null;
let cachedPins = [];

/* =========================================================
   3. HILFSFUNKTIONEN
   ========================================================= */
function show(view) {
  employeeView.classList.add("hidden");
  managerLoginView.classList.add("hidden");
  managerView.classList.add("hidden");
  view.classList.remove("hidden");
}

function showMessage(el, text, type = "success") {
  el.textContent = text;
  el.className = `message ${type}`;
  el.classList.remove("hidden");
}

function hideMessage(el) {
  el.textContent = "";
  el.className = "message hidden";
}

function normalizePin(value) {
  return String(value || "").trim();
}

function isValidPin(pin) {
  return /^\d{5}$/.test(pin);
}

function formatDate(value) {
  if (!value) return "-";

  if (value.toDate) {
    return value.toDate().toLocaleString("de-DE");
  }

  const date = new Date(value);
  if (!isNaN(date)) return date.toLocaleString("de-DE");

  return "-";
}

/* =========================================================
   4. MITARBEITER: PIN + QR SCAN
   ========================================================= */
startScanBtn.addEventListener("click", async () => {
  hideMessage(employeeMessage);

  const enteredPin = normalizePin(pinInput.value);

  if (!isValidPin(enteredPin)) {
    showMessage(employeeMessage, "Bitte geben Sie eine gültige 5-stellige PIN ein.", "error");
    return;
  }

  const pinRef = doc(db, "licensePins", enteredPin);
  const pinSnap = await getDoc(pinRef);

  if (!pinSnap.exists()) {
    showMessage(employeeMessage, "Diese PIN ist nicht bekannt. Bitte wenden Sie sich an den Fuhrparkmanager.", "error");
    return;
  }

  scannerBox.classList.remove("hidden");

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("qr-reader");
  }

  try {
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 230, height: 230 } },
      async (decodedText) => {
        const scannedPin = normalizePin(decodedText);

        if (scannedPin !== enteredPin) {
          showMessage(employeeMessage, "Der gescannte QR-Code passt nicht zur eingegebenen PIN.", "error");
          return;
        }

        await html5QrCode.stop();
        scannerBox.classList.add("hidden");

        await updateDoc(pinRef, {
          lastCheckAt: serverTimestamp(),
          checkCount: (pinSnap.data().checkCount || 0) + 1,
          checks: arrayUnion({
            checkedAt: new Date().toISOString()
          })
        });

        pinInput.value = "";
        showMessage(employeeMessage, "Vielen Dank. Die Führerscheinkontrolle wurde erfolgreich bestätigt.", "success");
      },
      () => {
        // Scan-Fehler während laufender Kamera ignorieren
      }
    );
  } catch (error) {
    console.error(error);
    showMessage(employeeMessage, "Die Kamera konnte nicht geöffnet werden. Bitte Kamerazugriff erlauben.", "error");
  }
});

cancelScanBtn.addEventListener("click", async () => {
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
    } catch (error) {
      console.warn(error);
    }
  }
  scannerBox.classList.add("hidden");
});

/* =========================================================
   5. LOGIN FUHRPARKMANAGER
   ========================================================= */
showManagerLoginBtn.addEventListener("click", () => {
  hideMessage(loginMessage);
  show(managerLoginView);
});

backToEmployeeBtn.addEventListener("click", () => {
  show(employeeView);
});

managerLoginBtn.addEventListener("click", async () => {
  hideMessage(loginMessage);

  try {
    await signInWithEmailAndPassword(auth, managerEmail.value.trim(), managerPassword.value);
  } catch (error) {
    console.error(error);
    showMessage(loginMessage, "Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.", "error");
  }
});

forgotPasswordBtn.addEventListener("click", async () => {
  hideMessage(loginMessage);

  const email = managerEmail.value.trim();

  if (!email) {
    showMessage(loginMessage, "Bitte zuerst die E-Mail-Adresse eintragen.", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage(loginMessage, "Eine E-Mail zum Zurücksetzen des Passworts wurde versendet.", "success");
  } catch (error) {
    console.error(error);
    showMessage(loginMessage, "Die Passwort-E-Mail konnte nicht versendet werden.", "error");
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  show(employeeView);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    show(managerView);
    await loadPins();
  }
});

/* =========================================================
   6. FUHRPARKMANAGER: PIN ANLEGEN
   ========================================================= */
createPinBtn.addEventListener("click", async () => {
  hideMessage(pinMessage);

  const pin = normalizePin(newPinInput.value);

  if (!isValidPin(pin)) {
    showMessage(pinMessage, "Bitte eine 5-stellige PIN eingeben.", "error");
    return;
  }

  const pinRef = doc(db, "licensePins", pin);
  const pinSnap = await getDoc(pinRef);

  if (pinSnap.exists()) {
    showMessage(pinMessage, "Diese PIN ist bereits vorhanden.", "error");
    return;
  }

  try {
    await setDoc(pinRef, {
      pin,
      createdAt: serverTimestamp(),
      lastCheckAt: null,
      checkCount: 0,
      checks: []
    });

    newPinInput.value = "";
    showMessage(pinMessage, "PIN wurde angelegt.", "success");
    await loadPins();
  } catch (error) {
    console.error(error);
    showMessage(pinMessage, "PIN konnte nicht angelegt werden.", "error");
  }
});

/* =========================================================
   7. FUHRPARKMANAGER: LISTE LADEN
   ========================================================= */
async function loadPins() {
  const q = query(collection(db, "licensePins"), orderBy("pin", "asc"));
  const snapshot = await getDocs(q);

  cachedPins = [];
  pinTableBody.innerHTML = "";
  qrPinSelect.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    cachedPins.push(data);

    const tr = document.createElement("tr");
    tr.innerHTML = `
  <td>${data.pin}</td>
  <td>${formatDate(data.lastCheckAt)}</td>
  <td>${data.checkCount || 0}</td>
  <td>${formatDate(data.createdAt)}</td>
  <td></td>
`;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Löschen";
    deleteBtn.className = "secondary-btn";
    deleteBtn.style.marginTop = "0";

    deleteBtn.addEventListener("click", async () => {
      const ok = confirm(`Soll die PIN ${data.pin} wirklich gelöscht werden?`);
      if (!ok) return;

      await deleteDoc(doc(db, "licensePins", data.pin));
      await loadPins();
    });

    tr.children[4].appendChild(deleteBtn);
    pinTableBody.appendChild(tr);

    const option = document.createElement("option");
    option.value = data.pin;
    option.textContent = data.pin;
    qrPinSelect.appendChild(option);
  });

  createQrPreview();
}

qrPinSelect.addEventListener("change", createQrPreview);

function createQrPreview() {
  const selectedPin = qrPinSelect.value;

  if (!selectedPin) {
    qrLabel.textContent = "Keine PIN ausgewählt";
    qrCanvas.innerHTML = "";
    return;
  }

  if (typeof QRCode === "undefined") {
    qrLabel.textContent = "QR-Code-Bibliothek wurde nicht geladen.";
    return;
  }

  const qrContainer = document.querySelector(".qr-preview");
  qrContainer.innerHTML = `
    <div id="qrCanvas"></div>
    <div id="qrLabel" class="qr-label"></div>
  `;

  new QRCode(document.getElementById("qrCanvas"), {
    text: selectedPin,
    width: 180,
    height: 180
  });

  document.getElementById("qrLabel").textContent = `PIN: ${selectedPin}`;
}

/* =========================================================
   8. CSV DOWNLOAD
   ========================================================= */
downloadCsvBtn.addEventListener("click", () => {
  const rows = [
    ["PIN", "Letzte Prüfung", "Anzahl Prüfungen", "Erstellt am"]
  ];

  cachedPins.forEach((item) => {
    rows.push([
      item.pin,
      formatDate(item.lastCheckAt),
      item.checkCount || 0,
      formatDate(item.createdAt)
    ]);
  });

  const csv = rows
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `fuehrerscheinkontrolle_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
});
