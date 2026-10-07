const NodeHelper = require("node_helper");

const API_BASE = "https://realtime-api.trafiklab.se/v1/arrivals";
const REQUEST_TIMEOUT_MS = 15000;

module.exports = NodeHelper.create({
  start() {
    console.log(`Starting node helper for: ${this.name}`);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "TRAFIKLAB_FETCH") {
      this.fetchArrivals(payload);
    }
  },

  async fetchArrivals({ identifier, apiKey, stopId, destinationId }) {
    const url = `${API_BASE}/${encodeURIComponent(stopId)}?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        // Never include the URL in errors: it contains the API key.
        throw new Error(`HTTP ${response.status}`);
      }
      const body = await response.json();

      let arrivals = Array.isArray(body.arrivals) ? body.arrivals : [];
      if (destinationId) {
        arrivals = arrivals.filter(
          (a) => a.route && a.route.destination && String(a.route.destination.id) === String(destinationId)
        );
      }

      const stop = Array.isArray(body.stops) && body.stops.length ? body.stops[0] : null;
      this.sendSocketNotification("TRAFIKLAB_DATA", {
        identifier,
        stopName: stop ? stop.name : null,
        alerts: stop && Array.isArray(stop.alerts) ? stop.alerts : [],
        arrivals: arrivals.map((a) => ({
          scheduled: a.scheduled,
          realtime: a.realtime,
          delay: a.delay,
          canceled: a.canceled,
          isRealtime: a.is_realtime,
          line: a.route.designation || a.route.name || "",
          mode: a.route.transport_mode,
          direction: a.route.direction || (a.route.destination && a.route.destination.name) || "",
          destinationName: a.route.destination ? a.route.destination.name : "",
          platform: (a.realtime_platform || a.scheduled_platform || {}).designation || "",
          tripId: a.trip ? a.trip.trip_id : ""
        }))
      });
    } catch (error) {
      const reason = error.name === "AbortError" ? "request timed out" : error.message;
      console.error(`[${this.name}] Fetch failed: ${reason}`);
      this.sendSocketNotification("TRAFIKLAB_ERROR", { identifier, message: reason });
    } finally {
      clearTimeout(timer);
    }
  }
});
