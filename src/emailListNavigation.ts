import type {Action} from 'svelte/action';
import type {PanelService} from './services/PanelService.svelte';

interface EmailListNavigationOptions {
    panelService: PanelService;
}

const getSelectedMessage = (root: HTMLDivElement) =>
    root.querySelector<HTMLElement>('.email.selected');

const getListedMessages = (root: HTMLDivElement) =>
    Array.from(root.querySelectorAll<HTMLElement>('.email'));

const activateMessage = (message: HTMLElement) => {
    message.click();
    message.focus();
    message.scrollIntoView({block: 'nearest'});
};

const activateFirstMessageInNextList = (currentPanelSlot: Element): boolean => {
    const nextList = currentPanelSlot.nextElementSibling
        ?.querySelector<HTMLDivElement>('.emailList');
    const firstMessage = nextList && getListedMessages(nextList)[0];

    if (!firstMessage) {
        return false;
    }

    activateMessage(firstMessage);
    return true;
};

const isTextEntry = (target: EventTarget | null) =>
    target instanceof HTMLElement
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

export const activateNextMessage = (root?: HTMLDivElement): boolean => {
    if (!root) {
        return false;
    }

    const selectedMessage = getSelectedMessage(root);
    const selectedIndex = selectedMessage
        ? getListedMessages(root).indexOf(selectedMessage)
        : -1;
    const nextMessage = getListedMessages(root)[selectedIndex + 1];

    if (!nextMessage) {
        return false;
    }

    activateMessage(nextMessage);
    return true;
};

export const emailListNavigation: Action<HTMLDivElement, EmailListNavigationOptions> = (
    root,
    {panelService},
) => {
    const handleWindowKeydown = (event: KeyboardEvent) => {
        const panels = root.closest('#panels');
        const currentPanelSlot = root.closest('.panel-slot');
        const panelSlots = Array.from(
            panels?.querySelectorAll(':scope > .panel-slot') ?? []
        );
        const currentPanelIndex = currentPanelSlot ? panelSlots.indexOf(currentPanelSlot) : -1;

        if (
            panelService.getPanelCount() < 2
            || currentPanelIndex !== panelService.getPanelCount() - 2
            || event.isComposing
            || isTextEntry(event.target)
            || panels?.querySelector('[role="menu"]')
        ) {
            return;
        }

        const selectedMessage = getSelectedMessage(root);

        if (event.key === 'Escape') {
            event.preventDefault();
            selectedMessage?.focus();
            panelService.closeLast();
            return;
        }

        if (
            (event.key !== 'ArrowUp'
                && event.key !== 'ArrowDown'
                && event.key !== 'ArrowRight')
            || event.altKey
            || event.ctrlKey
            || event.metaKey
            || event.shiftKey
        ) {
            return;
        }

        if (event.key === 'ArrowRight') {
            if (currentPanelSlot && activateFirstMessageInNextList(currentPanelSlot)) {
                event.preventDefault();
            }
            return;
        }

        const listedMessages = getListedMessages(root);
        const selectedIndex = selectedMessage ? listedMessages.indexOf(selectedMessage) : -1;
        const nextIndex = selectedIndex + (event.key === 'ArrowUp' ? -1 : 1);
        const nextMessage = listedMessages[nextIndex];

        if (!nextMessage) {
            return;
        }

        event.preventDefault();
        activateMessage(nextMessage);
    };

    window.addEventListener('keydown', handleWindowKeydown);

    return {
        destroy() {
            window.removeEventListener('keydown', handleWindowKeydown);
        },
    };
};
