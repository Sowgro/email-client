<script lang="ts">
    import {formatError, listMessagePage, type ParsedMessage} from "../services/GmailService";
    import type {MessageAction} from "../MessageActions";
    import {PanelService} from "../services/PanelService.svelte";
    import {getContext, type Snippet} from "svelte";
    import {Context} from "../Context";
    import {renameBundle} from "../services/BundleService";
    import EmailList from "./EmailList.svelte";
    import type {BundleListItem} from "../EmailListItem";
    import type {ToastService} from "../services/ToastService.svelte";
    import type {GmailOperationService} from "../services/GmailOperationService.svelte";
    import {formatListDate} from "../DateFormatter";
    import {formatSenderName} from "../SenderFormatter";
    import ListEntryFrame from "./ListEntryFrame.svelte";

    let {
        representative,
        bundleListItem,
        checked = false,
        showCheckbox = false,
        actions = [],
        onBundleDrop,
        onCheckedChange,
        onRunAction,
        parentListSnippet
    }: {
        representative: ParsedMessage,
        bundleListItem: BundleListItem,
        checked?: boolean,
        showCheckbox?: boolean,
        actions?: MessageAction[],
        onBundleDrop: (sourceMessageId: string, target: ParsedMessage) => void,
        onCheckedChange?: (checked: boolean) => void,
        onRunAction: (action: MessageAction) => void,
        parentListSnippet: Snippet
    } = $props();

    let panelService: PanelService = getContext(Context.PANEL_SERVICE)
    let toastService: ToastService = getContext(Context.TOAST_SERVICE)
    let gmailOperations: GmailOperationService = getContext(Context.GMAIL_OPERATION_SERVICE)

    let bundling: boolean = $state(false)

    const count = $derived(
        representative.bundleSummary?.hasMore
            ? '25+'
            : String(representative.bundleSummary?.count ?? 1)
    );
    const senders = $derived(
        representative.bundleSummary?.senders.length
            ? representative.bundleSummary.senders.map(formatSenderName).join(', ')
            : formatSenderName(representative.sender)
    );

    const requestBundleTitle = (initialTitle = ''): string | undefined => {
        const title = window.prompt('Name this bundle', initialTitle)?.trim();
        if (title === '') {
            toastService.error({message: 'Bundle names cannot be empty'});
            return undefined;
        }
        return title;
    };

    const handleBundleRename = async (bundleLabelId: string, bundleTitle?: string) => {
        if (bundling) {
            return;
        }

        const title = requestBundleTitle(bundleTitle ?? 'Untitled bundle');
        if (!title || title === bundleTitle) {
            return;
        }

        bundling = true;
        try {
            await gmailOperations.run(() => renameBundle(bundleLabelId, title));
            // messages = messages.map((listedMessage) =>
            //     listedMessage.bundleLabelId === bundleLabelId
            //         ? {...listedMessage, bundleTitle: title}
            //         : listedMessage
            // );
            toastService.success({message: 'Bundle renamed'});
        } catch (ex) {
            toastService.error({
                message: 'Failed to rename bundle',
                error: formatError(ex),
            });
        } finally {
            bundling = false;
        }
    };

    const handleDragOver = (event: DragEvent) => {
        if (!event.dataTransfer?.types.includes('application/x-fettuccemail-message')) {
            return false;
        }

        const sourceMessageId = event.dataTransfer?.getData('application/x-fettuccemail-message');
        if (!sourceMessageId || sourceMessageId === representative.id) {
            return false;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        return true;
    };

    const handleDrop = (event: DragEvent) => {
        const sourceMessageId = event.dataTransfer?.getData('application/x-fettuccemail-message');
        if (!sourceMessageId) {
            return false;
        }

        event.preventDefault();
        onBundleDrop(sourceMessageId, representative);
        return true;
    };

    const renameAction: MessageAction = {
        label: "Rename bundle",
        icon: "edit",
        onAction: async (_) => {
            representative.bundleLabelId && await handleBundleRename(representative.bundleLabelId, representative.bundleTitle)
        },
    }
</script>

{#snippet bundleList()}
    <EmailList
            getMessages={(pageToken?: string) => listMessagePage({
                pageToken,
                labelIds: [bundleListItem.bundleLabelId!],
                includeSpamTrash: true,
                includeBundleSummaries: false,
            })}
            groupByDate
            parseBundles={false}
            bundleTitle={bundleListItem.bundleTitle ?? 'Untitled bundle'}
            selfSnippet={bundleList}
    />
{/snippet}

<ListEntryFrame
        showCheckbox={showCheckbox}
        checked={checked}
        onCheckedChange={onCheckedChange!}
        unread={representative.unread}
        actions={[renameAction, ...actions.slice(0, 3)]}
        runAction={onRunAction}
        selected={!!panelService.panels.find(i => i === bundleList)}
        onSelect={() => panelService.openNextTo(parentListSnippet, bundleList)}
        onDragStart={undefined}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
>
    {#snippet avatar()}
        <span class="icon">inbox</span>
    {/snippet}
    {#snippet sender()}
        <span class="sender-name">
            {representative.bundleTitle ?? 'Untitled bundle'} <span class="count">({count})</span>
        </span>
    {/snippet}
    {#snippet content()}
        {senders}
    {/snippet}
    {#snippet date()}
        <span class="date" title={representative.date}>{formatListDate(representative.date)}</span>
    {/snippet}
</ListEntryFrame>
