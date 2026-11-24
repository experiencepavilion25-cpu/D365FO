# Quickserve ERP — D365 Finance & Operations

A React and Vite application for Quickserve ERP discovery, setup, data mapping, integration planning, workflow design, and related project activities.

## Requirements

- Node.js and npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Build and preview

```bash
npm run build
npm run preview
```

## Application notes

- The interface retains the original application's tabs and workflows, including the Workflow Configuration Designer.
- Most editable application data is stored in browser local storage. Workflow records are kept in the current browser session.
- This is an in-page planning tool: it does not connect to live D365, write directly to SQL, or store client secrets.

## Project structure

- `src/App.jsx` — React wrapper and application initialization.
- `src/origin.html` — Original application markup, styles, and scripts.
- `src/workflow-legacy.js` — Workflow Designer source from the supplied application.
- `src/main.jsx` — React entry point.
- `index.html` — Vite HTML entry point.
