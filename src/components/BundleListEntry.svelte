<script lang="ts">
    import {listMessagePage, type ParsedMessage} from "../services/GmailService";
    import type {MessageAction} from "../MessageActions";
    import {PanelService} from "../services/PanelService.svelte";
    import {getContext, type Snippet} from "svelte";
    import {Context} from "../Context";
    import EmailList from "./EmailList.svelte";
    import type {BundleListItem} from "../EmailListItem";
    import {formatListDate} from "../DateFormatter";
    import {formatSenderName} from "../SenderFormatter";
    import ListEntryFrame from "./ListEntryFrame.svelte";

    let props: {
        representative: ParsedMessage,
        bundleListItem: BundleListItem,
        checked: boolean,
        showCheckbox: boolean,
        actions: MessageAction[],
        onBundleDrop: (sourceMessageId: string, target: ParsedMessage) => void,
        onCheckedChange: (checked: boolean) => void,
        onRunAction: (action: MessageAction) => void,
        parentListSnippet: Snippet
    } = $props();

    let panelService: PanelService = getContext(Context.PANEL_SERVICE)

    const count = $derived(
        props.representative.bundleSummary?.hasMore
            ? '25+'
            : String(props.representative.bundleSummary?.count ?? 1)
    );
    const senders = $derived(
        props.representative.bundleSummary?.senders.length
            ? props.representative.bundleSummary.senders.map(formatSenderName).join(', ')
            : formatSenderName(props.representative.sender)
    );

    const handleDragOver = (event: DragEvent) => {
        if (!event.dataTransfer?.types.includes('application/x-fettuccemail-message')) {
            return false;
        }

        const sourceMessageId = event.dataTransfer?.getData('application/x-fettuccemail-message');
        if (!sourceMessageId || sourceMessageId === props.representative.id) {
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
        props.onBundleDrop(sourceMessageId, props.representative);
        return true;
    };
</script>

{#snippet bundleList()}
    <EmailList
            getMessages={(pageToken?: string) => listMessagePage({
                pageToken,
                labelIds: [props.bundleListItem.bundleLabelId!],
                includeSpamTrash: true,
                includeBundleSummaries: false,
            })}
            groupByDate
            parseBundles={false}
            bundleInfo={props.bundleListItem}
            selfSnippet={bundleList}
    />
{/snippet}

<ListEntryFrame
        showCheckbox={props.showCheckbox}
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
        unread={props.representative.unread}
        actions={props.actions?.slice(0, 3)}
        runAction={props.onRunAction}
        selected={panelService.contains(bundleList)}
        onSelect={() => panelService.openAfter(props.parentListSnippet, bundleList)}
        onDragStart={undefined}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
>
    {#snippet avatar()}
        <span class="icon">inbox</span>
    {/snippet}
    {#snippet sender()}
        <span class="sender-name">
            {props.representative.bundleTitle ?? 'Untitled bundle'} <span class="count">({count})</span>
        </span>
    {/snippet}
    {#snippet content()}
        {senders}
    {/snippet}
    {#snippet date()}
        <span class="date" title={props.representative.date}>{formatListDate(props.representative.date)}</span>
    {/snippet}
</ListEntryFrame>

<style>
    .count {
        color: rgba(239, 239, 239, 0.7);
    }
</style>
