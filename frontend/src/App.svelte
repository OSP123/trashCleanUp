<script>
  import { onMount } from "svelte";
  import L from "leaflet";
  import { createApi, normalizeApiBase } from "./api";
  import { registerErrorMonitoring } from "./monitoring";

  export let fetchOverride = null;
  export let mapEnabled = true;

  const apiBase = normalizeApiBase();
  const api = createApi(fetchOverride || fetch, apiBase);

  let apiStatus = "Unknown";
  let apiStatusColor = "#fbbf24";
  let logLines = [];

  let currentUser = null;
  let users = [];
  let pins = [];
  let cleanups = [];
  let myCleanups = [];
  let collections = [];
  let territories = [];
  let territoryClaims = [];

  let map = null;
  let pinsLayer = null;
  let territoriesLayer = null;
  let mapContainer;

  let userSelection = "";
  let userInput = "";
  let pinForm = { severity: "yellow", lat: "", lng: "" };
  let cleanupForm = {
    pinId: "",
    beforePhotoUrl: "",
    afterPhotoUrl: "",
    aiScore: "",
    trashTypeCode: "plastic"
  };
  let territoryForm = { name: "", polygon: "" };
  let raidForm = { name: "", lat: "", lng: "", startsAt: "", endsAt: "" };

  // Territory drawing state
  let isDrawingTerritory = false;
  let territoryDrawingPoints = [];
  let drawingLayer = null;

  // Mobile UI state
  let showReportSheet = false;
  let showPinSheet = false;
  let selectedPin = null;
  let showProfileOverlay = false;
  let showOnboarding = false;
  let showCleanupSheet = false;
  let cleanupPinId = null;
  let beforePhotoPreview = null;
  let afterPhotoPreview = null;

  const log = (message) => {
    const timestamp = new Date().toISOString();
    logLines = [`[${timestamp}] ${message}`, ...logLines].slice(0, 200);
  };

  // Accessibility helper: handles keyboard events for overlay clicks
  const handleKeyPress = (event, callback) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  };

  const setActiveUser = (user) => {
    currentUser = user;
    userSelection = user ? user.id : "";
  };

  const checkApi = async () => {
    try {
      await api.health();
      apiStatus = "Online";
      apiStatusColor = "#34d399";
    } catch (error) {
      apiStatus = "Offline";
      apiStatusColor = "#f87171";
      log(`API offline: ${error.message}`);
    }
  };

  const loadUsers = async () => {
    try {
      users = await api.listUsers();
      log(`Loaded ${users.length} users.`);
    } catch (error) {
      log(`Load users failed: ${error.message}`);
    }
  };

  const refreshPins = async () => {
    try {
      const bbox = map ? getPinsQuery() : null;
      pins = await api.listPins(bbox);
      if (map) renderMapPins();
    } catch (error) {
      log(`Fetch pins failed: ${error.message}`);
    }
  };

  const refreshCleanups = async () => {
    try {
      cleanups = await api.listCleanups();
    } catch (error) {
      log(`Fetch cleanups failed: ${error.message}`);
    }
  };

  const refreshTerritories = async () => {
    try {
      const data = await api.listTerritories();
      territories = data.territories || [];
      territoryClaims = data.claims || [];
      log(`Loaded ${territories.length} territories with ${territoryClaims.length} claims.`);
      if (map) renderTerritories();
    } catch (error) {
      log(`Fetch territories failed: ${error.message}`);
    }
  };

  const refreshProfile = async () => {
    if (!currentUser) {
      myCleanups = [];
      collections = [];
      return;
    }
    try {
      const [user, cleanupsList, collectionsList] = await Promise.all([
        api.getUser(currentUser.id),
        api.listCleanups({ cleanerId: currentUser.id }),
        api.listCollections(currentUser.id)
      ]);
      setActiveUser(user);
      myCleanups = cleanupsList.slice(0, 5);
      collections = collectionsList;
    } catch (error) {
      log(`Profile refresh failed: ${error.message}`);
    }
  };

  const submitUser = async () => {
    if (!userInput.trim()) return;
    try {
      const user = await api.createUser({ username: userInput.trim() });
      setActiveUser(user);
      log(`User created: ${user.username}`);
      userInput = "";
      await loadUsers();
      await refreshProfile();
    } catch (error) {
      log(`Create user failed: ${error.message}`);
    }
  };

  const completeOnboarding = async () => {
    if (!userInput.trim()) {
      log("Please enter a username");
      return;
    }
    try {
      const user = await api.createUser({ username: userInput.trim() });
      setActiveUser(user);
      log(`Welcome, ${user.username}!`);
      userInput = "";
      await loadUsers();
      await refreshProfile();
      showOnboarding = false;

      // Load map data after onboarding
      await refreshPins();
      await refreshCleanups();
      await refreshTerritories();
    } catch (error) {
      log(`Onboarding failed: ${error.message}`);
    }
  };

  const openReportSheet = () => {
    if (!window?.navigator?.geolocation) {
      log("Geolocation not supported.");
      return;
    }

    // Get current location and open report sheet
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        pinForm = {
          ...pinForm,
          lat: latitude.toFixed(6),
          lng: longitude.toFixed(6)
        };
        showReportSheet = true;
        log(`Location acquired: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      },
      (error) => {
        log("Location access denied. Please enable location.");
        // Still open sheet, user can report without exact location
        showReportSheet = true;
      }
    );
  };

  const closeReportSheet = () => {
    showReportSheet = false;
    pinForm = { severity: "yellow", lat: "", lng: "" };
  };

  const submitPin = async () => {
    try {
      const payload = {
        severity: pinForm.severity,
        lat: Number(pinForm.lat),
        lng: Number(pinForm.lng),
        reporterId: currentUser ? currentUser.id : null
      };
      const pin = await api.createPin(payload);
      log(`Pin created: ${pin.id}`);
      await refreshPins();
      closeReportSheet();
    } catch (error) {
      log(`Create pin failed: ${error.message}`);
    }
  };

  const openCleanupSheet = (pinId) => {
    cleanupPinId = pinId;
    showPinSheet = false;
    selectedPin = null;
    showCleanupSheet = true;
    beforePhotoPreview = null;
    afterPhotoPreview = null;
    log(`Opening cleanup flow for pin: ${pinId}`);
  };

  const closeCleanupSheet = () => {
    showCleanupSheet = false;
    cleanupPinId = null;
    beforePhotoPreview = null;
    afterPhotoPreview = null;
    cleanupForm = {
      pinId: "",
      beforePhotoUrl: "",
      afterPhotoUrl: "",
      aiScore: "",
      trashTypeCode: "plastic"
    };
  };

  const handlePhotoUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;

    log(`📤 Uploading ${type} photo: ${file.name}`);

    // Create preview for display (base64 only for UI)
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (type === 'before') {
        beforePhotoPreview = dataUrl;
      } else {
        afterPhotoPreview = dataUrl;
      }
    };
    reader.readAsDataURL(file);

    // Upload actual file to backend
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      const fileUrl = data.url;

      // Store backend URL (not base64) in form
      if (type === 'before') {
        cleanupForm.beforePhotoUrl = fileUrl;
      } else {
        cleanupForm.afterPhotoUrl = fileUrl;
      }

      log(`✅ ${type === 'before' ? 'Before' : 'After'} photo uploaded: ${fileUrl}`);
    } catch (error) {
      log(`❌ Photo upload failed: ${error.message}`);
    }
  };

  const submitCleanup = async () => {
    if (!cleanupPinId || !cleanupForm.beforePhotoUrl || !cleanupForm.afterPhotoUrl) {
      log("Please upload both before and after photos");
      return;
    }
    try {
      const payload = {
        pinId: cleanupPinId,
        cleanerId: currentUser ? currentUser.id : null,
        beforePhotoUrl: cleanupForm.beforePhotoUrl,
        afterPhotoUrl: cleanupForm.afterPhotoUrl,
        aiScore: 0.8, // Default AI score
        trashTypeCode: cleanupForm.trashTypeCode
      };
      const cleanup = await api.createCleanup(payload);
      log(`Cleanup submitted: ${cleanup.id}. Great work! 🎉`);
      await refreshCleanups();
      await refreshPins();
      await refreshProfile();
      closeCleanupSheet();
    } catch (error) {
      log(`Cleanup submission failed: ${error.message}`);
    }
  };

  const submitVote = async (event) => {
    const { cleanupId, vote } = event.target;
    if (!currentUser) {
      log("Select a user before voting.");
      return;
    }
    try {
      const cleanup = await api.voteCleanup(cleanupId.value.trim(), {
        voterId: currentUser.id,
        vote: vote.value
      });
      log(`Vote recorded. Cleanup status: ${cleanup.status}`);
      await refreshCleanups();
      await refreshProfile();
      event.target.reset();
    } catch (error) {
      log(`Vote failed: ${error.message}`);
    }
  };

  const startDrawingTerritory = () => {
    if (!map) {
      log("Map not initialized.");
      return;
    }
    isDrawingTerritory = true;
    territoryDrawingPoints = [];
    if (!drawingLayer) {
      drawingLayer = L.layerGroup().addTo(map);
    }
    log("Click on map to draw territory boundary. Click 'Finish Territory' when done.");
  };

  const finishDrawingTerritory = () => {
    if (territoryDrawingPoints.length < 3) {
      log("Need at least 3 points to create a territory.");
      return;
    }
    // Convert points to the format expected by the form (lat,lng; lat,lng; ...)
    const polygonString = territoryDrawingPoints
      .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
      .join("; ");
    territoryForm = { ...territoryForm, polygon: polygonString };
    isDrawingTerritory = false;
    territoryDrawingPoints = [];
    if (drawingLayer) {
      drawingLayer.clearLayers();
    }
    log(`Territory boundary set with ${territoryDrawingPoints.length} points. Enter a name and submit.`);
  };

  const cancelDrawingTerritory = () => {
    isDrawingTerritory = false;
    territoryDrawingPoints = [];
    if (drawingLayer) {
      drawingLayer.clearLayers();
    }
    log("Territory drawing cancelled.");
  };

  const handleMapClickForDrawing = (event) => {
    if (!isDrawingTerritory) return;

    const point = { lat: event.latlng.lat, lng: event.latlng.lng };
    territoryDrawingPoints = [...territoryDrawingPoints, point];

    // Update drawing visualization
    if (drawingLayer) {
      drawingLayer.clearLayers();

      // Draw dots at each point
      territoryDrawingPoints.forEach((p) => {
        L.circleMarker([p.lat, p.lng], {
          radius: 5,
          color: "#8b5cf6",
          fillColor: "#8b5cf6",
          fillOpacity: 1
        }).addTo(drawingLayer);
      });

      // Draw lines connecting points
      if (territoryDrawingPoints.length > 1) {
        const latlngs = territoryDrawingPoints.map((p) => [p.lat, p.lng]);
        L.polyline(latlngs, {
          color: "#8b5cf6",
          weight: 2,
          dashArray: "5, 5"
        }).addTo(drawingLayer);

        // Show preview polygon if 3+ points
        if (territoryDrawingPoints.length >= 3) {
          L.polygon(latlngs, {
            color: "#8b5cf6",
            fillColor: "#8b5cf6",
            fillOpacity: 0.2,
            weight: 2,
            dashArray: "5, 5"
          }).addTo(drawingLayer);
        }
      }
    }

    log(`Point ${territoryDrawingPoints.length} added: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);
  };

  const submitTerritory = async () => {
    if (!currentUser) {
      log("Select a user before claiming territories.");
      return;
    }
    const points = territoryForm.polygon
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [lat, lng] = pair.split(",").map((value) => Number(value.trim()));
        return { lat, lng };
      });
    try {
      const territory = await api.createTerritory({
        name: territoryForm.name.trim(),
        polygon: points
      });
      await api.claimTerritory(territory.id, {
        userId: currentUser.id,
        decayHours: 72
      });
      log(`Territory created and claimed: ${territory.name}`);
      await refreshTerritories();
      territoryForm = { name: "", polygon: "" };
    } catch (error) {
      log(`Territory failed: ${error.message}`);
    }
  };

  const submitRaid = async () => {
    try {
      const raid = await api.createRaid({
        name: raidForm.name.trim(),
        lat: Number(raidForm.lat),
        lng: Number(raidForm.lng),
        startsAt: raidForm.startsAt.trim(),
        endsAt: raidForm.endsAt.trim()
      });
      log(`Raid created: ${raid.name}`);
      raidForm = { name: "", lat: "", lng: "", startsAt: "", endsAt: "" };
    } catch (error) {
      log(`Raid failed: ${error.message}`);
    }
  };

  const handleUserChange = async () => {
    const selected = users.find((user) => user.id === userSelection);
    if (selected) {
      setActiveUser(selected);
      log(`Active user set: ${selected.username}`);
      await refreshProfile();
    }
  };

  const handlePinClick = (pin) => {
    cleanupForm = { ...cleanupForm, pinId: pin.id };
    if (map) {
      map.setView([pin.location.lat, pin.location.lng], 16);
    }
  };

  const renderMapPins = () => {
    if (!map || !pinsLayer) return;
    pinsLayer.clearLayers();
    pins.forEach((pin) => {
      // Get emoji and color based on severity
      const emoji = pin.severity === "red" ? "⚠️" : pin.severity === "orange" ? "🚮" : "🗑️";
      const bgColor = pin.severity === "red" ? "#ef4444" : pin.severity === "orange" ? "#f97316" : "#eab308";

      // Create custom icon with emoji
      const icon = L.divIcon({
        className: 'custom-pin-marker',
        html: `<div style="
          font-size: 28px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
          background: ${bgColor};
          width: 40px;
          height: 40px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        ">
          <span style="transform: rotate(45deg); display: block;">${emoji}</span>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
      });

      const marker = L.marker([pin.location.lat, pin.location.lng], { icon })
        .on("click", () => {
          selectedPin = pin;
          showPinSheet = true;
          log(`Pin selected: ${pin.severity} at ${pin.location.lat.toFixed(5)}, ${pin.location.lng.toFixed(5)}`);
        });

      pinsLayer.addLayer(marker);
    });
  };

  const renderTerritories = () => {
    if (!map || !territoriesLayer) return;
    territoriesLayer.clearLayers();

    territories.forEach((territory) => {
      // Convert polygon [{lat, lng}, ...] to Leaflet LatLng format
      const latlngs = territory.polygon.map((point) => [point.lat, point.lng]);

      // Create polygon with default styling (we'll add ownership colors in the next step)
      const polygon = L.polygon(latlngs, {
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.2,
        weight: 2
      }).bindPopup(`<strong>${territory.name}</strong><br/>ID: ${territory.id}`);

      territoriesLayer.addLayer(polygon);
    });

    log(`Rendered ${territories.length} territories on map.`);
  };

  const getPinsQuery = () => {
    if (!map) return null;
    const bounds = map.getBounds();
    return {
      minLat: bounds.getSouth().toFixed(6),
      minLng: bounds.getWest().toFixed(6),
      maxLat: bounds.getNorth().toFixed(6),
      maxLng: bounds.getEast().toFixed(6)
    };
  };

  const locateMe = () => {
    if (!window?.navigator?.geolocation) {
      log("Geolocation not supported.");
      return;
    }
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (map) {
          map.setView([latitude, longitude], 15);
        }
        pinForm = { ...pinForm, lat: latitude.toFixed(6), lng: longitude.toFixed(6) };
      },
      () => {
        log("Unable to fetch location.");
      }
    );
  };

  onMount(async () => {
    registerErrorMonitoring(log);
    await checkApi();
    await loadUsers();

    // Show onboarding if no users exist
    if (users.length === 0) {
      showOnboarding = true;
      log("No users found. Showing onboarding...");
      return; // Don't load pins/territories until user is created
    }

    // Auto-login: select first user if available and none selected
    if (!currentUser && users.length > 0) {
      setActiveUser(users[0]);
      log(`Auto-logged in as: ${users[0].username}`);
    }

    await refreshCleanups();
    await refreshProfile();

    if (!mapEnabled) return;
    if (!mapContainer || typeof L === "undefined") {
      log("Map library failed to load.");
      return;
    }
    map = L.map(mapContainer).setView([37.7749, -122.4194], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    territoriesLayer = L.layerGroup().addTo(map);
    pinsLayer = L.layerGroup().addTo(map);
    drawingLayer = L.layerGroup().addTo(map);

    // Load pins and territories AFTER map is created
    await refreshPins();
    await refreshTerritories();

    map.on("click", (event) => {
      if (isDrawingTerritory) {
        handleMapClickForDrawing(event);
      } else {
        // Click map to report trash at that location
        pinForm = {
          ...pinForm,
          lat: event.latlng.lat.toFixed(6),
          lng: event.latlng.lng.toFixed(6)
        };
        showReportSheet = true;
        log(`Map clicked: ${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`);
      }
    });
    map.on("moveend", () => {
      refreshPins();
    });
  });
</script>

<main class="mobile-app">
  <!-- Top Bar -->
  <div class="mobile-top-bar">
    <button class="profile-btn" on:click={() => { showProfileOverlay = true; }}>
      <span class="avatar">{currentUser ? currentUser.username[0].toUpperCase() : '?'}</span>
    </button>
    {#if currentUser}
      <div class="user-badge">
        <span class="level">Lv {currentUser.level}</span>
        <span class="xp">{currentUser.xp} XP</span>
      </div>
    {/if}
  </div>

  <!-- Full Screen Map -->
  <div id="map" bind:this={mapContainer}></div>

  <!-- Floating Action Button -->
  <button class="fab" on:click={openReportSheet}>
    <span class="fab-icon">📍</span>
  </button>

  <!-- Report Trash Bottom Sheet -->
  {#if showReportSheet}
    <div
      class="bottom-sheet-overlay"
      role="button"
      tabindex="0"
      on:click={closeReportSheet}
      on:keypress={(e) => handleKeyPress(e, closeReportSheet)}
    ></div>
    <div class="bottom-sheet">
      <div class="bottom-sheet-header">
        <h2>Report Trash</h2>
        <button class="close-btn" on:click={closeReportSheet}>✕</button>
      </div>

      <form on:submit|preventDefault={submitPin}>
        <div class="severity-selector">
          <label class="severity-option" class:selected={pinForm.severity === "yellow"}>
            <input type="radio" name="severity" value="yellow" bind:group={pinForm.severity} />
            <div class="severity-card yellow">
              <span class="severity-emoji">🗑️</span>
              <span class="severity-label">Litter</span>
            </div>
          </label>

          <label class="severity-option" class:selected={pinForm.severity === "orange"}>
            <input type="radio" name="severity" value="orange" bind:group={pinForm.severity} />
            <div class="severity-card orange">
              <span class="severity-emoji">🚮</span>
              <span class="severity-label">Overflow</span>
            </div>
          </label>

          <label class="severity-option" class:selected={pinForm.severity === "red"}>
            <input type="radio" name="severity" value="red" bind:group={pinForm.severity} />
            <div class="severity-card red">
              <span class="severity-emoji">⚠️</span>
              <span class="severity-label">Dumping</span>
            </div>
          </label>
        </div>

        <div class="location-info">
          {#if pinForm.lat && pinForm.lng}
            <span class="location-icon">📍</span>
            <span class="location-text">
              {Number(pinForm.lat).toFixed(5)}, {Number(pinForm.lng).toFixed(5)}
            </span>
          {:else}
            <span class="location-text muted">Location not available</span>
          {/if}
        </div>

        <button type="submit" class="submit-btn" disabled={!pinForm.lat || !pinForm.lng}>
          Report Trash
        </button>
      </form>
    </div>
  {/if}

  {#if showPinSheet && selectedPin}
    <div
      class="bottom-sheet-overlay"
      role="button"
      tabindex="0"
      on:click={() => { showPinSheet = false; selectedPin = null; }}
      on:keypress={(e) => handleKeyPress(e, () => { showPinSheet = false; selectedPin = null; })}
    ></div>
    <div class="bottom-sheet">
      <div class="bottom-sheet-header">
        <h2>Trash Pin</h2>
        <button class="close-btn" on:click={() => { showPinSheet = false; selectedPin = null; }}>✕</button>
      </div>

      <div class="pin-details">
        <div class="severity-display {selectedPin.severity}">
          <span class="severity-emoji">
            {selectedPin.severity === 'yellow' ? '🗑️' : selectedPin.severity === 'orange' ? '🚮' : '⚠️'}
          </span>
          <span class="severity-label">
            {selectedPin.severity === 'yellow' ? 'Litter' : selectedPin.severity === 'orange' ? 'Overflow' : 'Dumping'}
          </span>
        </div>

        <div class="pin-info-row">
          <span class="info-label">Status:</span>
          <span class="info-value" class:status-dirty={selectedPin.status === 'dirty'} class:status-clean={selectedPin.status === 'clean'}>
            {selectedPin.status.toUpperCase()}
          </span>
        </div>

        {#if selectedPin.reporter_id}
          <div class="pin-info-row">
            <span class="info-label">Reported by:</span>
            <span class="info-value">User {selectedPin.reporter_id.slice(0, 8)}</span>
          </div>
        {/if}

        <div class="location-info">
          <span class="location-icon">📍</span>
          <span class="location-text">
            {selectedPin.location.lat.toFixed(5)}, {selectedPin.location.lng.toFixed(5)}
          </span>
        </div>

        <!-- Cleanup Photos and Details -->
        {#each cleanups.filter(c => c.pinId === selectedPin.id) as cleanup}
          <div class="cleanup-display">
            <div class="cleanup-header">
              <h3>Cleanup Details</h3>
              {#if cleanup.cleanerId}
                <span class="cleaner-badge">Cleaned by User {cleanup.cleanerId.slice(0, 8)}</span>
              {/if}
            </div>

            <div class="cleanup-photos">
              <div class="cleanup-photo-container">
                <div class="photo-label">Before</div>
                <img src={cleanup.beforePhotoUrl} alt="Before cleanup" class="cleanup-photo" />
              </div>
              <div class="cleanup-photo-container">
                <div class="photo-label">After</div>
                <img src={cleanup.afterPhotoUrl} alt="After cleanup" class="cleanup-photo" />
              </div>
            </div>

            {#if cleanup.trashTypeCode}
              <div class="pin-info-row">
                <span class="info-label">Trash Type:</span>
                <span class="info-value">
                  {cleanup.trashTypeCode === 'plastic' ? '♻️ Plastic' :
                   cleanup.trashTypeCode === 'glass' ? '🥫 Glass' :
                   cleanup.trashTypeCode === 'metal' ? '🔩 Metal' :
                   cleanup.trashTypeCode === 'paper' ? '📄 Paper' :
                   cleanup.trashTypeCode === 'organic' ? '🍂 Organic' : '🗑️ Other'}
                </span>
              </div>
            {/if}

            <div class="pin-info-row">
              <span class="info-label">Status:</span>
              <span class="info-value" class:status-approved={cleanup.status === 'approved'} class:status-pending={cleanup.status === 'pending'}>
                {cleanup.status.toUpperCase()}
              </span>
            </div>
          </div>
        {/each}

        {#if selectedPin.status === 'dirty'}
          <button class="submit-btn clean-btn" on:click={() => openCleanupSheet(selectedPin.id)}>
            🧹 Clean This
          </button>
        {:else if cleanups.filter(c => c.pin_id === selectedPin.id).length === 0}
          <div class="cleaned-badge">✓ Already cleaned</div>
        {/if}
      </div>
    </div>
  {/if}

  {#if showProfileOverlay}
    <div
      class="profile-overlay-backdrop"
      role="button"
      tabindex="0"
      on:click={() => { showProfileOverlay = false; }}
      on:keypress={(e) => handleKeyPress(e, () => { showProfileOverlay = false; })}
    ></div>
    <div class="profile-overlay">
      <div class="profile-header">
        <h2>Profile</h2>
        <button class="close-btn" on:click={() => { showProfileOverlay = false; }}>✕</button>
      </div>

      {#if currentUser}
        <div class="profile-content">
          <!-- User Stats -->
          <div class="profile-user">
            <div class="profile-avatar-large">
              {currentUser.username[0].toUpperCase()}
            </div>
            <h3 class="profile-username">{currentUser.username}</h3>
            <div class="profile-stats-grid">
              <div class="stat-card">
                <div class="stat-label">Level</div>
                <div class="stat-value">{currentUser.level}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">XP</div>
                <div class="stat-value">{currentUser.xp}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Currency</div>
                <div class="stat-value">{currentUser.currency}</div>
              </div>
            </div>
          </div>

          <!-- Collections -->
          {#if collections.length > 0}
            <div class="profile-section">
              <h4 class="section-title">Collections</h4>
              <div class="collections-grid">
                {#each collections as collection}
                  <div class="collection-card">
                    <span class="collection-icon">
                      {collection.trash_type_code === 'plastic' ? '♻️' :
                       collection.trash_type_code === 'glass' ? '🥫' :
                       collection.trash_type_code === 'metal' ? '🔩' :
                       collection.trash_type_code === 'paper' ? '📄' :
                       collection.trash_type_code === 'organic' ? '🍂' : '🗑️'}
                    </span>
                    <div class="collection-info">
                      <div class="collection-name">{collection.trash_type_name}</div>
                      <div class="collection-count">{collection.count}</div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- User Switching -->
          {#if users.length > 1}
            <div class="profile-section">
              <h4 class="section-title">Switch User</h4>
              <div class="users-list">
                {#each users as user}
                  <button
                    class="user-switch-btn"
                    class:active={currentUser && user.id === currentUser.id}
                    on:click={async () => {
                      setActiveUser(user);
                      await refreshProfile();
                      showProfileOverlay = false;
                      log(`Switched to user: ${user.username}`);
                    }}
                  >
                    <span class="user-switch-avatar">{user.username[0].toUpperCase()}</span>
                    <span class="user-switch-name">{user.username}</span>
                    <span class="user-switch-level">Lv {user.level}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="profile-empty">
          <p>No user selected</p>
        </div>
      {/if}
    </div>
  {/if}

  {#if showCleanupSheet}
    <div
      class="bottom-sheet-overlay"
      role="button"
      tabindex="0"
      on:click={closeCleanupSheet}
      on:keypress={(e) => handleKeyPress(e, closeCleanupSheet)}
    ></div>
    <div class="bottom-sheet cleanup-sheet">
      <div class="bottom-sheet-header">
        <h2>Clean Up This Trash</h2>
        <button class="close-btn" on:click={closeCleanupSheet}>✕</button>
      </div>

      <form on:submit|preventDefault={submitCleanup}>
        <div class="cleanup-instructions">
          <p>Take before and after photos to document your cleanup!</p>
        </div>

        <!-- Before Photo -->
        <div class="photo-upload-section">
          <label class="photo-upload-label" for="before-photo-input">
            <span class="label-text">📷 Before Photo</span>
            {#if beforePhotoPreview}
              <div class="photo-preview">
                <img src={beforePhotoPreview} alt="Before cleanup" />
                <div class="photo-overlay">✓ Photo captured</div>
              </div>
            {:else}
              <div class="photo-upload-placeholder">
                <span class="upload-icon">📸</span>
                <span class="upload-text">Tap to take photo</span>
              </div>
            {/if}
            <input
              id="before-photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              on:change={(e) => handlePhotoUpload(e, 'before')}
              style="display: none;"
            />
          </label>
        </div>

        <!-- After Photo -->
        <div class="photo-upload-section">
          <label class="photo-upload-label" for="after-photo-input">
            <span class="label-text">📷 After Photo</span>
            {#if afterPhotoPreview}
              <div class="photo-preview">
                <img src={afterPhotoPreview} alt="After cleanup" />
                <div class="photo-overlay">✓ Photo captured</div>
              </div>
            {:else}
              <div class="photo-upload-placeholder">
                <span class="upload-icon">📸</span>
                <span class="upload-text">Tap to take photo</span>
              </div>
            {/if}
            <input
              id="after-photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              on:change={(e) => handlePhotoUpload(e, 'after')}
              style="display: none;"
            />
          </label>
        </div>

        <!-- Trash Type Selector -->
        <div class="trash-type-section">
          <label class="form-label" for="trash-type-select">Trash Type (Optional)</label>
          <select id="trash-type-select" class="form-select" bind:value={cleanupForm.trashTypeCode}>
            <option value="plastic">♻️ Plastic</option>
            <option value="glass">🥫 Glass</option>
            <option value="metal">🔩 Metal</option>
            <option value="paper">📄 Paper</option>
            <option value="organic">🍂 Organic</option>
          </select>
        </div>

        <button
          type="submit"
          class="submit-btn"
          disabled={!beforePhotoPreview || !afterPhotoPreview}
        >
          Submit Cleanup
        </button>
      </form>
    </div>
  {/if}

  {#if showOnboarding}
    <div class="onboarding-modal">
      <div class="onboarding-content">
        <div class="onboarding-header">
          <div class="onboarding-icon">🌍</div>
          <h1 class="onboarding-title">TrashCleanUp</h1>
          <p class="onboarding-tagline">Make your community cleaner, one pin at a time</p>
        </div>

        <form class="onboarding-form" on:submit|preventDefault={completeOnboarding}>
          <div class="form-group">
            <label for="username" class="form-label">Choose your username</label>
            <input
              id="username"
              type="text"
              class="form-input"
              placeholder="Enter username"
              bind:value={userInput}
              required
            />
          </div>

          <button type="submit" class="submit-btn onboarding-btn">
            Get Started
          </button>
        </form>

        <p class="onboarding-footer">
          Start reporting trash, earn XP, and level up your cleanup game! 🎮
        </p>
      </div>
    </div>
  {/if}

</main>
