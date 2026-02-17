export function registerErrorMonitoring(log) {
  const handler = (message, source, lineno, colno, error) => {
    const details = error && error.message ? error.message : message;
    log(`Client error: ${details}`);
  };

  const rejectionHandler = (event) => {
    const reason = event.reason && event.reason.message ? event.reason.message : "Unhandled rejection";
    log(`Client error: ${reason}`);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", rejectionHandler);
  }
}
