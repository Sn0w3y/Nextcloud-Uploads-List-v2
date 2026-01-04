# Nextcloud Uploads List v2

A Nextcloud app that shows **individual upload progress for each file** instead of just a single overall progress bar.

![Nextcloud](https://img.shields.io/badge/Nextcloud-28--32-blue?logo=nextcloud)
![License](https://img.shields.io/badge/License-AGPL%20v3-green)
![Version](https://img.shields.io/badge/Version-2.0.0-orange)

## Features

- **Individual file tracking** - See progress for each uploading file separately
- **Real-time progress bars** - Visual progress indicator per file
- **Upload speed** - Current upload speed displayed per file
- **Time remaining** - Estimated time remaining for each file
- **File size** - Shows uploaded bytes vs total size
- **Minimizable panel** - Click to minimize/expand the upload panel
- **Dark mode support** - Adapts to your Nextcloud theme
- **Non-intrusive** - Panel only appears when uploads are active

## Screenshot

![Uploads List Panel](screenshots/panel.png)

*The panel appears in the bottom-right corner during uploads*

## Requirements

- Nextcloud 28, 29, 30, 31, or 32
- No additional PHP extensions required

## Installation

### Manual Installation

1. Download or clone this repository
2. Copy the folder to your Nextcloud `custom_apps` directory:
   ```bash
   cp -r Nextcloud-Uploads-List-v2 /path/to/nextcloud/custom_apps/uploadslist
   ```
3. Set proper permissions:
   ```bash
   chown -R www-data:www-data /path/to/nextcloud/custom_apps/uploadslist
   ```
4. Enable the app via command line:
   ```bash
   sudo -u www-data php occ app:enable uploadslist
   ```
   Or enable it in the Nextcloud Admin Panel under Apps.

### Docker Installation

```bash
docker cp uploadslist nextcloud:/var/www/html/custom_apps/uploadslist
docker exec nextcloud chown -R www-data:www-data /var/www/html/custom_apps/uploadslist
docker exec -u www-data nextcloud php occ app:enable uploadslist
```

### After Installation

Clear the Nextcloud cache to ensure the JavaScript loads:
```bash
sudo -u www-data php occ maintenance:repair --include-expensive
```

Then refresh your browser with `Ctrl+F5`.

## How It Works

The app intercepts XMLHttpRequest and Fetch API calls to detect file uploads to Nextcloud's WebDAV endpoints. It then displays a floating panel showing:

- File name
- Progress bar with percentage
- Uploaded size / Total size
- Current upload speed
- Estimated time remaining

The panel automatically appears when uploads start and hides when all uploads complete.

## Customization

The panel uses Nextcloud's CSS variables for theming, so it automatically adapts to your theme colors. If you want to customize the appearance, edit `css/uploadslist.css`.

## Troubleshooting

### Panel doesn't appear
1. Make sure the app is enabled: `php occ app:list | grep uploadslist`
2. Clear the cache: `php occ maintenance:repair --include-expensive`
3. Hard refresh your browser: `Ctrl+F5`
4. Check browser console for JavaScript errors (F12)

### Progress not updating
The app monitors XHR and Fetch requests. If your Nextcloud uses a different upload method, progress tracking may not work. Please open an issue with details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

- Original concept inspired by [Nextcloud-Uploads-List](https://github.com/JonathanTreffler/Nextcloud-Uploads-List) by Jonathan Treffler
- Rewritten for Nextcloud 28+ by [Sn0w3y](https://github.com/Sn0w3y)

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
