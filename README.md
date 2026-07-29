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

#### Current implementation gaps
- [x] Load message lists with pagination, refresh, empty states, and robust error handling.
- [x] Avoid fetching each message twice when opening mail from the list.
- [x] Decode and render plain-text, HTML, and multipart messages reliably instead of only using the first `text/html` part.
- [x] Sanitize or safely sandbox rendered HTML email content.
- [x] Add loading, retry, and authorization-error states across Gmail API calls.
- [x] Track the selected/open message in the list.
- [x] Support attachments in message display.
- [x] Wire the search box to Gmail search instead of leaving it as a static input.
- [x] Make sidebar destinations functional: Inbox, Done, Drafts, Sent, Trash, Spam, and Settings.
- [x] Implement message action such as pin (star), delete, done (archive), and more actions.
- [x] Add sign-out and token/session lifecycle handling.
- [x] Replace the hard-coded header date and demo account with the signed-in account's real profile data.
- [x] Configure and document the required Google OAuth client ID and API key values.
- [ ] Remove debug logging and commented-out experimental code.
- [ ] Implement the Compose button.

#### Expected email client features not yet implemented
- [ ] Send, reply, reply-all, forward, and save drafts.
- [ ] Read/unread state management.
- [ ] Archive, trash, delete forever, restore from trash, and spam/not-spam actions.
- [ ] Starred/important labels and custom Gmail label management.
- [ ] Conversation/thread view instead of isolated message views.
- [ ] Multi-select and bulk actions.
- [ ] Keyboard shortcuts.
- [ ] Sorting and filtering by sender, date, unread, starred, labels, and attachments.
- [ ] Advanced search using Gmail query operators.
- [ ] Contact autocomplete and recipient validation.
- [ ] Rich text compose editor with formatting controls.
- [ ] File attachments and inline images in compose.
- [ ] Signature support.
- [ ] Account settings, preferences, and theme options.
- [ ] Multiple account support.
- [ ] Notifications for new mail.
- [ ] Background refresh or push updates.
- [ ] Offline/cache behavior for recently viewed mail.
- [ ] Responsive mobile layout and accessibility review.
- [ ] Tests for authentication flow, Gmail API integration, message parsing, and core UI behavior.
