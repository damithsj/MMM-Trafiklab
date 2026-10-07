# MMM-Trafiklab

A [MagicMirror²](https://magicmirror.builders/) module that shows upcoming bus/tram/train arrivals for a stop, using the [Trafiklab Realtime API](https://www.trafiklab.se/api/our-apis/trafiklab-realtime-apis). Layout inspired by [MMM-Futar](https://github.com/balassy/MMM-Futar).

Each row shows the line (with a mode icon, colored by transport mode), the direction, the platform letter, the minutes until arrival, and — when the vehicle is off schedule — the timetable time and the delay (`+2` late, `−1` early). Canceled trips are struck through.

## Install

```bash
cd ~/MagicMirror/modules
git clone https://github.com/damithsj/MMM-Trafiklab.git
```

No `npm install` is needed (uses Node's built-in `fetch`, Node 18+).

## Configuration

Get an API key (with access to *Trafiklab Realtime APIs*) from [trafiklab.se](https://www.trafiklab.se/), and look up your stop id with Trafiklab Stop Lookup.

```js
{
  module: "MMM-Trafiklab",
  position: "top_right",
  config: {
    apiKey: "YOUR_API_KEY",   // required
    stopId: "740056501",      // required
    destinationId: "9"        // optional
  }
}
```

| Option | Default | Description |
|---|---|---|
| `apiKey` | – | **Required.** Trafiklab API key. |
| `stopId` | – | **Required.** Stop id to show arrivals for. |
| `destinationId` | `""` | Optional. If set, only arrivals whose final destination stop id matches are shown (i.e. one direction of travel). |
| `layout` | `"vertical"` | `"vertical"` for side columns; `"horizontal"` lays the arrivals out in a wrapping row, for `top_bar` / `bottom_bar`. |
| `platforms` | `[]` | Optional. Only show arrivals on these scheduled platforms, as an array (`["A", "B"]`) or comma-separated string (`"A,B"`). Case-insensitive. Combines with `destinationId`. |
| `maxEntries` | `5` | Number of arrivals shown. |
| `updateInterval` | `300000` | How often the API is called (ms, minimum 30000). Mind your key's rate/quota limits. |
| `refreshInterval` | `30000` | How often the countdown is redrawn from cached data (ms). |
| `showHeader` | `true` | Show the stop name. |
| `showPlatform` | `true` | Show the platform/stop position. |
| `showDelay` | `true` | Show the delay in minutes. |
| `showRealtimeDot` | `true` | Dot before the countdown: green = live vehicle data, gray = timetable only (no live data, so the delay is unknown). |
| `showScheduled` | `true` | Show the timetable time when it differs from the real-time estimate. |
| `showAlerts` | `true` | Show stop alerts, if any. |
| `coloredLines` | `true` | Color the line badge by transport mode. |
| `showIcons` | `true` | Show a Font Awesome icon (bus, tram, metro, train, ship) in the line badge. |
| `modeIcons` | see source | Font Awesome class per transport mode. |
| `showTimeAfterMinutes` | `60` | Show a clock time instead of a countdown beyond this many minutes. |
| `fade` / `fadePoint` | `true` / `0.25` | Fade out the lower rows. |
| `modeColors` | see below | Badge color per transport mode. Override only the modes you want; the rest keep their defaults. |

The module is translated to English and Swedish following the MagicMirror `language` setting.

### Line colors

Bus and tram defaults approximate Östgötatrafiken's red; metro (blue), commuter train (pink) and ship (teal) approximate Stockholm's SL. Override any subset:

```js
modeColors: {
  BUS: "#e10e1c",
  TRAM: "#b90000",
  METRO: "#0a78c8",
  TRAIN: "#ec6fa6",
  SHIP: "#00a3a1",
  TAXI: "#d4a017",
  UNKNOWN: "#808080"
}
```
