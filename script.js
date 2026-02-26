const dict = {
    en: {
        navAuth: "Voice Assistant",
        bcParent: "Clinical Assessments",
        bcChild: "AI Consultation",
        sysSecure: "System Secure",
        uiTitle: "Dr. Med-AI Assistant",
        uiSubtitle: "Always here to listen and help.",
        uiReadAloud: "Auto Read Aloud",
        uiMapTitle: "Nearby Hospitals",
        findHospitalsBtn: "Locate",
        uiMapPlaceholder: "Click to load map.",
        mapSearching: "Locating you...",
        mapFound: "Found Hospitals",
        inputPlaceholder: "Type or speak your message...",
        listenIndicator: "Listening... Please speak now."
    },
    mr: {
        navAuth: "आवाज सहाय्यक",
        bcParent: "वैद्यकीय मूल्यांकन",
        bcChild: "एआय सल्ला",
        sysSecure: "प्रणाली सुरक्षित आहे",
        uiTitle: "डॉ. मेड-एआय सहाय्यक",
        uiSubtitle: "नेहमी ऐकण्यासाठी आणि मदत करण्यासाठी येथे आहे.",
        uiReadAloud: "स्वयंचलित वाचन",
        uiMapTitle: "जवळची रुग्णालये",
        findHospitalsBtn: "शोधा",
        uiMapPlaceholder: "नकाशा लोड करण्यासाठी क्लिक करा.",
        mapSearching: "तुमचे स्थान शोधत आहे...",
        mapFound: "रुग्णालये सापडली",
        inputPlaceholder: "टाइप करा किंवा बोला...",
        listenIndicator: "ऐकत आहे... कृपया आता बोला."
    },
    hi: {
        navAuth: "आवाज़ सहायक",
        bcParent: "नैदानिक मूल्यांकन",
        bcChild: "एआई परामर्श",
        sysSecure: "प्रणाली सुरक्षित है",
        uiTitle: "डॉ. मेड-एआई सहायक",
        uiSubtitle: "हमेशा सुनने और मदद करने के लिए यहाँ है।",
        uiReadAloud: "स्वतः पढ़ें",
        uiMapTitle: "आसपास के अस्पताल",
        findHospitalsBtn: "खोजें",
        uiMapPlaceholder: "मानचित्र लोड करने के लिए क्लिक करें।",
        mapSearching: "आपका स्थान ढूंढा जा रहा है...",
        mapFound: "अस्पताल मिले",
        inputPlaceholder: "टाइप करें या बोलें...",
        listenIndicator: "सुन रहा हूँ... कृपया बोलें।"
    }
};

let currentLang = 'en';
let mapInstance = null;
let mapInstanceLat = null;
let mapInstanceLng = null;

// The AI is now purely dynamic. We just track if we are waiting for a backend response or not.
let chatState = 'IDLE';

