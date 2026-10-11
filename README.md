# YatraOne Ahmedabad Transit

YatraOne is a local React/Vite prototype for exploring Ahmedabad metro, BRTS, and AMTS connections. It draws a schematic network and lets you try sample journeys. The current dataset is not a live or fully verified passenger-routing feed.

## Run locally

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Vite prints the local URL (normally `http://localhost:5173`). Create a production build with `npm run build`.

## What works today

- Search between the stops in the bundled prototype graph and compare journey options.
- View the selected journey on an interactive schematic: zoom, pan, filter by Metro/BRTS/AMTS, and click stops for details.
- Inspect stop corridor and interchange information, switch English/Gujarati labels, and open a stop search in Google Maps.
- View transfer links, journey steps, fare estimate, and the prototype ticket UI.
- Use the app offline after it has loaded; the Google Maps link itself needs an internet connection.

## Data and accuracy

The metro station names and sequences were aligned to the station sequence supplied in the project request. Metro line segments on the map now come from adjacent metro connections in the route graph. The incorrect “Sabarmati River” metro stop was removed from the East–West sequence.

The BRTS and AMTS entries remain a partial prototype inventory. BRTS entries represent a few sample corridors and AMTS entries are not a complete current stop-by-stop feed. The coordinates and schematic positions in the bundled dataset have not been comprehensively validated against an operator feed. Fares, transfer distances, and times are estimates. Do not rely on them for a real trip without checking the operator.

Clicking **Find this stop in Google Maps** opens a Google Maps search for that stop. This provides a convenient live lookup, but it does not import Google Maps results into YatraOne or supply bus numbers, arrivals, or verified route sequences to the local planner. Embedded Google transit results would require a configured Google Maps Platform integration and API key; no key is included in this repository.

## Data sources

- [Ahmedabad Janmarg / BRTS](https://www.ahmedabadbrts.org/en/plan/) — operator overview and journey-planning entry point.
- [AMTS bus timings PDF](https://www.amts.co.in/media/1154/amts-bus-timings.pdf) — operator timetable document; verify that the downloaded edition is current before using its contents.
- [Google Routes API: transit routes](https://developers.google.com/maps/documentation/routes/transit-route) — documents transit route responses, including stop and line details where available. Coverage varies by region.
- [Google Transit partner stop and station guidance](https://support.google.com/transitpartners/answer/6377423?hl=en) — GTFS stop/station concepts for agencies publishing a feed.

The currently bundled JSON files should be treated as prototype data, not as a direct export from Google Maps or an official GTFS feed.

## Roadmap / future work

Keep requested and planned features here so the next development pass can pick them up:

- [ ] Replace prototype coordinates and corridor geometry with validated stop latitude/longitude and route shapes.
- [ ] Import complete, current BRTS and AMTS route numbers with ordered stops in both directions from an authoritative feed/source.
- [ ] Add bus stand details: nearby landmarks, platform/bay where published, route numbers, accessibility, and operator links.
- [ ] Add current timetables, service calendars, live arrivals, and data freshness/source labels.
- [ ] Add walking transfers between verified bus stands and Metro stations.
- [ ] Evaluate Google Maps Platform transit integration for live routing; configure a restricted API key outside source control and document billing, attribution, and data-use requirements before enabling it.
- [ ] Add a real geographic basemap and route overlays with a clear distinction between verified and estimated data.
- [ ] Review fare calculations and mark estimates clearly until approved fare data is available.

When new features are requested or planned, update this roadmap and the relevant accuracy/source notes in the same change.

## Recent changes

- **2026-10-11:** Added a Google Maps stop lookup link to stop details and displayed corridor / prototype stop ID information. Rewrote this README to explain what is implemented, document data limitations, and keep future work in one place.
- **2026-10-10:** Updated the schematic map to draw Metro edges from the planner graph and removed the false “Sabarmati River” metro stop from the East–West station sequence.

