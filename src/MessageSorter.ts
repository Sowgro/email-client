import type {ParsedMessage} from "./services/GmailService";

export type MessageSection = {
    label: string | null;
    messages: ParsedMessage[];
};

export const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function sortPinned(messages: ParsedMessage[]) {
    return [
        {label: 'Pinned', messages: messages.filter((message) => message.starred)},
        {label: 'Messages', messages: messages.filter((message) => !message.starred)},
    ]
}

export function sortDate(messages: ParsedMessage[]) {
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    const lastMonth = new Date(today);
    lastMonth.setDate(today.getDate() - 30);

    const dateSections: MessageSection[] = [
        {label: 'Today', messages: []},
        {label: 'Yesterday', messages: []},
        {label: 'Within the last week', messages: []},
        {label: 'Within the last month', messages: []},
        {label: 'Older', messages: []},
    ];

    for (const message of messages) {
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

        dateSections[sectionIndex].messages.push(message);
    }

    return dateSections
}
