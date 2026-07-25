# email-client
An incomplete web email client currently using Google's gmail API

### setup
copy .env.example to .env and fill out the api information

`npm run dev`

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
- [ ] Configure and document the required Google OAuth client ID and API key values.
- [ ] Add sign-out and token/session lifecycle handling.
- [ ] Replace the hard-coded header date and demo account with the signed-in account's real profile data.
- [ ] Implement the Compose button.
- [ ] Add real handlers for message action icons such as star, delete, done/archive, and more actions.
- [ ] Remove debug logging and commented-out experimental code.

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
