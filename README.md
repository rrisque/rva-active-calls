# RVA Active Calls

**[Live Site](https://rrisque.github.io/rva-active-calls/)**

A mobile and web app that displays real-time active emergency calls (police, fire, EMS) in Richmond, VA on an interactive map.

Data is scraped from the [City of Richmond Active Calls](https://apps.richmondgov.com/applications/activecalls/Home/ActiveCalls) page.

## Features

- **Live map** — color-coded markers for RPD (blue) and RFD (red) calls, centered on Richmond
- **List view** — sortable call list with pull-to-refresh, tap a call to jump to it on the map
- **Geocoding** — addresses are geocoded via OpenStreetMap Nominatim with a persistent local cache
- **Background notifications** — get notified when a new call appears within 2 miles of your location
- **Auto-refresh** — polls for new calls every 30 seconds

## Getting Started

```bash
npm install
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) on your phone, or press `i` / `a` to open in a simulator.

## Tech Stack

- [Expo](https://expo.dev) (SDK 54)
- React Native + TypeScript
- react-native-maps
- OpenStreetMap Nominatim for geocoding

## Data Source

All call data comes from the City of Richmond's public active calls page. This app simply displays that data in a more accessible format — it is not affiliated with the City of Richmond or any emergency services agency.

## License

MIT — see [LICENSE](LICENSE) for details.
