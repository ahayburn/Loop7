# Loop 7 (GitHub Pages copy)

Everything runs in the browser. There is no server.

## Put it online
1. Create a new repository on GitHub (private or public).
2. Upload every file in this folder to the top level of the repository, keeping the names exactly:
   `index.html`, `suite.txt`, `actors.txt`, `manifest.webmanifest`, the five icon `.png` files and the backup `.json`.
3. Repository Settings > Pages > Build and deployment > Deploy from a branch > `main` / `(root)` > Save.
4. After a minute your site is at `https://YOUR-NAME.github.io/YOUR-REPO/`.

## Load your films
Open the site, scroll to **Backup**, choose **Load a backup**, pick `loop-7-backup-2026-10-26.json`, then press **Restore**.

## Where your data lives
In the browser on the device you are using (IndexedDB). It is not on GitHub and does not sync between devices.
- Press **Save a backup** now and then. On a phone it opens the share sheet: choose Save to Files.
- On iPhone, open the site in Safari, tap Share, then Add to Home Screen. It gets the Loop 7 icon and opens full screen, and Safari is much less likely to clear its data.
- Clearing the browser's website data deletes your films, so keep a backup file.

## Notes
- The 3D library and fonts load from public CDNs, so the first load needs internet.
- The street set, the hotel smoke and the mother and daughter poses are built in code, so they need no extra files.
- The same `index.html` also works inside Claude: it uses Claude's database there and the browser here.
