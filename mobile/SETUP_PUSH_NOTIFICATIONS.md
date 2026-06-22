# Setup Push Notifications

To enable push notifications that appear on top of the device (like WhatsApp/Telegram), you need to set up an EAS project.

## Quick Setup (Recommended)

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   npx expo login
   ```

3. **Initialize EAS project**:
   ```bash
   cd mobile
   npx eas init
   ```
   
   This will:
   - Create an `eas.json` file
   - Add a `projectId` to `app.json`
   - Link your project to Expo's services

4. **Restart the app**:
   - The device token will be automatically registered on next login
   - Push notifications will now work!

## Alternative: Development Build

If you prefer not to use EAS, you can create a development build:

```bash
cd mobile
npx expo run:android  # or run:ios
```

This creates a standalone app with full push notification support.

## Testing

After setup:
1. Log in to the app
2. Check the console for "Device token registered successfully"
3. Send a notification from admin panel
4. You should see it appear as a system notification on top of the device!

## Troubleshooting

- If you see "No projectId found", make sure you ran `npx eas init`
- For Expo Go, push notifications have limitations - use a development build for full functionality
- Make sure you're testing on a physical device (not simulator/emulator)

