import type {ParsedMessage} from "./services/GmailService";

export type MessageSection<T = ParsedMessage> = {
    label: string | null;
    messages: T[];
};

export const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function sortPinned<T extends ParsedMessage>(messages: T[]): MessageSection<T>[];
export function sortPinned<T>(
    messages: T[],
    getMessage: (item: T) => ParsedMessage,
): MessageSection<T>[];
export function sortPinned<T>(
    messages: T[],
    getMessage: (item: T) => ParsedMessage = (item) => item as ParsedMessage,
): MessageSection<T>[] {
    return [
        {label: 'Pinned', messages: messages.filter((item) => getMessage(item).starred)},
        {label: 'Messages', messages: messages.filter((item) => !getMessage(item).starred)},
    ]
}

export function sortDate<T extends ParsedMessage>(messages: T[]): MessageSection<T>[];
export function sortDate<T>(
    messages: T[],
    getMessage: (item: T) => ParsedMessage,
): MessageSection<T>[];
export function sortDate<T>(
    messages: T[],
    getMessage: (item: T) => ParsedMessage = (item) => item as ParsedMessage,
): MessageSection<T>[] {
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    const lastMonth = new Date(today);
    lastMonth.setDate(today.getDate() - 30);

    const dateSections: MessageSection<T>[] = [
        {label: 'Today', messages: []},
        {label: 'Yesterday', messages: []},
        {label: 'Within the last week', messages: []},
        {label: 'Within the last month', messages: []},
        {label: 'Older', messages: []},
    ];

    for (const item of messages) {
        const message = getMessage(item);
        const messageDate = message.date ? startOfDay(new Date(message.date)) : undefined;
        const timestamp = messageDate?.getTime();
        let sectionIndex = 4;

        if (timestamp !== undefined && !Number.isNaN(timestamp)) {
            if (timestamp >= today.getTime()) {
                sectionIndex = 0;
            } else if (timestamp >= yesterday.getTime()) {
                sectionIndex = 1;
            } else if (timestamp >= lastWeek.getTime()) {
                sectionIndex = 2;
            } else if (timestamp >= lastMonth.getTime()) {
                sectionIndex = 3;
            }
        }

        dateSections[sectionIndex].messages.push(item);
    }

    return dateSections
}
