/* global Module, Log, moment */

Module.register("MMM-Trafiklab", {
  defaults: {
    apiKey: "", // required
    stopId: "", // required, Trafiklab stop id (e.g. "740056501")
    destinationId: "", // optional, only show arrivals whose final destination has this stop id
    platforms: [], // optional, only show these scheduled platforms, e.g. ["A", "B"] or "A,B"
    layout: "vertical", // "vertical" for side columns, "horizontal" for top_bar / bottom_bar
    maxEntries: 5,
    updateInterval: 5 * 60 * 1000, // how often to call the API (ms)
    refreshInterval: 30 * 1000, // how often to refresh the countdown locally (ms)
    showHeader: true, // stop name above the list
    showPlatform: true,
    showDelay: true,
    showRealtimeDot: true, // green dot = live data, gray dot = timetable only
    showScheduled: true, // scheduled time under the countdown when it differs from the realtime
    showAlerts: true,
    coloredLines: true,
    showIcons: true, // transport mode icon (bus, tram, metro, ...) in the line badge
    showTimeAfterMinutes: 60, // beyond this many minutes, show a clock time instead of a countdown
    fade: true,
    fadePoint: 0.25,
    animationSpeed: 1000,
    modeIcons: {
      BUS: "fa-bus",
      TRAM: "fa-tram",
      METRO: "fa-subway",
      TRAIN: "fa-train",
      SHIP: "fa-ship",
      TAXI: "fa-taxi",
      UNKNOWN: "fa-question"
    },
    // Bus/tram approximate Östgötatrafiken's brand red; metro, train and ship approximate SL (Stockholm). Override any subset, e.g. modeColors: { BUS: "#0b5fa5" }
    modeColors: {
      BUS: "#e10e1c",
      TRAM: "#b90000",
      METRO: "#0a78c8",
      TRAIN: "#ec6fa6",
      SHIP: "#00a3a1",
      TAXI: "#d4a017",
      UNKNOWN: "#808080"
    }
  },

  getStyles() {
    return ["MMM-Trafiklab.css"];
  },

  getTranslations() {
    return { en: "translations/en.json", sv: "translations/sv.json" };
  },

  start() {
    this.arrivals = null;
    this.stopName = null;
    this.alerts = [];
    this.error = null;

    if (!this.config.apiKey || !this.config.stopId) {
      this.error = this.translate("CONFIG_MISSING");
      return;
    }

    this.fetchData();
    setInterval(() => this.fetchData(), Math.max(this.config.updateInterval, 30 * 1000));
    setInterval(() => this.updateDom(this.config.animationSpeed), this.config.refreshInterval);
  },

  fetchData() {
    this.sendSocketNotification("TRAFIKLAB_FETCH", {
      identifier: this.identifier,
      apiKey: this.config.apiKey,
      stopId: this.config.stopId,
      destinationId: this.config.destinationId,
      platforms: this.config.platforms
    });
  },

  socketNotificationReceived(notification, payload) {
    if (!payload || payload.identifier !== this.identifier) return;

    if (notification === "TRAFIKLAB_DATA") {
      this.arrivals = payload.arrivals;
      this.stopName = payload.stopName;
      this.alerts = payload.alerts;
      this.error = null;
      this.updateDom(this.config.animationSpeed);
    } else if (notification === "TRAFIKLAB_ERROR") {
      this.error = payload.message;
      this.updateDom(this.config.animationSpeed);
    }
  },

  // The API returns local Swedish time without an offset; parse it as local time.
  parseTime(value) {
    return moment(value, "YYYY-MM-DDTHH:mm:ss");
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = `trafiklab trafiklab-${this.config.layout === "horizontal" ? "horizontal" : "vertical"}`;

    if (this.config.showHeader && this.stopName) {
      const header = document.createElement("div");
      header.className = "trafiklab-header bright";
      header.textContent = this.stopName;
      wrapper.appendChild(header);
    }

    if (!this.arrivals) {
      const msg = document.createElement("div");
      msg.className = "trafiklab-msg dimmed";
      msg.textContent = this.error ? `${this.error}` : this.translate("LOADING");
      wrapper.appendChild(msg);
      return wrapper;
    }

    const now = moment();
    const upcoming = this.arrivals
      .map((a) => ({ ...a, time: this.parseTime(a.realtime || a.scheduled) }))
      .filter((a) => a.time.isValid() && a.time.diff(now, "seconds") > -30)
      .sort((a, b) => a.time.valueOf() - b.time.valueOf())
      .slice(0, this.config.maxEntries);

    if (upcoming.length === 0) {
      const msg = document.createElement("div");
      msg.className = "trafiklab-msg dimmed";
      msg.textContent = this.translate("NO_ARRIVALS");
      wrapper.appendChild(msg);
    }

    const list = document.createElement("div");
    list.className = "trafiklab-list";
    upcoming.forEach((arrival, index) => {
      const row = this.buildRow(arrival, now);
      if (this.config.fade && upcoming.length > 1) {
        const start = upcoming.length * this.config.fadePoint;
        const steps = upcoming.length - start;
        if (index >= start) {
          row.style.opacity = 1 - (1 / steps) * (index - start + 1) * 0.8;
        }
      }
      list.appendChild(row);
    });
    wrapper.appendChild(list);

    if (this.config.showAlerts && this.alerts.length) {
      const alert = document.createElement("div");
      alert.className = "trafiklab-alert";
      alert.textContent = this.alerts.map((a) => a.header || a.title || a.text || "").filter(Boolean).join(" · ");
      if (alert.textContent) wrapper.appendChild(alert);
    }

    if (this.error) {
      const err = document.createElement("div");
      err.className = "trafiklab-error";
      err.textContent = `${this.translate("UPDATE_FAILED")}: ${this.error}`;
      wrapper.appendChild(err);
    }

    return wrapper;
  },

  buildRow(arrival, now) {
    const row = document.createElement("div");
    row.className = "trafiklab-row";
    if (arrival.canceled) row.classList.add("trafiklab-canceled");

    // Line badge
    const badge = document.createElement("span");
    badge.className = "trafiklab-line bright";
    if (this.config.showIcons) {
      const icon = document.createElement("i");
      icon.className = `fas ${this.config.modeIcons[arrival.mode] || this.config.modeIcons.UNKNOWN} trafiklab-icon`;
      badge.appendChild(icon);
    }
    badge.appendChild(document.createTextNode(arrival.line));
    if (this.config.coloredLines) {
      badge.style.backgroundColor = this.config.modeColors[arrival.mode] || this.config.modeColors.UNKNOWN;
    }
    row.appendChild(badge);

    // Direction and platform
    const info = document.createElement("span");
    info.className = "trafiklab-info";
    const dest = document.createElement("span");
    dest.className = "trafiklab-dest bright";
    dest.textContent = arrival.direction;
    info.appendChild(dest);
    if (this.config.showPlatform && arrival.platform) {
      const platform = document.createElement("span");
      platform.className = "trafiklab-platform dimmed";
      platform.textContent = ` ${arrival.platform}`;
      info.appendChild(platform);
    }
    row.appendChild(info);

    // Time block
    const timeBox = document.createElement("span");
    timeBox.className = "trafiklab-time";

    const main = document.createElement("div");
    main.className = "trafiklab-countdown bright";
    if (this.config.showRealtimeDot && !arrival.canceled) {
      const dot = document.createElement("span");
      dot.className = `trafiklab-dot ${arrival.isRealtime ? "trafiklab-dot-live" : "trafiklab-dot-timetable"}`;
      dot.title = this.translate(arrival.isRealtime ? "REALTIME" : "SCHEDULED");
      main.appendChild(dot);
    }
    const label = document.createElement("span");
    main.appendChild(label);
    if (arrival.canceled) {
      label.textContent = this.translate("CANCELED");
    } else {
      const minutes = Math.ceil(arrival.time.diff(now, "seconds") / 60);
      if (minutes <= 0) label.textContent = this.translate("NOW");
      else if (minutes > this.config.showTimeAfterMinutes) label.textContent = arrival.time.format("HH:mm");
      else label.textContent = `${minutes} ${this.translate("MIN")}`;
    }
    timeBox.appendChild(main);

    const sub = document.createElement("div");
    sub.className = "trafiklab-sub dimmed";
    const delayMin = Math.round((arrival.delay || 0) / 60);
    if (!arrival.canceled && this.config.showScheduled && delayMin !== 0) {
      sub.appendChild(document.createTextNode(`${this.parseTime(arrival.scheduled).format("HH:mm")} `));
    }
    if (!arrival.canceled && this.config.showDelay && delayMin !== 0) {
      const delay = document.createElement("span");
      delay.className = delayMin > 0 ? "trafiklab-late" : "trafiklab-early";
      delay.textContent = `${delayMin > 0 ? "+" : "−"}${Math.abs(delayMin)}`;
      sub.appendChild(delay);
    }
    if (sub.childNodes.length) timeBox.appendChild(sub);
    row.appendChild(timeBox);

    return row;
  }
});
