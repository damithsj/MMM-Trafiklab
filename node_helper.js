const NodeHelper = require("node_helper");

const API_BASE = "https://realtime-api.trafiklab.se/v1";
const REQUEST_TIMEOUT_MS = 15000;

module.exports = NodeHelper.create({
  start() {
    console.log(`Starting node helper for: ${this.name}`);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "TRAFIKLAB_FETCH") {
      this.fetchData(payload);
    }
  },

  async fetchList(kind, stopId, apiKey) {
    const url = `${API_BASE}/${kind}/${encodeURIComponent(stopId)}?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        // Never include the URL in errors: it contains the API key.
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  },

  async fetchData({ identifier, apiKey, stopId, destinationId, platforms, type }) {
    const kinds = type === "both" ? ["arrivals", "departures"] : [type === "departures" ? "departures" : "arrivals"];

    try {
      const bodies = await Promise.all(kinds.map((kind) => this.fetchList(kind, stopId, apiKey)));

      const wanted = (Array.isArray(platforms) ? platforms : String(platforms || "").split(","))
        .map((p) => String(p).trim().toLowerCase())
        .filter(Boolean);

      const sections = {};
      kinds.forEach((kind, i) => {
        let items = Array.isArray(bodies[i][kind]) ? bodies[i][kind] : [];
        if (destinationId) {
          items = items.filter(
            (a) => a.route && a.route.destination && String(a.route.destination.id) === String(destinationId)
          );
        }
        if (wanted.length) {
          items = items.filter((a) => {
            const platform = (a.scheduled_platform || a.realtime_platform || {}).designation;
            return platform !== undefined && wanted.includes(String(platform).toLowerCase());
          });
        }
        sections[kind] = items.map((a) => ({
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
        }));
      });

      const stop = Array.isArray(bodies[0].stops) && bodies[0].stops.length ? bodies[0].stops[0] : null;
      this.sendSocketNotification("TRAFIKLAB_DATA", {
        identifier,
        stopName: stop ? stop.name : null,
        alerts: stop && Array.isArray(stop.alerts) ? stop.alerts : [],
        sections
      });
    } catch (error) {
      const reason = error.name === "AbortError" ? "request timed out" : error.message;
      console.error(`[${this.name}] Fetch failed: ${reason}`);
      this.sendSocketNotification("TRAFIKLAB_ERROR", { identifier, message: reason });
    }
  }
});
