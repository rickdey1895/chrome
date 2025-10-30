# Badoo Scraper Chrome Extension

This project is a Chrome extension designed for scraping data from the Badoo website. It allows users to extract relevant information and display it in a user-friendly interface.

## Project Structure

```
badoo-scraper-extension
├── src
│   ├── background
│   │   └── service-worker.ts
│   ├── content_scripts
│   │   └── scrape.ts
│   ├── popup
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── options
│   │   ├── options.html
│   │   ├── options.ts
│   │   └── options.css
│   └── types
│       └── index.d.ts
├── manifest.json
├── package.json
├── tsconfig.json
├── webpack.config.js
└── README.md
```

## Features

- **Data Scraping**: Extracts user data from Badoo using content scripts.
- **Popup Interface**: Displays scraped data in a popup when the extension icon is clicked.
- **Options Page**: Allows users to configure settings for the extension.
- **TypeScript Support**: Utilizes TypeScript for type safety and better development experience.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd badoo-scraper-extension
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the project:
   ```
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable "Developer mode".
   - Click "Load unpacked" and select the `badoo-scraper-extension` directory.

## Usage

- Click on the extension icon in the Chrome toolbar to open the popup and view scraped data.
- Navigate to the options page to configure your preferences.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.