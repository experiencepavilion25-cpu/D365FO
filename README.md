# D365FO

A React application served and built with Vite. The original saved HTML contains the compiled React application; its JavaScript bundle and styles are extracted into `src/`.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run locally

```powershell
npm install
npm run dev
```

Create a production build and serve it locally:

```powershell
npm run build
npm run preview
```

The Vite development and preview servers provide a local `/actions` API for the app's record operations. Data is saved to `data/records.json`, which is ignored by Git.

## Source files

- `src/main.jsx` contains the compiled React bundle extracted from the saved HTML. The original editable JSX source was not included in the downloaded files.
- `src/style.css` contains the styles extracted from the saved HTML.
- The other downloaded HTML, JavaScript, CSS, and image files are retained as captured assets; Vite does not need the unrelated `.js.download` files to run the app.
