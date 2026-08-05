# email-client
An incomplete web email client currently using Google's gmail API

### setup

1. In the [Google Cloud console](https://console.cloud.google.com/), create or select a project.
2. Enable the **Gmail API** under **APIs & Services → Library**.
3. Configure the OAuth consent screen. While the app is in testing, add the Google accounts that will use it as test users.
4. Under **APIs & Services → Credentials**, create an **API key**. Restrict it to the Gmail API and use **Websites** application restrictions for the URLs where this app runs.
5. Create an **OAuth client ID** with application type **Web application**. Add the app origins, such as `http://localhost:5173`, to **Authorized JavaScript origins**.
6. Copy `.env.example` to `.env` and set:

   ```dotenv
   VITE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_API_KEY=your-google-api-key
   ```

   These `VITE_` values are bundled into the browser, so restrict the key and never put unrelated secrets in this file.

7. Install dependencies and start the app:

   ```sh
   npm install
   npm run dev
   ```

### todo [ai generated]
- [ ] Multi-select and bulk actions.
- [ ] Auto-bundle categories
- [ ] important labels and custom Gmail label management.
- [ ] Read/unread
- [ ] Fix sender display
- [ ] Fix date display
- [ ] Sender icons
- [ ] Keyboard nav & shortcuts.
- [ ] snooze
- [ ] Conversation/thread view instead of isolated message views.
- [ ] Mobile layout
- [ ] Search page with advanced search options.
- [ ] Multiple account support.
- [ ] Notifications for new mail.

### composition
- [ ] Implement the Compose button.
- [ ] Send, reply, reply-all, forward, and save drafts.
- [ ] Contact autocomplete and recipient validation.
- [ ] Rich text compose editor with formatting controls.
- [ ] File attachments and inline images in compose.
- [ ] Signature support.
