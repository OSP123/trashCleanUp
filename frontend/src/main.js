import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App.svelte";

const app = new App({
  target: document.getElementById("app")
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js").catch((error) => {
    console.warn("Service worker registration failed", error);
  });
}

export default app;