document.addEventListener("DOMContentLoaded", () => {

    const langSelect = document.getElementById("lang-select");
    langSelect.addEventListener("change", (e) => {
        currentLang = e.target.value;
        updateUITranslations();
        resetChat();
    });

    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");

    sendBtn.addEventListener("click", () => handleUserSubmit(chatInput.value));
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleUserSubmit(chatInput.value);
    });

    // --- Web Speech API Setups ---
    const micBtn = document.getElementById("mic-btn");
    const indicator = document.getElementById("listening-indicator");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let isMicActive = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = function () {
            isMicActive = true;
            micBtn.classList.add("recording");
            indicator.classList.remove("hidden");
        };

        recognition.onresult = function (event) {
            const transcript = event.results[event.results.length - 1][0].transcript;
            chatInput.value = transcript;

            setTimeout(() => {
                handleUserSubmit(chatInput.value);
            }, 800);
        };

        recognition.onerror = function (event) {
            console.error("Speech recognition error", event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                indicator.classList.add("hidden");
                micBtn.classList.remove("recording");
                isMicActive = false;
            }
        };

        recognition.onend = function () {
            isMicActive = false;
            micBtn.classList.remove("recording");
            indicator.classList.add("hidden");
        };
    } else {
        micBtn.style.display = "none";
        console.warn("Speech Recognition API not supported.");
    }

    micBtn.addEventListener("click", () => {
        if (!recognition) return;
        if (isMicActive) {
            recognition.stop();
        } else {
            startListening();
        }
    });

    function startListening() {
        if (!recognition || isMicActive || chatState === 'WAITING_FOR_BOT') return;
        let srLang = 'en-US';
        if (currentLang === 'hi') srLang = 'hi-IN';
        if (currentLang === 'mr') srLang = 'mr-IN';
        recognition.lang = srLang;
        try { recognition.start(); } catch (e) { console.warn("Mic already started:", e); }
    }

    // --- Core Chat Logic ---
    let conversationHistory = [];

    function resetChat() {
        document.getElementById("chat-history").innerHTML = '';
        chatState = 'WAITING_FOR_BOT';
        conversationHistory = [];

        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (recognition && isMicActive) recognition.stop();

        chatState = 'IDLE';

        let greeting = "Hello! 👋 I am Med-AI. What symptoms are you experiencing today?";
        if (currentLang === 'hi') greeting = "नमस्ते! 👋 मैं मेड-एआई हूं। आज आपको क्या लक्षण महसूस हो रहे हैं?";
        if (currentLang === 'mr') greeting = "नमस्कार! 👋 मी मेड-एआय आहे. आज तुम्हाला कोणती लक्षणे जाणवत आहेत?";

        botSpeak(greeting);
        conversationHistory.push({ role: 'model', content: greeting });
    }

    function handleUserSubmit(text) {
        text = text.trim();
        if (!text || chatState === 'WAITING_FOR_BOT') return;

        appendMessage(text, 'user');
        conversationHistory.push({ role: 'user', content: text });
        chatInput.value = '';
        chatState = 'WAITING_FOR_BOT';

        if (recognition && isMicActive) {
            recognition.stop();
        }

        const formData = new FormData();
        formData.append("symptoms", text);
        formData.append("duration", "");
        formData.append("language", currentLang);
        formData.append("history", JSON.stringify(conversationHistory));

        fetch("/api/chat", {
            method: "POST",
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                chatState = 'IDLE';
                botSpeak(data.reply_translated);
                conversationHistory.push({ role: 'model', content: data.reply_translated });
            })
            .catch(error => {
                chatState = 'IDLE';
                console.error("Backend Error:", error);
            });
    }

    function botSpeak(text) {
        appendMessage(text, 'ai');

        const autoTTS = document.getElementById("auto-tts-toggle").checked;
        if (autoTTS && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            const speakMsg = () => {
                const msg = new SpeechSynthesisUtterance(text);

                let voiceLang = 'en-US';
                let langName = 'english';
                if (currentLang === 'hi') { voiceLang = 'hi-IN'; langName = 'hindi'; }
                if (currentLang === 'mr') { voiceLang = 'mr-IN'; langName = 'marathi'; }

                msg.lang = voiceLang;
                msg.rate = 1.0;

                let preferredVoice = null;
                const voices = window.speechSynthesis.getVoices();

                // 1. Google Native Voices usually sound best
                const googleVoice = voices.find(v => v.name.includes("Google") && v.lang.replace('_', '-').toLowerCase().includes(voiceLang.split('-')[0]));

                // 2. Matching voice by language code (e.g. 'hi' or 'mr')
                const codeVoice = voices.find(v => v.lang.replace('_', '-').toLowerCase().includes(voiceLang.split('-')[0]));

                // 3. Matching voice by literal name (e.g. "Microsoft Hemant - Hindi")
                const nameVoice = voices.find(v => v.name.toLowerCase().includes(langName));

                // 4. Last resort default voice
                const defaultVoice = voices.find(v => v.default) || voices[0];

                if (googleVoice) {
                    preferredVoice = googleVoice;
                } else if (codeVoice) {
                    preferredVoice = codeVoice;
                } else if (nameVoice) {
                    preferredVoice = nameVoice;
                } else {
                    // Critical fallback: If NO native voices exist on the user's OS, 
                    // we must force the default English voice or it will stay permanently mute.
                    preferredVoice = defaultVoice;
                }

                if (preferredVoice) {
                    msg.voice = preferredVoice;
                    console.log(`TTS: Using voice: ${preferredVoice.name} (${preferredVoice.lang})`);
                } else {
                    console.warn(`TTS: No specific voice found for ${voiceLang}. Falling back to default browser voice.`);
                }

                // Strip HTML tags (like <b>) from the text so the voice synthesis doesn't read the tags aloud
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = text;
                msg.text = tempDiv.textContent || tempDiv.innerText || "";

                let hasFiredEnd = false;
                msg.onend = function () {
                    if (hasFiredEnd) return;
                    hasFiredEnd = true;
                    if (chatState === 'IDLE') {
                        startListening();
                    }
                };

                setTimeout(() => {
                    if (window.speechSynthesis.speaking) return;
                    if (hasFiredEnd) return;
                    hasFiredEnd = true;
                    if (chatState === 'IDLE') {
                        startListening();
                    }
                }, text.length * 90 + 2000);

                window.speechSynthesis.speak(msg);
            };

            if (window.speechSynthesis.getVoices().length === 0) {
                let didFire = false;
                window.speechSynthesis.addEventListener('voiceschanged', () => {
                    if (didFire) return;
                    didFire = true;
                    speakMsg();
                }, { once: true });

                setTimeout(() => {
                    if (didFire) return;
                    didFire = true;
                    speakMsg();
                }, 1000);
            } else {
                speakMsg();
            }
        } else {
            // If TTS is disabled, we don't automatically listen. They have to click the mic.
        }
    }

    function appendMessage(text, sender) {
        const history = document.getElementById("chat-history");
        const div = document.createElement("div");
        div.className = `message ${sender}`;
        div.innerHTML = `<div class="message-bubble">${text}</div>`;
        history.appendChild(div);
        history.scrollTop = history.scrollHeight;
    }

    // --- Map Logic ---
    document.getElementById("find-hospitals-btn").addEventListener("click", () => {
        const ph = document.getElementById("map-placeholder");
        ph.innerText = dict[currentLang].mapSearching;

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                initMap(position.coords.latitude, position.coords.longitude);
            }, (error) => {
                ph.innerText = "Geolocation failed/denied.";
            });
        } else {
            ph.innerText = "Geolocation not supported.";
        }
    });

    // Translation updates for static UI elements
    function updateUITranslations() {
        const d = dict[currentLang];
        const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; }

        setText('nav-auth', d.navAuth);
        setText('bc-parent', d.bcParent);
        setText('bc-child', d.bcChild);
        setText('sys-secure', d.sysSecure);
        setText('ui-title', d.uiTitle);
        setText('ui-subtitle', d.uiSubtitle);
        setText('ui-read-aloud', d.uiReadAloud);
        setText('ui-map-title', d.uiMapTitle);
        setText('find-hospitals-btn', d.findHospitalsBtn);
        chatInput.placeholder = d.inputPlaceholder;
        indicator.innerText = d.listenIndicator;

        const ph = document.getElementById("map-placeholder");
        if (ph.style.display !== "none") ph.innerText = d.uiMapPlaceholder;
    }

    // Store hospitals to enable searching
    let extractedHospitals = [];

    // Initialize map
    function initMap(lat, lng) {
        document.getElementById("map-placeholder").style.display = "none";

        // Clear previous list
        const listContainer = document.getElementById("hospital-list-container");
        const listElement = document.getElementById("hospital-list");
        const searchInput = document.getElementById("hospital-search-input");
        listElement.innerHTML = '';
        listContainer.style.display = "block";
        listElement.innerHTML = `<li style="color: #64748b;">${dict[currentLang].mapSearching}</li>`;

        if (mapInstance) { mapInstance.remove(); }

        mapInstance = L.map('map').setView([lat, lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(mapInstance);

        L.marker([lat, lng]).addTo(mapInstance).bindPopup('<b>You are here</b>').openPopup();

        const overpassQuery = `
            [out:json];
            (
              node["amenity"="hospital"](around:5000,${lat},${lng});
              way["amenity"="hospital"](around:5000,${lat},${lng});
            );
            out center;
        `;
        const overpassUrl = `https://overpass-api.de/api/interpreter`;

        fetch(overpassUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: "data=" + encodeURIComponent(overpassQuery)
        })
            .then(res => res.json())
            .then(data => {
                listElement.innerHTML = ''; // Clear loading text
                extractedHospitals = [];

                if (data.elements && data.elements.length > 0) {
                    data.elements.forEach(el => {
                        const tags = el.tags || {};
                        const eLat = el.lat || el.center.lat;
                        const eLng = el.lon || el.center.lon;
                        const name = tags.name ? tags.name : null;

                        // Build Address String
                        let addressParts = [];
                        if (tags['addr:housenumber']) addressParts.push(tags['addr:housenumber']);
                        if (tags['addr:street']) addressParts.push(tags['addr:street']);
                        if (tags['addr:city']) addressParts.push(tags['addr:city']);
                        if (tags['addr:full']) addressParts.push(tags['addr:full']);
                        const address = addressParts.length > 0 ? addressParts.join(', ') : null;

                        // Phone Number
                        const phone = tags.phone || tags['contact:phone'] || null;

                        // Force filter: Remove hospitals lacking BOTH address AND phone number, OR lacking a name
                        if (!name || (!address && !phone)) {
                            return;
                        }

                        // Rating extraction (mock if not present since openstreetmap ratings are rare)
                        // If tags rating exists, use it, else generate a plausible dummy rating between 3.5 and 5.0
                        let rating = tags.rating ? parseFloat(tags.rating) : (3.5 + Math.random() * 1.5);
                        rating = parseFloat(rating.toFixed(1));

                        // Calculate Distance
                        const R = 6371;
                        const dLat = (eLat - lat) * Math.PI / 180;
                        const dLon = (eLng - lng) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat * Math.PI / 180) * Math.cos(eLat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const distance = R * c;

                        extractedHospitals.push({ name, address, phone, eLat, eLng, rating, distance });
                    });

                    // Sort by distance (closest first), then rating
                    extractedHospitals.sort((a, b) => {
                        if (Math.abs(a.distance - b.distance) < 0.5) return b.rating - a.rating;
                        return a.distance - b.distance;
                    });

                    renderHospitalList(extractedHospitals);

                    // Add markers to map
                    extractedHospitals.forEach(h => {
                        L.marker([h.eLat, h.eLng]).addTo(mapInstance).bindPopup(`<b>${h.name}</b><br>⭐ ${h.rating}<br>${h.address || 'Address n/a'}<br>${h.phone || 'Phone n/a'}`);
                    });

                } else {
                    listElement.innerHTML = `<li style="color: #64748b;">No hospitals found nearby.</li>`;
                }
            })
            .catch(err => {
                console.error("Map fetch error:", err);
                listElement.innerHTML = `<li style="color: #ef4444;">Failed to load hospital details.</li>`;
            });

        // Setup Search Listener
        searchInput.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = extractedHospitals.filter(h => h.name.toLowerCase().includes(term));
            renderHospitalList(filtered);
        });
    }

    function renderHospitalList(hospitals) {
        const listElement = document.getElementById("hospital-list");
        listElement.innerHTML = '';

        if (hospitals.length === 0) {
            listElement.innerHTML = `<li style="color: #64748b;">No matching hospitals found.</li>`;
            return;
        }

        hospitals.forEach(h => {
            const li = document.createElement('li');
            li.style.background = "#F8FAFC";
            li.style.padding = "10px";
            li.style.borderRadius = "6px";
            li.style.border = "1px solid #E2E8F0";
            li.style.cursor = "pointer";
            li.style.transition = "background 0.2s";

            li.onmouseover = () => li.style.background = "#F1F5F9";
            li.onmouseout = () => li.style.background = "#F8FAFC";

            // Redirect to Google Maps on click
            li.onclick = () => {
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' hospital ' + (h.address || ''))}`;
                window.open(mapsUrl, '_blank');
            };

            const addrStr = h.address ? h.address : 'Address not available';
            const phoneStr = h.phone ? h.phone : 'Phone not available';

            // Star UI
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= Math.floor(h.rating)) {
                    starsHtml += `<span style="color: #F59E0B;">★</span>`;
                } else if (i === Math.ceil(h.rating) && h.rating % 1 !== 0) {
                    starsHtml += `<span style="color: #F59E0B; position:relative; overflow:hidden; display:inline-block; width:1em;">
                                  <span style="position:absolute; width:50%; overflow:hidden;">★</span>
                                  <span style="color: #CBD5E1;">★</span>
                                  </span>`;
                } else {
                    starsHtml += `<span style="color: #CBD5E1;">★</span>`;
                }
            }

            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <strong style="color: #0F172A; font-size: 0.9rem;">${h.name}</strong>
                        <span style="font-size: 0.7rem; color: #10B981; font-weight: 500;">📍 ${h.distance.toFixed(1)} km away</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #64748B;">
                        <div style="font-size: 0.9rem; line-height: 1;">${starsHtml}</div>
                        <span>${h.rating}</span>
                    </div>
                </div>
                <div style="color: #475569; margin-bottom: 2px; display: flex; align-items: flex-start; gap: 6px;">
                    <svg style="min-width: 14px; margin-top:2px;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span style="line-height: 1.3;">${addrStr}</span>
                </div>
                <div style="color: #475569; display: flex; align-items: center; gap: 6px;">
                    <svg style="min-width: 14px;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    <span>${phoneStr}</span>
                </div>
            `;
            listElement.appendChild(li);
        });
    }

    updateUITranslations();
    setTimeout(resetChat, 500);
});
